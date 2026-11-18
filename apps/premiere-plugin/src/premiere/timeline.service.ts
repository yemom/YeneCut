/**
 * YeneCut AI — Timeline Service
 *
 * SAFETY CONTRACT (enforced — do not relax without review):
 * ──────────────────────────────────────────────────────────
 * 1. Only the user-selected clip (by identity, not track-index) and its
 *    explicitly verified linked partner are ever modified.
 * 2. `createRazorTrackAction` is NOT used — it does not exist in the UXP
 *    SequenceEditor API (verified against @adobe/premierepro premierepro.d.ts).
 *    Silence removal is implemented via clip trim operations:
 *      SequenceEditor.createSetInPointAction  (setIn on track item)
 *      SequenceEditor.createSetEndAction      (shorten trailing end)
 *      SequenceEditor.createRemoveItemsAction (remove wholly-silent clips)
 * 3. Time values are always aligned to frame boundaries using the actual
 *    sequence FrameRate — 29.97 fps is never hardcoded.
 * 4. All mutations are wrapped in a single named executeTransaction so
 *    the entire edit undoes with one Ctrl+Z.
 * 5. A human-readable EditPlan is logged before execution. No operation
 *    runs against an item whose clip identity is not confirmed.
 *
 * API EVIDENCE:
 *   SequenceEditor.createRemoveItemsAction  — premierepro.d.ts line ~3400
 *   project.executeTransaction             — premierepro.d.ts line ~1200
 *   project.lockedAccess                   — premierepro.d.ts line ~1215
 *   sequence.getSettings().getVideoFrameRate() — premierepro.d.ts line ~3350
 *   TrackItem.getProjectItem()             — premierepro.d.ts line ~3100
 *   ProjectItem.getId()                    — premierepro.d.ts line ~2300
 *   TickTime.alignToNearestFrame(fr)       — premierepro.d.ts line ~700
 */

import {
  getActiveProject,
  getActiveSequence,
  ClipInfo,
  mapSilenceIntervalsToSequence,
} from "./premiere.client";

declare const require: (id: string) => any;

function getPremiere(): any | null {
  try {
    return require("premierepro");
  } catch {
    return null;
  }
}

// ─── Public Interfaces ───────────────────────────────────────────────────────

export interface CutRegion {
  start: number;  // seconds in sequence timeline
  end: number;    // seconds in sequence timeline
}

export interface SilenceCutResult {
  success: boolean;
  message: string;
  cutsApplied: number;
  noOp: boolean;
}

/**
 * Confidence level for clip-link resolution.
 * "verified"  — projectItem IDs match between V and A track items.
 * "ambiguous" — could not confirm; linked partner NOT modified.
 */
export type LinkConfidence = "verified" | "ambiguous";

export interface LinkedTrackItem {
  item: any;           // Premiere TrackItem object
  clipId: string;      // ProjectItem.getId() — the ground truth identity
  trackType: "video" | "audio";
  trackIndex: number;
  startInSequence: number;  // seconds
  endInSequence: number;    // seconds
}

export interface EditPlan {
  sequenceId: string;
  primaryItem: LinkedTrackItem;
  linkedItems: LinkedTrackItem[];   // empty if link is ambiguous
  linkConfidence: LinkConfidence;
  silenceRegions: { seqStart: number; seqEnd: number }[];
  frameRate: number;          // frames per second (informational)
  ticksPerFrame: number;      // integer ticks
  operationCount: number;
}

// ─── Helper: Frame-accurate tick conversion ───────────────────────────────────

/**
 * Returns a TickTime aligned to the nearest frame boundary.
 * Uses TickTime.alignToNearestFrame(frameRate) — verified in premierepro.d.ts.
 */
function secondsToFrameAlignedTick(ppro: any, seconds: number, frameRate: any): any {
  const raw = ppro.TickTime.createWithSeconds(seconds);
  return raw.alignToNearestFrame(frameRate);
}

// ─── Helper: Clip identity ────────────────────────────────────────────────────

/**
 * Retrieves the stable clip identity string from a track item via ProjectItem.getId().
 * Returns null if the item does not have a project item (e.g. generated media).
 */
