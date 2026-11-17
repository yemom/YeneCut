// src/premiere/premiere.client.ts
function getPremiere() {
	try {
		return require("premierepro");
	} catch {
		return null;
	}
}
function isPremiereAvailable() {
	return getPremiere() !== null;
}
async function getActiveProject() {
	const ppro = getPremiere();
	if (!ppro) return null;
	try {
		return await ppro.Project.getActiveProject();
	} catch {
		return null;
	}
}
async function getActiveSequence(project) {
	if (!project) return null;
	try {
		return await project.getActiveSequence();
	} catch {
		return null;
	}
}
async function getSequenceFrameRate(sequence) {
	if (!sequence) return null;
	try {
		const frameRate = (await sequence.getSettings()).getVideoFrameRate();
		return String(frameRate.value);
	} catch {
		return null;
	}
}
async function getClipProjectItem(project, includeSequence = true) {
	const ppro = getPremiere();
	if (!ppro || !project) return null;
	try {
		const queue = [...await (await project.getRootItem()).getItems()];
		while (queue.length) {
			const item = queue.shift();
			const clip = ppro.ClipProjectItem.cast(item);
			if (clip) {
				if (includeSequence || await clip.getContentType() === ppro.Constants.ContentType.MEDIA) return clip;
			}
			const folder = ppro.FolderItem.cast(item);
			if (folder) queue.push(...await folder.getItems());
		}
	} catch {
		return null;
	}
	return null;
}
async function importTranscriptToSelectedClip(transcriptJson) {
	const ppro = getPremiere();
	const project = await getActiveProject();
	if (!ppro || !project) return false;
	const clip = await getClipProjectItem(project, true);
	if (!clip) return false;
	try {
		let success = false;
		project.lockedAccess(() => {
			success = project.executeTransaction((compoundAction) => {
				const action = ppro.Transcript.createImportTextSegmentsAction(ppro.Transcript.importFromJSON(transcriptJson), clip);
				compoundAction.addAction(action);
			}, "YeneCut import transcript");
		});
		return success;
	} catch {
		return false;
	}
}
async function getMediaFilePath(project) {
	const ppro = getPremiere();
	if (!ppro || !project) return null;
	try {
		const items = await (await project.getRootItem()).getItems();
		for (const item of items) {
			const clip = ppro.ClipProjectItem.cast(item);
			if (clip && await clip.getContentType() === ppro.Constants.ContentType.MEDIA) return await clip.getMediaFilePath();
		}
	} catch {
		return null;
	}
	return null;
}
exports.getActiveProject = getActiveProject;
exports.getActiveSequence = getActiveSequence;
exports.getClipProjectItem = getClipProjectItem;
exports.getMediaFilePath = getMediaFilePath;
exports.getSequenceFrameRate = getSequenceFrameRate;
exports.importTranscriptToSelectedClip = importTranscriptToSelectedClip;
exports.isPremiereAvailable = isPremiereAvailable;

//# sourceMappingURL=premiere.client.js.map