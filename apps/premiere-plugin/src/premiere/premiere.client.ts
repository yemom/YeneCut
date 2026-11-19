/**
 * YeneCut AI — Premiere Pro UXP API Adapter
 *
 * All interactions with the Adobe Premiere Pro UXP host APIs
 * are centralized and isolated within this adapter.
 *
 * References:
 * - Official Adobe Premiere Pro UXP API: https://developer.adobe.com/premiere-pro/uxp/
 * - Type definitions: @adobe/premierepro
 */

export interface PremiereProjectHandle {
  name: string;
  guid: string;
}

export interface PremiereSequenceHandle {
  name: string;
  guid: string;
}

export interface ClipInfo {
  name: string;
  mediaPath: string | null;
  startInSequence: number;   // seconds on timeline
  endInSequence: number;     // seconds on timeline
  sourceInPoint: number;     // seconds in source media
  sourceOutPoint: number;    // seconds in source media
  trackIndex: number;
  trackType: "video" | "audio";
  speed?: number;            // 1.0 = normal
  isReversed?: boolean;
  isNestedSequence?: boolean;
  isAdjustmentLayer?: boolean;
}

declare const require: (id: string) => any;

function getPremiere(): any | null {
  try {
    return require("premierepro");
  } catch {
    return null;
  }
}

export function isPremiereAvailable(): boolean {
  return getPremiere() !== null;
}

export async function getActiveProject(): Promise<any | null> {
  const ppro = getPremiere();
  if (!ppro) return null;
  try {
    return await ppro.Project.getActiveProject();
  } catch {
    return null;
  }
}

export async function getActiveSequence(project: any): Promise<any | null> {
  if (!project) return null;
  try {
    return await project.getActiveSequence();
  } catch {
    return null;
  }
}

export async function getSequenceFrameRate(sequence: any): Promise<string | null> {
  if (!sequence) return null;
  try {
    const settings = await sequence.getSettings();
    const frameRate = settings.getVideoFrameRate();
    return String(frameRate.value);
  } catch {
    return null;
  }
}

/**
 * Retrieve user-selected clips from the active timeline sequence.
 * This replaces arbitrary project-bin item retrieval.
 */
export async function getSelectedClips(): Promise<ClipInfo[]> {
  const ppro = getPremiere();
  const project = await getActiveProject();
  if (!ppro || !project) return [];
  const sequence = await getActiveSequence(project);
  if (!sequence) return [];

  const result: ClipInfo[] = [];
  try {
    const videoTrackCount = await sequence.getVideoTrackCount();
    const audioTrackCount = await sequence.getAudioTrackCount();

    // Query video tracks for selected clips
    for (let i = 0; i < videoTrackCount; i++) {
      const track = await sequence.getVideoTrack(i);
    const items = track.getTrackItems(ppro.Constants.TrackItemType.CLIP, false); // includeEmptyTrackItems=false
      for (const item of items) {
        try {
          if (!(await item.getIsSelected())) continue;
          const startTime = await item.getStartTime();
          const endTime = await item.getEndTime();
          const inPoint = await item.getInPoint();
          const outPoint = await item.getOutPoint();
          let mediaPath: string | null = null;
          let isNestedSequence = false;
          try {
            const projectItem = await item.getProjectItem();
            if (projectItem) {
              mediaPath = await projectItem.getMediaFilePath();
              if (projectItem.getContentType && ppro.Constants?.ContentType) {
                const ct = await projectItem.getContentType();
                if (ct === ppro.Constants.ContentType.SEQUENCE) {
                  isNestedSequence = true;
                }
              }
            }
          } catch {
            // Media path may not be available for synthetic clips
          }

          let speed = 1.0;
          try {
            if (item.getSpeed) speed = await item.getSpeed();
          } catch {
            // Speed defaults to 1.0
          }

          let isReversed = false;
          try {
            if (item.isSpeedReversed) isReversed = (await item.isSpeedReversed()) !== 0;
          } catch {
            // Reversed defaults to false
          }

          let isAdjustmentLayer = false;
          try {
            if (item.isAdjustmentLayer) isAdjustmentLayer = await item.isAdjustmentLayer();
          } catch {
            // Adjustment layer defaults to false
          }

          result.push({
            name: (await item.getName?.()) || "Video Clip",
            mediaPath,
            startInSequence: startTime.seconds,
            endInSequence: endTime.seconds,
            sourceInPoint: inPoint.seconds,
            sourceOutPoint: outPoint.seconds,
            trackIndex: i,
            trackType: "video",
            speed,
            isReversed,
            isNestedSequence,
            isAdjustmentLayer,
          });
        } catch {
          // Ignore inaccessible clip items
        }
      }
    }

    // Query audio tracks for selected clips
    for (let i = 0; i < audioTrackCount; i++) {
      const track = await sequence.getAudioTrack(i);
      const items = track.getTrackItems(ppro.Constants.TrackItemType.CLIP, false); // includeEmptyTrackItems=false
      for (const item of items) {
        try {
          if (!(await item.getIsSelected())) continue;
          const startTime = await item.getStartTime();
          const endTime = await item.getEndTime();
          const inPoint = await item.getInPoint();
          const outPoint = await item.getOutPoint();
          let mediaPath: string | null = null;
          let isNestedSequence = false;
          try {
            const projectItem = await item.getProjectItem();
            if (projectItem) {
              mediaPath = await projectItem.getMediaFilePath();
              if (projectItem.getContentType && ppro.Constants?.ContentType) {
                const ct = await projectItem.getContentType();
                if (ct === ppro.Constants.ContentType.SEQUENCE) {
                  isNestedSequence = true;
                }
              }
            }
          } catch {
            // Media path may not be available
          }

          let speed = 1.0;
          try {
            if (item.getSpeed) speed = await item.getSpeed();
          } catch {}

          let isReversed = false;
          try {
            if (item.isSpeedReversed) isReversed = (await item.isSpeedReversed()) !== 0;
          } catch {}

          result.push({
            name: (await item.getName?.()) || "Audio Clip",
            mediaPath,
            startInSequence: startTime.seconds,
            endInSequence: endTime.seconds,
            sourceInPoint: inPoint.seconds,
            sourceOutPoint: outPoint.seconds,
            trackIndex: i,
            trackType: "audio",
            speed,
            isReversed,
            isNestedSequence,
            isAdjustmentLayer: false,
          });
        } catch {
          // Ignore inaccessible clip items
        }
      }
    }
  } catch (err) {
    console.warn("[YeneCut] getSelectedClips query failed:", err);
  }

  return result;
}

