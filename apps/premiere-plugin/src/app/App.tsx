import React, { useEffect, useState } from "react";
import {
  analyzeAudio,
  checkEngineHealth,
  createPremiereTranscript,
  createTranscriptionJob,
  defaultSilenceSettings,
  detectSilence,
  exportCaptions,
  getEngineBaseUrl,
  getEngineToken,
  listFonts,
  segmentCaptions,
  setEngineBaseUrl,
  setEngineToken,
  SilenceRegion,
  SilenceSettings,
  TranscriptSegment,
  validateFont,
} from "../services/local-engine.client";
import {
  applySilenceCuts,
  previewSilenceCutsAsMarkers,
  clearPreviewMarkers,
  CutRegion,
} from "../premiere/timeline.service";
import {
  getActiveProject,
  getActiveSequence,
  getSelectedClips,
  getMediaFilePath,
  getSequenceFrameRate,
  importTranscriptToSelectedClip,
  isPremiereAvailable,
  ClipInfo,
} from "../premiere/premiere.client";

type Tab = "home" | "silence" | "captions" | "fonts" | "presets" | "settings";

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [engineStatus, setEngineStatus] = useState<string>("checking");
  const [projectName, setProjectName] = useState<string>("No project");
  const [sequenceName, setSequenceName] = useState<string>("No sequence");
  const [frameRate, setFrameRate] = useState<string>("-");
  const [mediaPath, setMediaPath] = useState<string>("");
  const [selectedClip, setSelectedClip] = useState<ClipInfo | null>(null);
  const [engineUrl, setEngineUrl] = useState<string>(getEngineBaseUrl());
  const [engineToken, setEngineTokenState] = useState<string>(getEngineToken());

  // Silence state
  const [silenceSettings, setSilenceSettings] = useState<SilenceSettings>(defaultSilenceSettings);
  const [silenceRegions, setSilenceRegions] = useState<SilenceRegion[]>([]);
  const [silenceDuration, setSilenceDuration] = useState<number>(0);
  const [removable, setRemovable] = useState<number>(0);
  const [silenceBusy, setSilenceBusy] = useState<boolean>(false);
  const [silenceError, setSilenceError] = useState<string>("");
  const [applyBusy, setApplyBusy] = useState<boolean>(false);
  const [confirmingApply, setConfirmingApply] = useState<boolean>(false);
  const [applyMessage, setApplyMessage] = useState<string>("");

  // Caption state
  const [language, setLanguage] = useState<string>("am");
  const [modelSize, setModelSize] = useState<string>("small");
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [captions, setCaptions] = useState<{ start: number; end: number; text: string }[]>([]);
  const [captionBusy, setCaptionBusy] = useState<boolean>(false);
  const [captionError, setCaptionError] = useState<string>("");

  // Font state
  const [fonts, setFonts] = useState<any[]>([]);
  const [selectedFont, setSelectedFont] = useState<string>("Noto Sans Ethiopic");
  const [fontValidation, setFontValidation] = useState<string>("");
  const [fontBusy, setFontBusy] = useState<boolean>(false);

  useEffect(() => {
    void refreshContext();
    void refreshFonts();
    void checkEngine();
  }, []);

  async function checkEngine() {
    try {
      const health = await checkEngineHealth();
      setEngineStatus(health.status === "ok" ? "available" : "unavailable");
    } catch {
      setEngineStatus("unavailable");
    }
  }

  async function refreshContext() {
    if (!isPremiereAvailable()) {
      setProjectName("Premiere API unavailable");
      return;
    }
    const project = await getActiveProject();
    if (project) {
      setProjectName(project.name || "Active project");
      const sequence = await getActiveSequence(project);
      if (sequence) {
        setSequenceName(sequence.name || "Active sequence");
        setFrameRate((await getSequenceFrameRate(sequence)) || "-");
      }
      // Query selected sequence clip first (target-aware editing)
      const selectedClips = await getSelectedClips();
      if (selectedClips.length > 0) {
        setSelectedClip(selectedClips[0]);
        if (selectedClips[0].mediaPath) {
          setMediaPath(selectedClips[0].mediaPath);
          return;
        }
      }
      // Fallback: bin media file
      const path = await getMediaFilePath(project);
      if (path) setMediaPath(path);
    }
  }

  async function refreshFonts() {
    try {
      setFonts(await listFonts());
    } catch {
      setFonts([]);
    }
  }

  async function runSilenceAnalysis() {
    if (!mediaPath) {
      setSilenceError("Select a clip on the sequence or enter a media path.");
      return;
    }
    setSilenceBusy(true);
    setSilenceError("");
    try {
      const result = await detectSilence(mediaPath, silenceSettings, true);
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
    if (!confirmingApply) {
      setConfirmingApply(true);
      setApplyMessage("⚠️ Please confirm: This operation will cut silence from the selected clip. Click 'Confirm Apply Cuts' to proceed, or choose 'Preview as Markers' first.");
      return;
    }
    setConfirmingApply(false);
    setApplyBusy(true);
    setApplyMessage("");
    try {
      const result = await applySilenceCuts(silenceRegions, selectedClip);
      setApplyMessage(result.message);
    } catch (error) {
      setApplyMessage(error instanceof Error ? error.message : "Failed to apply cuts");
    } finally {
      setApplyBusy(false);
    }
  }

  async function previewCuts() {
    const success = await previewSilenceCutsAsMarkers(silenceRegions, selectedClip);
    setApplyMessage(
      success
        ? "Preview markers added to sequence. Unrelated tracks are untouched."
        : "Could not add preview markers."
    );
  }

  async function clearMarkers() {
    const success = await clearPreviewMarkers();
    setApplyMessage(success ? "Preview markers cleared." : "Could not clear markers.");
  }

  async function runTranscription() {
    if (!mediaPath) {
      setCaptionError("Please select a media clip first.");
      return;
    }
    setCaptionBusy(true);
    setCaptionError("");
    try {
      const result = await createTranscriptionJob({
        source_path: mediaPath,
        language,
        model_size: modelSize,
        word_timestamps: true,
      });
      setTranscript(result.segments);
      const segmented = await segmentCaptions({
        segments: result.segments,
        max_chars_per_line: 42,
        max_lines: 2,
        min_duration: 1,
        max_duration: 6,
        reading_speed_cps: 17,
      });
      setCaptions(segmented.captions);
    } catch (error) {
      setCaptionError(error instanceof Error ? error.message : "Transcription failed");
    } finally {
      setCaptionBusy(false);
    }
  }

  // Reactive transcript update: keep captions synchronized when transcript text is edited
  async function updateTranscriptText(index: number, newText: string) {
    const nextTranscript = [...transcript];
    nextTranscript[index] = { ...nextTranscript[index], text: newText };
    setTranscript(nextTranscript);

    // Re-segment captions using the updated text so exports always match edits
    try {
      const segmented = await segmentCaptions({
        segments: nextTranscript,
        max_chars_per_line: 42,
        max_lines: 2,
        min_duration: 1,
        max_duration: 6,
        reading_speed_cps: 17,
      });
      setCaptions(segmented.captions);
    } catch {
      // Fallback: update caption at matching time window
      setCaptions((prev) =>
        prev.map((c) =>
          c.start >= nextTranscript[index].start && c.end <= nextTranscript[index].end
            ? { ...c, text: newText }
            : c
        )
      );
    }
  }

  async function insertIntoPremiere() {
    setCaptionBusy(true);
    setCaptionError("");
    try {
      const transcriptResult = await createPremiereTranscript({
        captions: captions.map((c) => ({
          start: c.start,
          end: c.end,
          text: c.text,
        })),
        language,
      });
      const success = await importTranscriptToSelectedClip(transcriptResult.json);
      setCaptionError(
        success
          ? "Transcript inserted into selected Premiere clip."
          : "Native import not supported on this clip. Use 'Export SRT' and import into Premiere Text panel."
      );
    } catch (error) {
      setCaptionError(error instanceof Error ? error.message : "Premiere transcript insertion failed");
    } finally {
      setCaptionBusy(false);
    }
  }

  async function validateSelectedFont() {
    setFontBusy(true);
    try {
      const result = await validateFont({ family: selectedFont });
      setFontValidation(result.message);
    } catch (error) {
      setFontValidation(error instanceof Error ? error.message : "Validation failed");
    } finally {
      setFontBusy(false);
    }
  }

  async function exportSubtitle(format: "srt" | "vtt" | "ass") {
    try {
      const result = await exportCaptions({ captions, format });
      const blob = new Blob([result.content], { type: "text/plain;charset=utf-8" });
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

  return (
    <div className="app">
      <header className="app-header">
        <h1>YeneCut AI</h1>
        <p>Edit Faster. Speak Amharic. Create Without Limits.</p>
      </header>
      <nav className="tabs">
        {(["home", "silence", "captions", "fonts", "presets", "settings"] as Tab[]).map((item) => (
          <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>
            {item}
          </button>
        ))}
      </nav>
      <main className="panel">
        {tab === "home" && (
          <section>
            <h2>Dashboard</h2>
            <div className="card-grid">
              <div className="card"><span>Project</span><strong>{projectName}</strong></div>
              <div className="card"><span>Sequence</span><strong>{sequenceName}</strong></div>
              <div className="card"><span>Frame rate</span><strong>{frameRate}</strong></div>
              <div className="card"><span>Engine</span><strong>{engineStatus}</strong></div>
            </div>
            {selectedClip && (
              <div className="clip-info-banner">
                <p>
                  <strong>Target Clip:</strong> {selectedClip.name} ({selectedClip.trackType.toUpperCase()} Track {selectedClip.trackIndex + 1}) | Timeline: {selectedClip.startInSequence.toFixed(2)}s – {selectedClip.endInSequence.toFixed(2)}s
                </p>
              </div>
            )}
            <div className="actions">
              <button onClick={() => void refreshContext()}>Refresh project</button>
              <button onClick={() => void checkEngine()}>Check engine</button>
              <button onClick={() => void analyzeAudio(mediaPath).then(() => setMediaPath(mediaPath))}>Analyze media</button>
            </div>
            <label className="field">
              <span>Media path</span>
              <input value={mediaPath} onChange={(event) => setMediaPath(event.target.value)} placeholder="C:\\path\\to\\media.mp4" />
            </label>
          </section>
        )}

        {tab === "silence" && (
          <section>
            <h2>Silence Cut</h2>
            <div className="settings-grid">
              <label className="field"><span>Threshold dB</span><input type="number" value={silenceSettings.threshold_db} onChange={(e) => setSilenceSettings({ ...silenceSettings, threshold_db: Number(e.target.value) })} /></label>
              <label className="field"><span>Min silence (s)</span><input type="number" step="0.1" value={silenceSettings.min_silence_duration} onChange={(e) => setSilenceSettings({ ...silenceSettings, min_silence_duration: Number(e.target.value) })} /></label>
              <label className="field"><span>Min speech (s)</span><input type="number" step="0.1" value={silenceSettings.min_speech_duration} onChange={(e) => setSilenceSettings({ ...silenceSettings, min_speech_duration: Number(e.target.value) })} /></label>
              <label className="field"><span>Pre padding (s)</span><input type="number" step="0.05" value={silenceSettings.pre_speech_padding} onChange={(e) => setSilenceSettings({ ...silenceSettings, pre_speech_padding: Number(e.target.value) })} /></label>
              <label className="field"><span>Post padding (s)</span><input type="number" step="0.05" value={silenceSettings.post_speech_padding} onChange={(e) => setSilenceSettings({ ...silenceSettings, post_speech_padding: Number(e.target.value) })} /></label>
              <label className="field"><span>Sensitivity</span><input type="number" step="0.1" min="0" max="1" value={silenceSettings.sensitivity} onChange={(e) => setSilenceSettings({ ...silenceSettings, sensitivity: Number(e.target.value) })} /></label>
            </div>
            <div className="checkboxes">
              <label><input type="checkbox" checked={silenceSettings.preserve_breathing} onChange={(e) => setSilenceSettings({ ...silenceSettings, preserve_breathing: e.target.checked })} /> Preserve breathing</label>
              <label><input type="checkbox" checked={silenceSettings.preserve_background_music} onChange={(e) => setSilenceSettings({ ...silenceSettings, preserve_background_music: e.target.checked })} /> Protect background music & B-roll</label>
              <label><input type="checkbox" checked={silenceSettings.preserve_short_pauses} onChange={(e) => setSilenceSettings({ ...silenceSettings, preserve_short_pauses: e.target.checked })} /> Preserve short pauses</label>
            </div>
            <div className="actions">
              <button disabled={silenceBusy} onClick={() => void runSilenceAnalysis()}>{silenceBusy ? "Analyzing..." : "Analyze Audio"}</button>
              <button
                disabled={applyBusy || silenceRegions.length === 0}
                className={confirmingApply ? "confirm-action" : ""}
                onClick={() => void applyCuts()}
              >
                {applyBusy ? "Applying..." : confirmingApply ? "Confirm Apply Cuts" : "Apply Selected Cuts"}
              </button>
              {confirmingApply && (
                <button onClick={() => { setConfirmingApply(false); setApplyMessage(""); }}>Cancel</button>
              )}
              <button disabled={silenceRegions.length === 0} onClick={() => void previewCuts()}>Preview as Markers</button>
              <button onClick={() => void clearMarkers()}>Clear Markers</button>
            </div>
            {applyMessage && <p className="status-message">{applyMessage}</p>}
            {silenceError && <p className="error">{silenceError}</p>}
            <div className="results">
              <p>Duration: {silenceDuration.toFixed(2)}s | Detected cuts: {silenceRegions.length} | Removable: {removable.toFixed(2)}s</p>
              <ul>
                {silenceRegions.map((region, index) => (
                  <li key={index}>{region.start.toFixed(2)}s – {region.end.toFixed(2)}s ({region.duration.toFixed(2)}s, confidence {(region.confidence * 100).toFixed(0)}%)</li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {tab === "captions" && (
          <section>
            <h2>Auto Captions</h2>
            <div className="settings-grid">
              <label className="field">
                <span>Language</span>
                <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                  <option value="am">Amharic (አማርኛ)</option>
                  <option value="en">English</option>
                  <option value="auto">Auto detect</option>
                </select>
              </label>
              <label className="field">
                <span>Whisper Model</span>
                <select value={modelSize} onChange={(e) => setModelSize(e.target.value)}>
                  <option value="tiny">tiny (fastest)</option>
                  <option value="base">base</option>
                  <option value="small">small (recommended)</option>
                  <option value="medium">medium (highest accuracy)</option>
                </select>
              </label>
            </div>
            <div className="actions">
              <button disabled={captionBusy} onClick={() => void runTranscription()}>{captionBusy ? "Transcribing..." : "Generate Captions"}</button>
            </div>
            {captionError && <p className="error">{captionError}</p>}
            <div className="transcript-editor">
              <h3>Transcript (Interactive Editor)</h3>
              {transcript.map((segment, index) => (
                <div className="transcript-row" key={index}>
                  <span>{segment.start.toFixed(2)} – {segment.end.toFixed(2)}</span>
                  <input
                    value={segment.text}
                    onChange={(event) => void updateTranscriptText(index, event.target.value)}
                  />
                </div>
              ))}
            </div>
            <div className="captions-preview">
              <h3>Captions Preview ({captions.length} segments)</h3>
              <ul>
                {captions.map((caption, index) => (
                  <li key={index}>{caption.start.toFixed(2)} – {caption.end.toFixed(2)}: {caption.text}</li>
                ))}
              </ul>
            </div>
            <div className="actions">
              <button onClick={() => void exportSubtitle("srt")}>Export SRT</button>
              <button onClick={() => void exportSubtitle("vtt")}>Export VTT</button>
              <button onClick={() => void exportSubtitle("ass")}>Export ASS</button>
              <button disabled={captionBusy || captions.length === 0} onClick={() => void insertIntoPremiere()}>Insert into Premiere</button>
            </div>
          </section>
        )}

        {tab === "fonts" && (
          <section>
            <h2>Ethiopian Font Studio</h2>
            <label className="field">
              <span>Font Family</span>
              <select value={selectedFont} onChange={(e) => setSelectedFont(e.target.value)}>
                {fonts.map((font) => (
                  <option key={font.id} value={font.family}>{font.family} ({font.category})</option>
                ))}
              </select>
            </label>
            <div className="font-preview">
              <p style={{ fontFamily: selectedFont, fontSize: 32 }}>
                {fonts.find((f) => f.family === selectedFont)?.sample_text || "ሰላም ኢትዮጵያ — YeneCut AI"}
              </p>
            </div>
            <div className="actions">
              <button disabled={fontBusy} onClick={() => void validateSelectedFont()}>{fontBusy ? "Validating..." : "Validate in Premiere"}</button>
            </div>
            {fontValidation && <p className="status-message">{fontValidation}</p>}
            <div className="font-list">
              {fonts.map((font) => (
                <div className="card" key={font.id}>
                  <strong>{font.family}</strong>
                  <span>Category: {font.category}</span>
                  <span>License: {font.license}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "presets" && (
          <section>
            <h2>Subtitle Presets</h2>
            <p>Configured templates for YouTube, TikTok, Instagram Reels, Ethiopian news, podcasts, interviews, education, and documentary workflows.</p>
          </section>
        )}

        {tab === "settings" && (
          <section>
            <h2>Settings & Engine Security</h2>
            <label className="field">
              <span>Engine URL</span>
              <input value={engineUrl} onChange={(e) => setEngineUrl(e.target.value)} />
            </label>
            <label className="field">
              <span>Engine Token (Pairing Secret)</span>
              <input type="password" value={engineToken} onChange={(e) => setEngineTokenState(e.target.value)} />
            </label>
            <div className="actions">
              <button onClick={() => { setEngineBaseUrl(engineUrl); setEngineToken(engineToken); void checkEngine(); }}>Save & Connect</button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
