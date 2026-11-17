const require_premiere_client = require("./premiere.client.js");
// src/premiere/timeline.service.ts
function getPremiere() {
	try {
		return require("premierepro");
	} catch {
		return null;
	}
}
async function applySilenceCuts(regions) {
	const ppro = getPremiere();
	const project = await require_premiere_client.getActiveProject();
	if (!ppro || !project) return {
		success: false,
		message: "Premiere project is not available."
	};
	const sequence = await require_premiere_client.getActiveSequence(project);
	if (!sequence) return {
		success: false,
		message: "Active sequence is not available."
	};
	const sorted = [...regions].sort((a, b) => a.start - b.start);
	const boundaries = Array.from(new Set(sorted.flatMap((region) => [region.start, region.end]))).sort((a, b) => a - b);
	try {
		const editor = ppro.SequenceEditor.getEditor(sequence);
		const videoTrackCount = await sequence.getVideoTrackCount();
		const audioTrackCount = await sequence.getAudioTrackCount();
		project.lockedAccess(() => {
			const actions = [];
			for (const boundary of boundaries) {
				const position = ppro.TickTime.createWithSeconds(boundary);
				for (let i = 0; i < videoTrackCount; i++) actions.push(editor.createRazorTrackAction(ppro.Constants.MediaType.VIDEO, i, position, true, ppro.Constants.MediaType.VIDEO));
				for (let i = 0; i < audioTrackCount; i++) actions.push(editor.createRazorTrackAction(ppro.Constants.MediaType.AUDIO, i, position, true, ppro.Constants.MediaType.VIDEO));
			}
			project.executeTransaction((compoundAction) => {
				actions.forEach((action) => compoundAction.addAction(action));
			}, "YeneCut razor silence boundaries");
		});
		const itemsToRemove = [];
		for (let trackIndex = 0; trackIndex < videoTrackCount; trackIndex++) {
			const items = (await sequence.getVideoTrack(trackIndex)).getTrackItems(ppro.Constants.TrackItemType.CLIP, false);
			for (const item of items) {
				const start = (await item.getStartTime()).seconds;
				const end = (await item.getEndTime()).seconds;
				if (sorted.some((region) => start >= region.start - .001 && end <= region.end + .001)) itemsToRemove.push(item);
			}
		}
		for (let trackIndex = 0; trackIndex < audioTrackCount; trackIndex++) {
			const items = (await sequence.getAudioTrack(trackIndex)).getTrackItems(ppro.Constants.TrackItemType.CLIP, false);
			for (const item of items) {
				const start = (await item.getStartTime()).seconds;
				const end = (await item.getEndTime()).seconds;
				if (sorted.some((region) => start >= region.start - .001 && end <= region.end + .001)) itemsToRemove.push(item);
			}
		}
		if (itemsToRemove.length === 0) return {
			success: true,
			message: "No removable track items were found after razoring."
		};
		let removeSuccess = false;
		const selection = await sequence.getSelection();
		await sequence.clearSelection();
		itemsToRemove.forEach((item) => selection.addItem(item, false));
		sequence.setSelection(selection);
		project.lockedAccess(() => {
			removeSuccess = project.executeTransaction((compoundAction) => {
				const removeAction = editor.createRemoveItemsAction(selection, true, ppro.Constants.MediaType.VIDEO);
				compoundAction.addAction(removeAction);
			}, "YeneCut remove silence");
		});
		return {
			success: removeSuccess,
			message: removeSuccess ? "Silence cuts applied. Use Premiere Undo to restore." : "Premiere did not apply the cuts."
		};
	} catch (error) {
		return {
			success: false,
			message: error instanceof Error ? error.message : "Failed to apply silence cuts."
		};
	}
}
async function previewSilenceCutsAsMarkers(regions) {
	const ppro = getPremiere();
	const project = await require_premiere_client.getActiveProject();
	if (!ppro || !project) return false;
	const sequence = await require_premiere_client.getActiveSequence(project);
	if (!sequence) return false;
	try {
		const markersOwner = await ppro.Markers.getMarkers(sequence);
		project.lockedAccess(() => {
			project.executeTransaction((compoundAction) => {
				regions.forEach((region) => {
					const action = markersOwner.createAddMarkerAction("YeneCut cut", ppro.Marker.MARKER_TYPE_COMMENT, ppro.TickTime.createWithSeconds(region.start), ppro.TickTime.createWithSeconds(Math.max(region.end - region.start, 0)), `Suggested silence cut ${region.start.toFixed(2)}s-${region.end.toFixed(2)}s`);
					compoundAction.addAction(action);
				});
			}, "YeneCut silence preview markers");
		});
		return true;
	} catch {
		return false;
	}
}
exports.applySilenceCuts = applySilenceCuts;
exports.previewSilenceCutsAsMarkers = previewSilenceCutsAsMarkers;

//# sourceMappingURL=timeline.service.js.map