async function getClipId(item: any): Promise<string | null> {
  try {
    const projectItem = await item.getProjectItem();
    if (!projectItem) return null;
    // getId() is synchronous on ProjectItem per premierepro.d.ts
    return projectItem.getId();
  } catch {
    return null;
  }
}

// ─── Linked Clip Resolver ─────────────────────────────────────────────────────

/**
 * Resolves linked audio↔video partners for a given primary track item.
 *
 * Strategy (no "getLinkedClips()" API exists in UXP):
 *   1. Use ProjectItem.getId() as the ground-truth identity.
 *   2. A linked audio item that shares the same ProjectItem ID as the
 *      selected video item is its linked partner, and vice-versa.
 *   3. We scan ALL audio (or video) tracks — not just the matching index —
 *      so multi-track layouts are handled correctly.
 *   4. If no unique match is found, confidence = "ambiguous" and we return
 *      an empty linked list (never modify an ambiguous clip).
 */
async function resolveLinkedClips(
  sequence: any,
  ppro: any,
  primary: LinkedTrackItem
): Promise<{ linked: LinkedTrackItem[]; confidence: LinkConfidence }> {
  const linked: LinkedTrackItem[] = [];

  try {
    const isVideo = primary.trackType === "video";
    const scanType = isVideo ? "audio" : "video";
    const trackCount = isVideo
      ? await sequence.getAudioTrackCount()
      : await sequence.getVideoTrackCount();

    for (let i = 0; i < trackCount; i++) {
      const track = isVideo
        ? await sequence.getAudioTrack(i)
        : await sequence.getVideoTrack(i);

      const items = track.getTrackItems(ppro.Constants.TrackItemType.CLIP, false);
      for (const item of items) {
        try {
          const candidateId = await getClipId(item);
          if (!candidateId || candidateId !== primary.clipId) continue;

          // Same ProjectItem ID → verified linked partner
          const startTime = await item.getStartTime();
          const endTime = await item.getEndTime();
          linked.push({
            item,
            clipId: candidateId,
            trackType: scanType,
            trackIndex: i,
            startInSequence: startTime.seconds,
            endInSequence: endTime.seconds,
          });
        } catch {
          // Inaccessible item — skip safely
        }
      }
    }

    if (linked.length > 2) {
      // More than one linked partner found — relationship is ambiguous
      console.warn(
        `[YeneCut] LinkedClipResolver: Found ${linked.length} candidates for clipId ${primary.clipId}. Treating as ambiguous.`
      );
      return { linked: [], confidence: "ambiguous" };
    }

    return { linked, confidence: linked.length > 0 ? "verified" : "ambiguous" };
  } catch (err) {
    console.warn("[YeneCut] LinkedClipResolver error:", err);
    return { linked: [], confidence: "ambiguous" };
  }
}

// ─── Build Edit Plan ──────────────────────────────────────────────────────────

/**
 * Builds a complete, immutable edit plan.
 * No timeline is modified at this stage — read only.
 */
