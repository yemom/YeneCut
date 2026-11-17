import { getActiveProject, getActiveSequence } from "./premiere.client";

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

export async function applySilenceCuts(regions: CutRegion[]): Promise<{ success: boolean; message: string }> {
  const ppro = getPremiere();
  const project = await getActiveProject();
  if (!ppro || !project) return { success: false, message: "Premiere project is not available." };
  const sequence = await getActiveSequence(project);
  if (!sequence) return { success: false, message: "Active sequence is not available." };

  const sorted = [...regions].sort((a, b) => a.start - b.start);
  const boundaries = Array.from(new Set(sorted.flatMap((region) => [region.start, region.end]))).sort((a, b) => a - b);

  try {
    const editor = ppro.SequenceEditor.getEditor(sequence);
    const videoTrackCount = await sequence.getVideoTrackCount();
    const audioTrackCount = await sequence.getAudioTrackCount();

    // Razor every affected track at each boundary.
    project.lockedAccess(() => {
      const actions: any[] = [];
      for (const boundary of boundaries) {
        const position = ppro.TickTime.createWithSeconds(boundary);
        for (let i = 0; i < videoTrackCount; i++) {
          actions.push(editor.createRazorTrackAction(ppro.Constants.MediaType.VIDEO, i, position, true, ppro.Constants.MediaType.VIDEO));
        }
        for (let i = 0; i < audioTrackCount; i++) {
          actions.push(editor.createRazorTrackAction(ppro.Constants.MediaType.AUDIO, i, position, true, ppro.Constants.MediaType.VIDEO));
        }
      }
      project.executeTransaction((compoundAction: any) => {
        actions.forEach((action) => compoundAction.addAction(action));
      }, "YeneCut razor silence boundaries");
    });

    // Select all track items that fall completely inside a proposed cut region.
    const itemsToRemove: any[] = [];
    for (let trackIndex = 0; trackIndex < videoTrackCount; trackIndex++) {
      const track = await sequence.getVideoTrack(trackIndex);
      const items = track.getTrackItems(ppro.Constants.TrackItemType.CLIP, false);
      for (const item of items) {
        const start = (await item.getStartTime()).seconds;
        const end = (await item.getEndTime()).seconds;
        if (sorted.some((region) => start >= region.start - 0.001 && end <= region.end + 0.001)) {
          itemsToRemove.push(item);
        }
      }
    }
    for (let trackIndex = 0; trackIndex < audioTrackCount; trackIndex++) {
      const track = await sequence.getAudioTrack(trackIndex);
      const items = track.getTrackItems(ppro.Constants.TrackItemType.CLIP, false);
      for (const item of items) {
        const start = (await item.getStartTime()).seconds;
        const end = (await item.getEndTime()).seconds;
        if (sorted.some((region) => start >= region.start - 0.001 && end <= region.end + 0.001)) {
          itemsToRemove.push(item);
        }
      }
    }

    if (itemsToRemove.length === 0) {
      return { success: true, message: "No removable track items were found after razoring." };
    }

    let removeSuccess = false;
    const selection = await sequence.getSelection();
    await sequence.clearSelection();
    itemsToRemove.forEach((item) => selection.addItem(item, false));
    sequence.setSelection(selection);

    project.lockedAccess(() => {
      removeSuccess = project.executeTransaction((compoundAction: any) => {
        const removeAction = editor.createRemoveItemsAction(selection, true, ppro.Constants.MediaType.VIDEO);
        compoundAction.addAction(removeAction);
      }, "YeneCut remove silence");
    });

    return { success: removeSuccess, message: removeSuccess ? "Silence cuts applied. Use Premiere Undo to restore." : "Premiere did not apply the cuts." };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Failed to apply silence cuts." };
  }
}

export async function previewSilenceCutsAsMarkers(regions: CutRegion[]): Promise<boolean> {
  const ppro = getPremiere();
  const project = await getActiveProject();
  if (!ppro || !project) return false;
  const sequence = await getActiveSequence(project);
  if (!sequence) return false;
  try {
    const markersOwner = await ppro.Markers.getMarkers(sequence);
    project.lockedAccess(() => {
      project.executeTransaction((compoundAction: any) => {
        regions.forEach((region) => {
          const action = markersOwner.createAddMarkerAction(
            "YeneCut cut",
            ppro.Marker.MARKER_TYPE_COMMENT,
            ppro.TickTime.createWithSeconds(region.start),
            ppro.TickTime.createWithSeconds(Math.max(region.end - region.start, 0)),
            `Suggested silence cut ${region.start.toFixed(2)}s-${region.end.toFixed(2)}s`
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
