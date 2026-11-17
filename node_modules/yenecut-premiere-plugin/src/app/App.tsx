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
  SilenceSettings,
  TranscriptSegment,
  validateFont,
} from "../services/local-engine.client";
import { applySilenceCuts, previewSilenceCutsAsMarkers } from "../premiere/timeline.service";
import { getActiveProject, getActiveSequence, getMediaFilePath, getSequenceFrameRate, importTranscriptToSelectedClip, isPremiereAvailable } from "../premiere/premiere.client";

type Tab = "home" | "silence" | "captions" | "fonts" | "presets" | "settings";

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [engineStatus, setEngineStatus] = useState<string>("checking");
  const [projectName, setProjectName] = useState<string>("No project");
  const [sequenceName, setSequenceName] = useState<string>("No sequence");
  const [frameRate, setFrameRate] = useState<string>("-");
  const [mediaPath, setMediaPath] = useState<string>("");
  const [engineUrl, setEngineUrl] = useState<string>(getEngineBaseUrl());
  const [engineToken, setEngineTokenState] = useState<string>(getEngineToken());

  // Silence state
  const [silenceSettings, setSilenceSettings] = useState<SilenceSettings>(defaultSilenceSettings);
  const [silenceRegions, setSilenceRegions] = useState<any[]>([]);
  const [silenceDuration, setSilenceDuration] = useState<number>(0);
  const [removable, setRemovable] = useState<number>(0);
  const [silenceBusy, setSilenceBusy] = useState<boolean>(false);
  const [silenceError, setSilenceError] = useState<string>("");
  const [applyBusy, setApplyBusy] = useState<boolean>(false);
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
    } catch (error) {
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
      const path = await getMediaFilePath(project);
      if (path) setMediaPath(path);
    }
  }

  async function refreshFonts() {
    try {
      setFonts(await listFonts());
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
      const result = await detectSilence(mediaPath, silenceSettings);
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
      const result = await applySilenceCuts(silenceRegions);
      setApplyMessage(result.message);
    } catch (error) {
      setApplyMessage(error instanceof Error ? error.message : "Failed to apply cuts");
    } finally {
      setApplyBusy(false);
    }
  }

  async function previewCuts() {
    const success = await previewSilenceCutsAsMarkers(silenceRegions);
    setApplyMessage(success ? "Preview markers added to the sequence." : "Could not add preview markers.");
  }
  async function runTranscription() {
    if (!mediaPath) {
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

  async function insertIntoPremiere() {
    setCaptionBusy(true);
    setCaptionError("");
    try {
      const transcriptResult = await createPremiereTranscript({ captions, language });
      const success = await importTranscriptToSelectedClip(transcriptResult.json);
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
            <div className="actions">
              <button onClick={() => void refreshContext()}>Refresh project</button>
              <button onClick={() => void checkEngine()}>Check engine</button>
              <button onClick={() => void analyzeAudio(mediaPath).then((r) => setMediaPath(mediaPath))}>Analyze media</button>
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
              <label><input type="checkbox" checked={silenceSettings.preserve_background_music} onChange={(e) => setSilenceSettings({ ...silenceSettings, preserve_background_music: e.target.checked })} /> Preserve background music</label>
              <label><input type="checkbox" checked={silenceSettings.preserve_short_pauses} onChange={(e) => setSilenceSettings({ ...silenceSettings, preserve_short_pauses: e.target.checked })} /> Preserve short pauses</label>
            </div>
            <div className="actions">
              <button disabled={silenceBusy} onClick={() => void runSilenceAnalysis()}>{silenceBusy ? "Analyzing..." : "Analyze Audio"}</button>
              <button disabled={applyBusy || silenceRegions.length === 0} onClick={() => void applyCuts()}>{applyBusy ? "Applying..." : "Apply Selected Cuts"}</button>
              <button disabled={silenceRegions.length === 0} onClick={() => void previewCuts()}>Preview as Markers</button>
            </div>
            {applyMessage && <p>{applyMessage}</p>}
            {silenceError && <p className="error">{silenceError}</p>}
            <div className="results">
              <p>Duration: {silenceDuration.toFixed(2)}s</p>
              <p>Detected cuts: {silenceRegions.length}</p>
              <p>Estimated removable: {removable.toFixed(2)}s</p>
              <ul>
                {silenceRegions.map((region, index) => (
                  <li key={index}>{region.start.toFixed(2)}s - {region.end.toFixed(2)}s ({region.duration.toFixed(2)}s, confidence {(region.confidence * 100).toFixed(0)}%)</li>
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
                  <option value="am">Amharic</option>
                  <option value="en">English</option>
                  <option value="auto">Auto detect</option>
                </select>
              </label>
              <label className="field">
                <span>Model</span>
                <select value={modelSize} onChange={(e) => setModelSize(e.target.value)}>
                  <option value="tiny">tiny</option>
                  <option value="base">base</option>
                  <option value="small">small</option>
                  <option value="medium">medium</option>
                </select>
              </label>
            </div>
            <div className="actions">
              <button disabled={captionBusy} onClick={() => void runTranscription()}>{captionBusy ? "Generating..." : "Generate Captions"}</button>
            </div>
            {captionError && <p className="error">{captionError}</p>}
            <div className="transcript-editor">
              <h3>Transcript</h3>
              {transcript.map((segment, index) => (
                <div className="transcript-row" key={index}>
                  <span>{segment.start.toFixed(2)} - {segment.end.toFixed(2)}</span>
                  <input
                    value={segment.text}
                    onChange={(event) => {
                      const next = [...transcript];
                      next[index] = { ...segment, text: event.target.value };
                      setTranscript(next);
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="captions-preview">
              <h3>Captions ({captions.length})</h3>
              <ul>
                {captions.map((caption, index) => (
                  <li key={index}>{caption.start.toFixed(2)} - {caption.end.toFixed(2)}: {caption.text}</li>
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
            <h2>Font Studio</h2>
            <label className="field">
              <span>Font family</span>
              <select value={selectedFont} onChange={(e) => setSelectedFont(e.target.value)}>
                {fonts.map((font) => (
                  <option key={font.id} value={font.family}>{font.family} ({font.category})</option>
                ))}
              </select>
            </label>
            <div className="font-preview">
              <p style={{ fontFamily: selectedFont, fontSize: 32 }}>{fonts.find((f) => f.family === selectedFont)?.sample_text || "ሰላም ኢትዮጵያ"}</p>
            </div>
            <div className="actions">
              <button disabled={fontBusy} onClick={() => void validateSelectedFont()}>{fontBusy ? "Checking..." : "Validate font"}</button>
            </div>
            {fontValidation && <p>{fontValidation}</p>}
            <div className="font-list">
              {fonts.map((font) => (
                <div className="card" key={font.id}>
                  <strong>{font.family}</strong>
                  <span>{font.category}</span>
                  <span>{font.license}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "presets" && (
          <section>
            <h2>Subtitle Presets</h2>
            <p>YouTube, TikTok, Instagram Reels, Ethiopian news, podcasts, interviews, education, ads, and documentary presets are configured in the engine and typography package.</p>
          </section>
        )}

        {tab === "settings" && (
          <section>
            <h2>Settings</h2>
            <label className="field">
              <span>Engine token</span>
              <input type="password" value={engineToken} onChange={(e) => setEngineTokenState(e.target.value)} />
            </label>
            <div className="actions">
              <button onClick={() => { setEngineBaseUrl(engineUrl); setEngineToken(engineToken); void checkEngine(); }}>Save engine settings</button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
