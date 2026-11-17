export interface PremiereProjectHandle {
  name: string;
  guid: string;
}

export interface PremiereSequenceHandle {
  name: string;
  guid: string;
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

export async function importTranscriptToSelectedClip(transcriptJson: string): Promise<boolean> {
  const ppro = getPremiere();
  const project = await getActiveProject();
  if (!ppro || !project) return false;
  const clip = await getClipProjectItem(project, true);
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
  } catch {
    return false;
  }
}

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
