const require_runtime = require("../../_virtual/_rolldown/runtime.js");
const require_index = require("../../node_modules/react/index.js");
const require_local_engine_client = require("../services/local-engine.client.js");
const require_timeline_service = require("../premiere/timeline.service.js");
const require_premiere_client = require("../premiere/premiere.client.js");
const require_jsx_runtime$1 = require("../../node_modules/react/jsx-runtime.js");
// src/app/App.tsx
var import_react = /* @__PURE__ */ require_runtime.__toESM(require_index.default);
var import_jsx_runtime = require_jsx_runtime$1.default;
function App() {
	const [tab, setTab] = (0, import_react.useState)("home");
	const [engineStatus, setEngineStatus] = (0, import_react.useState)("checking");
	const [projectName, setProjectName] = (0, import_react.useState)("No project");
	const [sequenceName, setSequenceName] = (0, import_react.useState)("No sequence");
	const [frameRate, setFrameRate] = (0, import_react.useState)("-");
	const [mediaPath, setMediaPath] = (0, import_react.useState)("");
	const [engineUrl, setEngineUrl] = (0, import_react.useState)(require_local_engine_client.getEngineBaseUrl());
	const [engineToken, setEngineTokenState] = (0, import_react.useState)(require_local_engine_client.getEngineToken());
	const [silenceSettings, setSilenceSettings] = (0, import_react.useState)(require_local_engine_client.defaultSilenceSettings);
	const [silenceRegions, setSilenceRegions] = (0, import_react.useState)([]);
	const [silenceDuration, setSilenceDuration] = (0, import_react.useState)(0);
	const [removable, setRemovable] = (0, import_react.useState)(0);
	const [silenceBusy, setSilenceBusy] = (0, import_react.useState)(false);
	const [silenceError, setSilenceError] = (0, import_react.useState)("");
	const [applyBusy, setApplyBusy] = (0, import_react.useState)(false);
	const [applyMessage, setApplyMessage] = (0, import_react.useState)("");
	const [language, setLanguage] = (0, import_react.useState)("am");
	const [modelSize, setModelSize] = (0, import_react.useState)("small");
	const [transcript, setTranscript] = (0, import_react.useState)([]);
	const [captions, setCaptions] = (0, import_react.useState)([]);
	const [captionBusy, setCaptionBusy] = (0, import_react.useState)(false);
	const [captionError, setCaptionError] = (0, import_react.useState)("");
	const [fonts, setFonts] = (0, import_react.useState)([]);
	const [selectedFont, setSelectedFont] = (0, import_react.useState)("Noto Sans Ethiopic");
	const [fontValidation, setFontValidation] = (0, import_react.useState)("");
	const [fontBusy, setFontBusy] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		refreshContext();
		refreshFonts();
		checkEngine();
	}, []);
	async function checkEngine() {
		try {
			const health = await require_local_engine_client.checkEngineHealth();
			setEngineStatus(health.status === "ok" ? "available" : "unavailable");
		} catch (error) {
			setEngineStatus("unavailable");
		}
	}
	async function refreshContext() {
		if (!require_premiere_client.isPremiereAvailable()) {
			setProjectName("Premiere API unavailable");
			return;
		}
		const project = await require_premiere_client.getActiveProject();
		if (project) {
			setProjectName(project.name || "Active project");
			const sequence = await require_premiere_client.getActiveSequence(project);
			if (sequence) {
				setSequenceName(sequence.name || "Active sequence");
				setFrameRate(await require_premiere_client.getSequenceFrameRate(sequence) || "-");
			}
			const path = await require_premiere_client.getMediaFilePath(project);
			if (path) setMediaPath(path);
		}
	}
	async function refreshFonts() {
		try {
			setFonts(await require_local_engine_client.listFonts());
		} catch (error) {
			setFonts([]);
		}
	}
	async function runSilenceAnalysis() {
		if (!mediaPath) {
			setSilenceError("Select or detect a media file first.");
			return;
		}
		setSilenceBusy(true);
		setSilenceError("");
		try {
			const result = await require_local_engine_client.detectSilence(mediaPath, silenceSettings);
			setSilenceDuration(result.duration);
			setSilenceRegions(result.silence_regions);
			setRemovable(result.estimated_removable_duration);
		} catch (error) {
			setSilenceError(error instanceof Error ? error.message : "Silence analysis failed");
		} finally {
			setSilenceBusy(false);
		}
	}
	async function applyCuts() {
		setApplyBusy(true);
		setApplyMessage("");
		try {
			const result = await require_timeline_service.applySilenceCuts(silenceRegions);
			setApplyMessage(result.message);
		} catch (error) {
			setApplyMessage(error instanceof Error ? error.message : "Failed to apply cuts");
		} finally {
			setApplyBusy(false);
		}
	}
	async function previewCuts() {
		const success = await require_timeline_service.previewSilenceCutsAsMarkers(silenceRegions);
		setApplyMessage(success ? "Preview markers added to the sequence." : "Could not add preview markers.");
	}
	async function runTranscription() {
		if (!mediaPath) return;
		setCaptionBusy(true);
		setCaptionError("");
		try {
			const result = await require_local_engine_client.createTranscriptionJob({
				source_path: mediaPath,
				language,
				model_size: modelSize,
				word_timestamps: true
			});
			setTranscript(result.segments);
			const segmented = await require_local_engine_client.segmentCaptions({
				segments: result.segments,
				max_chars_per_line: 42,
				max_lines: 2,
				min_duration: 1,
				max_duration: 6,
				reading_speed_cps: 17
			});
			setCaptions(segmented.captions);
		} catch (error) {
			setCaptionError(error instanceof Error ? error.message : "Transcription failed");
		} finally {
			setCaptionBusy(false);
		}
	}
	async function insertIntoPremiere() {
		setCaptionBusy(true);
		setCaptionError("");
		try {
			const transcriptResult = await require_local_engine_client.createPremiereTranscript({
				captions,
				language
			});
			const success = await require_premiere_client.importTranscriptToSelectedClip(transcriptResult.json);
			setCaptionError(success ? "Transcript inserted into the selected Premiere clip." : "Could not insert transcript into Premiere.");
		} catch (error) {
			setCaptionError(error instanceof Error ? error.message : "Premiere transcript insertion failed");
		} finally {
			setCaptionBusy(false);
		}
	}
	async function validateSelectedFont() {
		setFontBusy(true);
		try {
			const result = await require_local_engine_client.validateFont({ family: selectedFont });
			setFontValidation(result.message);
		} catch (error) {
			setFontValidation(error instanceof Error ? error.message : "Validation failed");
		} finally {
			setFontBusy(false);
		}
	}
	async function exportSubtitle(format) {
		try {
			const result = await require_local_engine_client.exportCaptions({
				captions,
				format
			});
			const blob = new Blob([result.content], { type: "text/plain" });
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = `yenecut-captions.${format}`;
			anchor.click();
			URL.revokeObjectURL(url);
		} catch (error) {
			setCaptionError(error instanceof Error ? error.message : "Export failed");
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "app",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "app-header",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { children: "YeneCut AI" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Edit Faster. Speak Amharic. Create Without Limits." })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
				className: "tabs",
				children: [
					"home",
					"silence",
					"captions",
					"fonts",
					"presets",
					"settings"
				].map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					className: tab === item ? "active" : "",
					onClick: () => setTab(item),
					children: item
				}, item))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
				className: "panel",
				children: [
					tab === "home" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Dashboard" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "card-grid",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "card",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Project" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: projectName })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "card",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Sequence" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: sequenceName })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "card",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Frame rate" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: frameRate })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "card",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Engine" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: engineStatus })]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "actions",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => void refreshContext(),
									children: "Refresh project"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => void checkEngine(),
									children: "Check engine"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => void require_local_engine_client.analyzeAudio(mediaPath).then((r) => setMediaPath(mediaPath)),
									children: "Analyze media"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Media path" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								value: mediaPath,
								onChange: (event) => setMediaPath(event.target.value),
								placeholder: "C:\\\\path\\\\to\\\\media.mp4"
							})]
						})
					] }),
					tab === "silence" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Silence Cut" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "settings-grid",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "field",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Threshold dB" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										value: silenceSettings.threshold_db,
										onChange: (e) => setSilenceSettings({
											...silenceSettings,
											threshold_db: Number(e.target.value)
										})
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "field",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Min silence (s)" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										step: "0.1",
										value: silenceSettings.min_silence_duration,
										onChange: (e) => setSilenceSettings({
											...silenceSettings,
											min_silence_duration: Number(e.target.value)
										})
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "field",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Min speech (s)" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										step: "0.1",
										value: silenceSettings.min_speech_duration,
										onChange: (e) => setSilenceSettings({
											...silenceSettings,
											min_speech_duration: Number(e.target.value)
										})
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "field",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Pre padding (s)" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										step: "0.05",
										value: silenceSettings.pre_speech_padding,
										onChange: (e) => setSilenceSettings({
											...silenceSettings,
											pre_speech_padding: Number(e.target.value)
										})
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "field",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Post padding (s)" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										step: "0.05",
										value: silenceSettings.post_speech_padding,
										onChange: (e) => setSilenceSettings({
											...silenceSettings,
											post_speech_padding: Number(e.target.value)
										})
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "field",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Sensitivity" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										step: "0.1",
										min: "0",
										max: "1",
										value: silenceSettings.sensitivity,
										onChange: (e) => setSilenceSettings({
											...silenceSettings,
											sensitivity: Number(e.target.value)
										})
									})]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "checkboxes",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: silenceSettings.preserve_breathing,
									onChange: (e) => setSilenceSettings({
										...silenceSettings,
										preserve_breathing: e.target.checked
									})
								}), " Preserve breathing"] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: silenceSettings.preserve_background_music,
									onChange: (e) => setSilenceSettings({
										...silenceSettings,
										preserve_background_music: e.target.checked
									})
								}), " Preserve background music"] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: silenceSettings.preserve_short_pauses,
									onChange: (e) => setSilenceSettings({
										...silenceSettings,
										preserve_short_pauses: e.target.checked
									})
								}), " Preserve short pauses"] })
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "actions",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									disabled: silenceBusy,
									onClick: () => void runSilenceAnalysis(),
									children: silenceBusy ? "Analyzing..." : "Analyze Audio"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									disabled: applyBusy || silenceRegions.length === 0,
									onClick: () => void applyCuts(),
									children: applyBusy ? "Applying..." : "Apply Selected Cuts"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									disabled: silenceRegions.length === 0,
									onClick: () => void previewCuts(),
									children: "Preview as Markers"
								})
							]
						}),
						applyMessage && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: applyMessage }),
						silenceError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "error",
							children: silenceError
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "results",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
									"Duration: ",
									silenceDuration.toFixed(2),
									"s"
								] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: ["Detected cuts: ", silenceRegions.length] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
									"Estimated removable: ",
									removable.toFixed(2),
									"s"
								] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: silenceRegions.map((region, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
									region.start.toFixed(2),
									"s - ",
									region.end.toFixed(2),
									"s (",
									region.duration.toFixed(2),
									"s, confidence ",
									(region.confidence * 100).toFixed(0),
									"%)"
								] }, index)) })
							]
						})
					] }),
					tab === "captions" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Auto Captions" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "settings-grid",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "field",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Language" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									value: language,
									onChange: (e) => setLanguage(e.target.value),
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "am",
											children: "Amharic"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "en",
											children: "English"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "auto",
											children: "Auto detect"
										})
									]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "field",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Model" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									value: modelSize,
									onChange: (e) => setModelSize(e.target.value),
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "tiny",
											children: "tiny"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "base",
											children: "base"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "small",
											children: "small"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "medium",
											children: "medium"
										})
									]
								})]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "actions",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								disabled: captionBusy,
								onClick: () => void runTranscription(),
								children: captionBusy ? "Generating..." : "Generate Captions"
							})
						}),
						captionError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "error",
							children: captionError
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "transcript-editor",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "Transcript" }), transcript.map((segment, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "transcript-row",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
									segment.start.toFixed(2),
									" - ",
									segment.end.toFixed(2)
								] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									value: segment.text,
									onChange: (event) => {
										const next = [...transcript];
										next[index] = {
											...segment,
											text: event.target.value
										};
										setTranscript(next);
									}
								})]
							}, index))]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "captions-preview",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", { children: [
								"Captions (",
								captions.length,
								")"
							] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: captions.map((caption, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
								caption.start.toFixed(2),
								" - ",
								caption.end.toFixed(2),
								": ",
								caption.text
							] }, index)) })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "actions",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => void exportSubtitle("srt"),
									children: "Export SRT"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => void exportSubtitle("vtt"),
									children: "Export VTT"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => void exportSubtitle("ass"),
									children: "Export ASS"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									disabled: captionBusy || captions.length === 0,
									onClick: () => void insertIntoPremiere(),
									children: "Insert into Premiere"
								})
							]
						})
					] }),
					tab === "fonts" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Font Studio" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Font family" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
								value: selectedFont,
								onChange: (e) => setSelectedFont(e.target.value),
								children: fonts.map((font) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
									value: font.family,
									children: [
										font.family,
										" (",
										font.category,
										")"
									]
								}, font.id))
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "font-preview",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								style: {
									fontFamily: selectedFont,
									fontSize: 32
								},
								children: fonts.find((f) => f.family === selectedFont)?.sample_text || "ሰላም ኢትዮጵያ"
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "actions",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								disabled: fontBusy,
								onClick: () => void validateSelectedFont(),
								children: fontBusy ? "Checking..." : "Validate font"
							})
						}),
						fontValidation && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: fontValidation }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "font-list",
							children: fonts.map((font) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "card",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: font.family }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: font.category }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: font.license })
								]
							}, font.id))
						})
					] }),
					tab === "presets" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Subtitle Presets" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "YouTube, TikTok, Instagram Reels, Ethiopian news, podcasts, interviews, education, ads, and documentary presets are configured in the engine and typography package." })] }),
					tab === "settings" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Settings" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "field",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Engine token" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "password",
								value: engineToken,
								onChange: (e) => setEngineTokenState(e.target.value)
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "actions",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => {
									require_local_engine_client.setEngineBaseUrl(engineUrl);
									require_local_engine_client.setEngineToken(engineToken);
									checkEngine();
								},
								children: "Save engine settings"
							})
						})
					] })
				]
			})
		]
	});
}
exports.default = App;

//# sourceMappingURL=App.js.map