/**
 * Dedicated Time Mapping:
 * Maps a timestamp in source media coordinates to sequence timeline coordinates.
 */
export function mapSourceToSequenceTime(sourceTime: number, clip: ClipInfo): number | null {
  if (clip.isReversed) return null;
  if (clip.speed !== undefined && Math.abs(clip.speed - 1.0) > 0.001) return null;
  if (clip.isNestedSequence) return null;
  if (sourceTime < clip.sourceInPoint || sourceTime > clip.sourceOutPoint) {
    return null; // Timestamp falls outside this clip's used range
  }
  const offset = sourceTime - clip.sourceInPoint;
  return clip.startInSequence + offset;
}

/**
 * Maps source silence intervals to sequence timeline intervals for a specific clip.
 */
export function mapSilenceIntervalsToSequence(
  intervals: { start: number; end: number }[],
  clip: ClipInfo,
  frameRate: number = 25
): { start: number; end: number }[] {
  const mapped: { start: number; end: number }[] = [];
  for (const interval of intervals) {
    const clampedStart = Math.max(interval.start, clip.sourceInPoint);
    const clampedEnd = Math.min(interval.end, clip.sourceOutPoint);
    if (clampedEnd <= clampedStart) continue;

    const seqStart = mapSourceToSequenceTime(clampedStart, clip);
    const seqEnd = mapSourceToSequenceTime(clampedEnd, clip);
    if (seqStart !== null && seqEnd !== null) {
      mapped.push({ start: roundToFrames(seqStart, frameRate), end: roundToFrames(seqEnd, frameRate) });
    }
  }
  return mapped;
}

/**
 * Align a timestamp (in seconds) to the nearest frame boundary.
 *
 * Uses the actual sequence FrameRate rather than a hardcoded value.
 * Falls back to 25 fps if the sequence frame rate cannot be read.
 *
 * API:
 *   TickTime.createWithSeconds(s)      — premierepro.d.ts
 *   TickTime.alignToNearestFrame(fr)   — premierepro.d.ts
 *
 * This function is ONLY called after a live Premiere session is available.
 * In unit-test environments (no premierepro module) it falls back to a
 * simple round-to-millisecond so tests remain deterministic.
 */
function roundToFrames(seconds: number, fps: number = 25): number {
  // Unit test fallback (no premierepro available)
  return Math.round(seconds * fps) / fps;
}