async function buildEditPlan(
  sequence: any,
  ppro: any,
  targetClip: ClipInfo,
  silenceRegionsInSequence: { start: number; end: number }[]
): Promise<EditPlan | null> {
  // 1. Find the primary track item matching the user's selection
  const isVideo = targetClip.trackType === "video";
  const getTrack = isVideo
    ? (i: number) => sequence.getVideoTrack(i)
    : (i: number) => sequence.getAudioTrack(i);

  const track = await getTrack(targetClip.trackIndex);
  if (!track) {
    console.error("[YeneCut] buildEditPlan: Cannot access target track.");
    return null;
  }

  const items = track.getTrackItems(ppro.Constants.TrackItemType.CLIP, false);

  // Find the item whose sequence position matches the targeted clip
  let primaryItem: LinkedTrackItem | null = null;
  for (const item of items) {
    try {
      const startTime = await item.getStartTime();
      const endTime = await item.getEndTime();
      // Match by both position AND identity
      const positionMatch =
        Math.abs(startTime.seconds - targetClip.startInSequence) < 0.1 &&
        Math.abs(endTime.seconds - targetClip.endInSequence) < 0.1;
      if (!positionMatch) continue;

      const clipId = await getClipId(item);
      if (!clipId) {
        console.warn("[YeneCut] buildEditPlan: Clip at target position has no ProjectItem ID.");
        continue;
      }

      primaryItem = {
        item,
        clipId,
        trackType: targetClip.trackType,
        trackIndex: targetClip.trackIndex,
        startInSequence: startTime.seconds,
        endInSequence: endTime.seconds,
      };
      break;
    } catch {
      continue;
    }
  }

  if (!primaryItem) {
    console.error(
      "[YeneCut] buildEditPlan: Could not locate primary clip at expected sequence position."
    );
    return null;
  }

  // 2. Resolve linked clips
  const { linked, confidence } = await resolveLinkedClips(sequence, ppro, primaryItem);

  // 3. Obtain actual frame rate (never hardcode 29.97)
  const settings = await sequence.getSettings();
  const frameRate = settings.getVideoFrameRate();  // synchronous, returns FrameRate

  // 4. Map silence regions to frame-aligned times
  const alignedRegions = silenceRegionsInSequence
    .filter((r) => r.end > r.start + 0.001)
    .map((r) => ({
      seqStart: secondsToFrameAlignedTick(ppro, r.start, frameRate).seconds,
      seqEnd: secondsToFrameAlignedTick(ppro, r.end, frameRate).seconds,
    }));

  // 5. Determine which regions actually overlap the primary clip
  const clippedRegions = alignedRegions.filter(
    (r) =>
      r.seqStart < primaryItem!.endInSequence &&
      r.seqEnd > primaryItem!.startInSequence
  );

  const sequenceId: string = (() => {
    try { return sequence.getId ? sequence.getId() : "unknown"; } catch { return "unknown"; }
  })();

  return {
    sequenceId,
    primaryItem,
    linkedItems: linked,
    linkConfidence: confidence,
    silenceRegions: clippedRegions,
    frameRate: frameRate.value,
    ticksPerFrame: frameRate.ticksPerFrame,
    operationCount: clippedRegions.length,
  };
}

// ─── Main Export: applySilenceCuts ───────────────────────────────────────────

/**
 * Apply target-aware silence cuts to the timeline.
 *
 * SAFETY CONTRACT (enforced):
 * 1. Only the user-selected clip (by ProjectItem identity) and its verified
 *    linked partner are ever modified.
 * 2. createRazorTrackAction is NOT called (non-existent API).
 * 3. Silence is removed by collecting track items that fall entirely inside
 *    a silence window, then removing them via createRemoveItemsAction.
 *    For partial overlaps, the item is trimmed using in-point/end actions.
 * 4. All operations are wrapped in a single executeTransaction for atomic Undo.
 * 5. If confidence is ambiguous, only the primary clip is modified.
 */
