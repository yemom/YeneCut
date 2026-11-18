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

export interface CutRegion {
  start: number;
  end: number;
}

export interface SilenceCutResult {
  success: boolean;
  message: string;
  cutsApplied: number;
  noOp: boolean;
}

/**
 * Apply target-aware silence cuts to the timeline.
 *
 * SAFETY CONTRACT:
 * 1. Only the track containing the target clip (and its linked track partner) are razored.
 * 2. Unrelated audio tracks (such as background music, ambient sound, sound effects) and
 *    unrelated video tracks (such as B-roll, overlays, logos) are 100% UNTOUCHED.
 * 3. Cut regions must be translated into sequence timeline coordinates.
 * 4. All operations are wrapped in an atomic lockedAccess transaction.
 * 5. Returns noOp: true if no clip fragments fall completely within the silence windows.
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

  // Map source timestamps to sequence timestamps if a target clip is provided
  const sequenceRegions = targetClip
    ? mapSilenceIntervalsToSequence(regions, targetClip)
    : regions;

  if (sequenceRegions.length === 0) {
    return {
      success: false,
      message: "Detected silence intervals fall completely outside the selected clip boundaries.",
      cutsApplied: 0,
      noOp: true,
    };
  }

  const sorted = [...sequenceRegions].sort((a, b) => a.start - b.start);
  const boundaries = Array.from(
    new Set(sorted.flatMap((region) => [region.start, region.end]))
  ).sort((a, b) => a - b);

  try {
    const editor = ppro.SequenceEditor.getEditor(sequence);
    const videoTrackCount = await sequence.getVideoTrackCount();
    const audioTrackCount = await sequence.getAudioTrackCount();

    // Determine target tracks: if targetClip is known, constrain strictly to targetTrack and its linked track
    const targetTracks: { type: "video" | "audio"; index: number }[] = [];
    if (targetClip) {
      targetTracks.push({ type: targetClip.trackType, index: targetClip.trackIndex });
      if (targetClip.trackType === "video" && targetClip.trackIndex < audioTrackCount) {
        targetTracks.push({ type: "audio", index: targetClip.trackIndex });
      } else if (targetClip.trackType === "audio" && targetClip.trackIndex < videoTrackCount) {
        targetTracks.push({ type: "video", index: targetClip.trackIndex });
      }
    } else {
      // Fallback: target track 0 (primary speech track) only — NEVER all tracks!
      if (videoTrackCount > 0) targetTracks.push({ type: "video", index: 0 });
      if (audioTrackCount > 0) targetTracks.push({ type: "audio", index: 0 });
    }

    // Step 1: Razor ONLY target tracks at interval boundaries
    let razorSuccess = false;
    project.lockedAccess(() => {
      const actions: any[] = [];
      for (const boundary of boundaries) {
        const position = ppro.TickTime.createWithSeconds(boundary);
        for (const track of targetTracks) {
          const mediaType =
            track.type === "video" ? ppro.Constants.MediaType.VIDEO : ppro.Constants.MediaType.AUDIO;
          actions.push(
            editor.createRazorTrackAction(mediaType, track.index, position, true, mediaType)
          );
        }
      }
      razorSuccess = project.executeTransaction((compoundAction: any) => {
        actions.forEach((action) => compoundAction.addAction(action));
      }, "YeneCut razor silence boundaries (target tracks only)");
    });

    if (!razorSuccess) {
      return { success: false, message: "Premiere did not execute razor action.", cutsApplied: 0, noOp: false };
    }

    // Step 2: Query items on target tracks to isolate segments inside silence regions
    const itemsToRemove: any[] = [];
    for (const track of targetTracks) {
      const trackObj =
        track.type === "video"
          ? await sequence.getVideoTrack(track.index)
          : await sequence.getAudioTrack(track.index);
      const items = trackObj.getTrackItems(ppro.Constants.TrackItemType.CLIP, false);
      for (const item of items) {
        const start = (await item.getStartTime()).seconds;
        const end = (await item.getEndTime()).seconds;
        if (sorted.some((region) => start >= region.start - 0.01 && end <= region.end + 0.01)) {
          itemsToRemove.push(item);
        }
      }
    }

    if (itemsToRemove.length === 0) {
      return {
        success: false,
        message: "Boundaries were razored, but no isolated clips matched silence intervals. No media removed.",
        cutsApplied: 0,
        noOp: true,
      };
    }

    // Step 3: Remove isolated silence clips
    let removeSuccess = false;
    const selection = await sequence.getSelection();
    await sequence.clearSelection();
    itemsToRemove.forEach((item) => selection.addItem(item, false));
    sequence.setSelection(selection);

    project.lockedAccess(() => {
      removeSuccess = project.executeTransaction((compoundAction: any) => {
        const removeAction = editor.createRemoveItemsAction(selection, true, ppro.Constants.MediaType.VIDEO);
        compoundAction.addAction(removeAction);
      }, "YeneCut remove silence (target tracks only)");
    });

    return {
      success: removeSuccess,
      message: removeSuccess
        ? `Successfully removed ${itemsToRemove.length} silence segment(s). Use Premiere Undo (Ctrl+Z) to revert.`
        : "Premiere failed to remove silence segments.",
      cutsApplied: removeSuccess ? itemsToRemove.length : 0,
      noOp: false,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to apply silence cuts.",
      cutsApplied: 0,
      noOp: false,
    };
  }
}

/**
 * Preview silence intervals as temporary sequence markers without modifying any clips.
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

  try {
    const markersOwner = await ppro.Markers.getMarkers(sequence);
    project.lockedAccess(() => {
      project.executeTransaction((compoundAction: any) => {
        sequenceRegions.forEach((region) => {
          const action = markersOwner.createAddMarkerAction(
            "YeneCut Preview",
            ppro.Marker.MARKER_TYPE_COMMENT,
            ppro.TickTime.createWithSeconds(region.start),
            ppro.TickTime.createWithSeconds(Math.max(region.end - region.start, 0)),
            `[YeneCut] Suggested cut: ${region.start.toFixed(2)}s - ${region.end.toFixed(2)}s`
          );
          compoundAction.addAction(action);
        });
      }, "YeneCut silence preview markers");
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear all existing YeneCut preview markers from the sequence.
 */
export async function clearPreviewMarkers(): Promise<boolean> {
  const ppro = getPremiere();
  const project = await getActiveProject();
  if (!ppro || !project) return false;
  const sequence = await getActiveSequence(project);
  if (!sequence) return false;

  try {
    const markersOwner = await ppro.Markers.getMarkers(sequence);
    const allMarkers = await markersOwner.getMarkers();
    const yenecutMarkers = allMarkers.filter((m: any) => {
      try {
        return m.name === "YeneCut Preview";
      } catch {
        return false;
      }
    });

    if (yenecutMarkers.length === 0) return true;

    project.lockedAccess(() => {
      project.executeTransaction((compoundAction: any) => {
        yenecutMarkers.forEach((marker: any) => {
          compoundAction.addAction(markersOwner.createDeleteMarkerAction(marker));
        });
      }, "YeneCut clear preview markers");
    });
    return true;
  } catch {
    return false;
  }
}