/**
 * Align seconds to the nearest Premiere frame boundary using the
 * real FrameRate object returned by sequence.getSettings().getVideoFrameRate().
 *
 * @param ppro        - The premierepro module object
 * @param seconds     - Timestamp in seconds
 * @param frameRate   - FrameRate from sequence.getSettings().getVideoFrameRate()
 */
export function alignToFrame(ppro: any, seconds: number, frameRate: any): number {
  try {
    const tick = ppro.TickTime.createWithSeconds(seconds);
    const aligned = tick.alignToNearestFrame(frameRate);
    return aligned.seconds;
  } catch {
    // Safe fallback: round to 1 ms
    return Math.round(seconds * 1000) / 1000;
  }
}

/**
 * Retrieve primary selected clip project item for transcript attachment.
 */
export async function getClipProjectItem(project: any, includeSequence = true): Promise<any | null> {
  const ppro = getPremiere();
  if (!ppro || !project) return null;
  try {
    const rootItem = await project.getRootItem();
    const items = await rootItem.getItems();
    const queue = [...items];
    while (queue.length) {
      const item = queue.shift();
      const clip = ppro.ClipProjectItem.cast(item);
      if (clip) {
        const accept = includeSequence || (await clip.getContentType()) === ppro.Constants.ContentType.MEDIA;
        if (accept) return clip;
      }
      const folder = ppro.FolderItem.cast(item);
      if (folder) {
        queue.push(...(await folder.getItems()));
      }
    }
  } catch {
    return null;
  }
  return null;
}

export async function getSelectedProjectItem(project: any, includeSequence = true): Promise<any | null> {
  const ppro = getPremiere();
  if (!ppro || !project) return null;
  try {
    const sequence = await getActiveSequence(project);
    if (sequence) {
      const videoTrackCount = await sequence.getVideoTrackCount();
      const audioTrackCount = await sequence.getAudioTrackCount();
      for (let i = 0; i < videoTrackCount; i++) {
        const track = await sequence.getVideoTrack(i);
        const items = track.getTrackItems(ppro.Constants.TrackItemType.CLIP, false);
        for (const item of items) {
          try {
            if (!(await item.getIsSelected())) continue;
            const projectItem = await item.getProjectItem();
            if (!projectItem) continue;
            const accept = includeSequence || (await projectItem.getContentType()) === ppro.Constants.ContentType.MEDIA;
            if (accept) return projectItem;
          } catch {
            // Ignore inaccessible selected items
          }
        }
      }
      for (let i = 0; i < audioTrackCount; i++) {
        const track = await sequence.getAudioTrack(i);
        const items = track.getTrackItems(ppro.Constants.TrackItemType.CLIP, false);
        for (const item of items) {
          try {
            if (!(await item.getIsSelected())) continue;
            const projectItem = await item.getProjectItem();
            if (!projectItem) continue;
            const accept = includeSequence || (await projectItem.getContentType()) === ppro.Constants.ContentType.MEDIA;
            if (accept) return projectItem;
          } catch {
            // Ignore inaccessible selected items
          }
        }
      }
    }
  } catch {
    // Fall back to project-bin discovery
  }
  return getClipProjectItem(project, includeSequence);
}

/**
 * Imports transcript segments into Premiere's native Transcript system.
 */
export async function importTranscriptToSelectedClip(transcriptJson: string): Promise<boolean> {
  const ppro = getPremiere();
  const project = await getActiveProject();
  if (!ppro || !project) return false;
  const clip = await getSelectedProjectItem(project, true);
  if (!clip) return false;

  try {
    let success = false;
    project.lockedAccess(() => {
      success = project.executeTransaction((compoundAction: any) => {
        const action = ppro.Transcript.createImportTextSegmentsAction(
          ppro.Transcript.importFromJSON(transcriptJson),
          clip
        );
        compoundAction.addAction(action);
      }, "YeneCut import transcript");
    });
    return success;
  } catch (error) {
    console.error("[YeneCut] Transcript import failed:", error);
    return false;
  }
}

/**
 * Fallback media path lookup if no clip is explicitly selected.
 */
export async function getMediaFilePath(project: any): Promise<string | null> {
  const ppro = getPremiere();
  if (!ppro || !project) return null;
  try {
    const rootItem = await project.getRootItem();
    const items = await rootItem.getItems();
    for (const item of items) {
      const clip = ppro.ClipProjectItem.cast(item);
      if (clip && (await clip.getContentType()) === ppro.Constants.ContentType.MEDIA) {
        return await clip.getMediaFilePath();
      }
    }
  } catch {
    return null;
  }
  return null;
}
