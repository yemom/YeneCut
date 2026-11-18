# Premiere Compatibility

Source of truth:
- https://developer.adobe.com/premiere-pro/uxp/
- https://github.com/AdobeDocs/uxp-premiere-pro-samples

Target host:
- Adobe Premiere Pro 25.1.0 or newer.
- UXP manifest version 5.

Verified API usage:
- `premierepro.Project.getActiveProject`
- `project.getActiveSequence`
- `project.getRootItem`
- `project.lockedAccess`
- `project.executeTransaction`
- `ppro.SequenceEditor.getEditor`
- `sequence.getVideoTrackCount`
- `sequence.getAudioTrackCount`
- `sequence.getVideoTrack`
- `sequence.getAudioTrack`
- `track.getTrackItems`
- `trackItem.getStartTime`
- `trackItem.getEndTime`
- `editor.createRazorTrackAction`
- `editor.createRemoveItemsAction`
- `ppro.Markers.getMarkers`
- `markersOwner.createAddMarkerAction`
- `ppro.Transcript.importFromJSON`
- `ppro.Transcript.createImportTextSegmentsAction`
- `ppro.ClipProjectItem.cast`
- `FolderItem.cast`

Compatibility notes:
- All Premiere calls are wrapped in try/catch where practical.
- The plugin reports unavailable Premiere APIs instead of simulating success.
- Actual behavior of razor/remove/marker/transcript import must be verified in Premiere.
- `createRazorTrackAction` and `createRemoveItemsAction` signatures follow the installed type declarations.
