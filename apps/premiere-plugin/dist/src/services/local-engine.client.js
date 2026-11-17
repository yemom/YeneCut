// src/services/local-engine.client.ts
var defaultSilenceSettings = {
	threshold_db: -40,
	min_silence_duration: .5,
	min_speech_duration: .25,
	pre_speech_padding: .1,
	post_speech_padding: .1,
	noise_tolerance: .05,
	sensitivity: .5,
	preserve_breathing: true,
	preserve_background_music: true,
	preserve_short_pauses: true,
	preview_mode: true
};
var DEFAULT_ENGINE_URL = "http://127.0.0.1:8765";
var DEFAULT_TOKEN = "yenecut-dev-token";
function getEngineBaseUrl() {
	return localStorage.getItem("yenecut.engineUrl") || DEFAULT_ENGINE_URL;
}
function getEngineToken() {
	return localStorage.getItem("yenecut.engineToken") || DEFAULT_TOKEN;
}
function setEngineBaseUrl(url) {
	localStorage.setItem("yenecut.engineUrl", url);
}
function setEngineToken(token) {
	localStorage.setItem("yenecut.engineToken", token);
}
async function request(path, options = {}) {
	const response = await fetch(`${getEngineBaseUrl()}${path}`, {
		...options,
		headers: {
			"Content-Type": "application/json",
			"X-YeneCut-Token": getEngineToken(),
			...options.headers || {}
		}
	});
	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Engine request failed (${response.status}): ${text}`);
	}
	return await response.json();
}
async function checkEngineHealth() {
	const response = await fetch(`${getEngineBaseUrl()}/health`, { headers: { "X-YeneCut-Token": getEngineToken() } });
	if (!response.ok) throw new Error(`Engine unavailable: ${response.status}`);
	return response.json();
}
async function analyzeAudio(sourcePath) {
	return request("/api/v1/audio/analyze", {
		method: "POST",
		body: JSON.stringify({ source_path: sourcePath })
	});
}
async function detectSilence(sourcePath, settings) {
	return request(`/api/v1/silence/detect?sync=true`, {
		method: "POST",
		body: JSON.stringify({
			source_path: sourcePath,
			settings
		})
	});
}
async function createTranscriptionJob(payload) {
	return request("/api/v1/transcription/jobs?sync=true", {
		method: "POST",
		body: JSON.stringify(payload)
	});
}
async function segmentCaptions(payload) {
	return request("/api/v1/captions/segment", {
		method: "POST",
		body: JSON.stringify(payload)
	});
}
async function exportCaptions(payload) {
	return request("/api/v1/captions/export", {
		method: "POST",
		body: JSON.stringify(payload)
	});
}
async function listFonts() {
	return (await request("/api/v1/fonts")).fonts;
}
async function createPremiereTranscript(payload) {
	return request("/api/v1/captions/premiere-transcript", {
		method: "POST",
		body: JSON.stringify(payload)
	});
}
async function validateFont(payload) {
	return request("/api/v1/fonts/validate", {
		method: "POST",
		body: JSON.stringify(payload)
	});
}
exports.analyzeAudio = analyzeAudio;
exports.checkEngineHealth = checkEngineHealth;
exports.createPremiereTranscript = createPremiereTranscript;
exports.createTranscriptionJob = createTranscriptionJob;
exports.defaultSilenceSettings = defaultSilenceSettings;
exports.detectSilence = detectSilence;
exports.exportCaptions = exportCaptions;
exports.getEngineBaseUrl = getEngineBaseUrl;
exports.getEngineToken = getEngineToken;
exports.listFonts = listFonts;
exports.segmentCaptions = segmentCaptions;
exports.setEngineBaseUrl = setEngineBaseUrl;
exports.setEngineToken = setEngineToken;
exports.validateFont = validateFont;

//# sourceMappingURL=local-engine.client.js.map