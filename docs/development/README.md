# YeneCut AI

## Prerequisites
- Adobe Premiere Pro 25.1+
- UXP Developer Tool 2.2+
- Node.js LTS
- Python 3.11+
- FFmpeg on PATH

## Plugin
```bash
cd apps/premiere-plugin
npm install
npm run build
```
Load `apps/premiere-plugin/dist/manifest.json` in UDT.

## Engine
```bash
cd apps/ai-engine
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8765
```