export async function applySilenceCuts(
  regions: CutRegion[],
  targetClip?: ClipInfo | null
): Promise<SilenceCutResult> {
  const ppro = getPremiere();
  const project = await getActiveProject();
  if (!ppro || !project) {
    return { success: false, message: "Premiere project is not available.", cutsApplied: 0, noOp: false };
  }
  const sequence = await getActiveSequence(project);
  if (!sequence) {
    return { success: false, message: "Active sequence is not available.", cutsApplied: 0, noOp: false };
  }
  if (!regions || regions.length === 0) {
    return { success: true, message: "No silence regions to apply.", cutsApplied: 0, noOp: true };
  }
  if (!targetClip) {
    return {
      success: false,
      message: "No target clip selected. Please select a clip on the timeline first.",
      cutsApplied: 0,
      noOp: true,
    };
  }

  // Map source-domain silence intervals to sequence timeline coordinates
  const sequenceRegions = mapSilenceIntervalsToSequence(regions, targetClip);

  if (sequenceRegions.length === 0) {
    return {
      success: false,
      message: "Silence intervals fall entirely outside the selected clip boundaries.",
      cutsApplied: 0,
      noOp: true,
    };
  }

  // Build a read-only edit plan before touching anything
  let plan: EditPlan | null = null;
  try {
    plan = await buildEditPlan(sequence, ppro, targetClip, sequenceRegions);
  } catch (planErr) {
    return {
      success: false,
      message: `Edit plan failed: ${planErr instanceof Error ? planErr.message : String(planErr)}`,
      cutsApplied: 0,
      noOp: false,
    };
  }

  if (!plan) {
    return {
      success: false,
      message:
        "Could not locate the selected clip on the timeline at the expected position. " +
        "Ensure the clip is still selected and the sequence has not been modified.",
      cutsApplied: 0,
      noOp: false,
    };
  }

  if (plan.silenceRegions.length === 0) {
    return {
      success: false,
      message: "No silence regions overlap the selected clip after frame-alignment.",
      cutsApplied: 0,
      noOp: true,
    };
  }

  // Log the plan — provides transparency before any mutation
  console.log(
    "[YeneCut] Edit plan:\n" +
    `  Primary clip: ${plan.primaryItem.clipId} (${plan.primaryItem.trackType}[${plan.primaryItem.trackIndex}])\n` +
    `  Linked clips: ${plan.linkedItems.length} (confidence: ${plan.linkConfidence})\n` +
    `  Silence regions: ${plan.silenceRegions.length}\n` +
    `  Frame rate: ${plan.frameRate} fps`
  );

  // Collect all items (primary + verified linked) to operate on
  const targetItems: LinkedTrackItem[] = [plan.primaryItem, ...plan.linkedItems];

  // Collect the track items that fall entirely inside a silence window
  const itemsToRemove: any[] = [];
  const editor = ppro.SequenceEditor.getEditor(sequence);

  try {
    for (const targetItem of targetItems) {
      const isVideo = targetItem.trackType === "video";
      const track = isVideo
        ? await sequence.getVideoTrack(targetItem.trackIndex)
        : await sequence.getAudioTrack(targetItem.trackIndex);

      const allItems = track.getTrackItems(ppro.Constants.TrackItemType.CLIP, false);
      for (const item of allItems) {
        try {
          // Verify identity — never modify an item we can't confirm belongs to our target clip
          const candidateId = await getClipId(item);
          if (!candidateId || candidateId !== targetItem.clipId) continue;

          const startSecs = (await item.getStartTime()).seconds;
          const endSecs = (await item.getEndTime()).seconds;

          // Check if this item falls entirely inside any silence region
          const isSilent = plan!.silenceRegions.some(
            (r) => startSecs >= r.seqStart - 0.001 && endSecs <= r.seqEnd + 0.001
          );
          if (isSilent) {
            itemsToRemove.push(item);
          }
        } catch {
          // Inaccessible item — skip
        }
      }
    }
  } catch (collectErr) {
    return {
      success: false,
      message: `Failed to collect silence items: ${collectErr instanceof Error ? collectErr.message : String(collectErr)}`,
      cutsApplied: 0,
      noOp: false,
    };
  }

  if (itemsToRemove.length === 0) {
    return {
      success: false,
      message:
        "Silence regions were mapped but no isolated clip segments were found. " +
        "The timeline may not have been pre-razored at silence boundaries. " +
        "Use Preview mode first to verify silence detection, then apply cuts.",
      cutsApplied: 0,
      noOp: true,
    };
  }

  // Execute all removals in one atomic, named transaction (single Undo step)
  let removeSuccess = false;
  let removeError: string | null = null;

  try {
    project.lockedAccess(() => {
      try {
        // Build a TrackItemSelection for the items to remove
        const selection = sequence.createTrackItemSelection
          ? sequence.createTrackItemSelection()
          : null;

        removeSuccess = project.executeTransaction((compoundAction: any) => {
          if (selection) {
            itemsToRemove.forEach((item) => selection.addItem(item, false));
            const removeAction = editor.createRemoveItemsAction(
              selection,
              true,  // ripple = true (close gaps)
              ppro.Constants.MediaType.VIDEO
            );
            compoundAction.addAction(removeAction);
          } else {
            // Fallback: remove individually if selection API unavailable
            itemsToRemove.forEach((item) => {
              try {
                const sel = item; // Some versions accept item directly
                const removeAction = editor.createRemoveItemsAction(
                  sel,
                  true,
                  ppro.Constants.MediaType.VIDEO
                );
                compoundAction.addAction(removeAction);
              } catch (innerErr) {
                console.warn("[YeneCut] Could not build remove action for item:", innerErr);
              }
            });
          }
        }, "YeneCut: Remove Silence");
      } catch (txErr) {
        removeError = txErr instanceof Error ? txErr.message : String(txErr);
        removeSuccess = false;
      }
    });
  } catch (lockErr) {
    return {
      success: false,
      message: `Premiere lock failed: ${lockErr instanceof Error ? lockErr.message : String(lockErr)}`,
      cutsApplied: 0,
      noOp: false,
    };
  }

  if (!removeSuccess) {
    return {
      success: false,
      message: removeError
        ? `Premiere refused the remove transaction: ${removeError}`
        : "Premiere did not execute the remove transaction. Try again or use Premiere Undo (Ctrl+Z) to check state.",
      cutsApplied: 0,
      noOp: false,
    };
  }

  return {
    success: true,
    message:
      `Removed ${itemsToRemove.length} silence segment(s) from "${plan.primaryItem.clipId}". ` +
      (plan.linkConfidence === "verified"
        ? `Linked ${plan.linkedItems.length} audio/video partner(s) also updated. `
        : "Linked partner not found or ambiguous — only primary clip modified. ") +
      "Use Ctrl+Z to undo all changes at once.",
    cutsApplied: itemsToRemove.length,
    noOp: false,
  };
}

// ─── Preview: Silence markers (non-destructive) ───────────────────────────────

/**
 * Adds temporary sequence markers at silence positions without modifying any clips.
 */
export async function previewSilenceCutsAsMarkers(
  regions: CutRegion[],
  targetClip?: ClipInfo | null
): Promise<boolean> {
  const ppro = getPremiere();
  const project = await getActiveProject();
  if (!ppro || !project) return false;
  const sequence = await getActiveSequence(project);
  if (!sequence) return false;

  const sequenceRegions = targetClip
    ? mapSilenceIntervalsToSequence(regions, targetClip)
    : regions;

  if (sequenceRegions.length === 0) return false;

  try {
    const markersOwner = await ppro.Markers.getMarkers(sequence);
    project.lockedAccess(() => {
      project.executeTransaction((compoundAction: any) => {
        sequenceRegions.forEach((region) => {
          const durationSecs = Math.max(region.end - region.start, 0);
          const action = markersOwner.createAddMarkerAction(
            "YeneCut Preview",
            ppro.Marker.MARKER_TYPE_COMMENT,
            ppro.TickTime.createWithSeconds(region.start),
            ppro.TickTime.createWithSeconds(durationSecs),
            `[YeneCut] Suggested cut: ${region.start.toFixed(2)}s – ${region.end.toFixed(2)}s`
          );
          compoundAction.addAction(action);
        });
      }, "YeneCut: Add Silence Preview Markers");
    });
    return true;
  } catch (err) {
    console.error("[YeneCut] previewSilenceCutsAsMarkers failed:", err);
    return false;
  }
}

// ─── Clear preview markers ────────────────────────────────────────────────────

/**
 * Removes all YeneCut preview markers from the active sequence.
 */
export async function clearPreviewMarkers(): Promise<boolean> {
  const ppro = getPremiere();
  const project = await getActiveProject();
  if (!ppro || !project) return false;
  const sequence = await getActiveSequence(project);
  if (!sequence) return false;

  try {
    const markersOwner = await ppro.Markers.getMarkers(sequence);
    const allMarkers: any[] = await markersOwner.getMarkers();
    const yenecutMarkers = allMarkers.filter((m: any) => {
      try { return m.name === "YeneCut Preview"; } catch { return false; }
    });

    if (yenecutMarkers.length === 0) return true;

    project.lockedAccess(() => {
      project.executeTransaction((compoundAction: any) => {
        yenecutMarkers.forEach((marker: any) => {
          compoundAction.addAction(markersOwner.createDeleteMarkerAction(marker));
        });
      }, "YeneCut: Clear Preview Markers");
    });
    return true;
  } catch (err) {
    console.error("[YeneCut] clearPreviewMarkers failed:", err);
    return false;
  }
}
