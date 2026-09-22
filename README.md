# Binus Meeting Transcription - Frontend

React + Vite + TypeScript app that captures audio from an external Bluetooth microphone
(paired at the OS level) and streams it to the `Streaming.Service` backend over WebSocket.

## How Bluetooth mic capture works

1. Pair your Bluetooth microphone/headset in Windows/macOS/Android Bluetooth settings first
   (this app does **not** use the Web Bluetooth API — audio profiles like A2DP/HFP aren't
   accessible through it).
2. In the app, `navigator.mediaDevices.enumerateDevices()` lists it as a normal audio input.
3. Selecting it calls `getUserMedia({ audio: { deviceId } })` and starts a level meter.
4. "Mulai Rekam" starts a `MediaRecorder` (webm/opus, 500ms chunks) and streams each chunk
   over a WebSocket to `Streaming.Service` (`/ws/stream`).

## Key files

- `src/hooks/useAudioCapture.ts` — device enumeration, level monitoring, MediaRecorder control
- `src/services/websocketClient.ts` — WebSocket client for streaming chunks to the backend
- `src/pages/DeviceSelection.tsx` — UI to pick a mic, start/stop streaming

## Setup

### Opsi 1: Menjalankan via Docker Compose (Rekomendasi)
Dari folder backend `infra`:
```powershell
cd "../binus-meeting-transcription-be/infra"
docker compose up -d
```
Aplikasi frontend akan langsung dapat diakses di http://localhost:5173.

### Opsi 2: Menjalankan secara mandiri (Local Dev)
```powershell
npm install
copy .env.example .env
npm run dev
```

`VITE_API_BASE_URL` biarkan kosong saat local dev supaya request `/api` lewat proxy Vite ke Gateway (`http://localhost:5000`). Kalau diisi `http://localhost:5000`, browser akan memanggil gateway langsung dan bisa kena CORS.
`VITE_STREAMING_WS_URL` mengarah ke Streaming Service WebSocket (`ws://localhost:5003`).

## Autentikasi

Aplikasi sudah dilengkapi halaman Login dan Register di http://localhost:5173. Token JWT otomatis disimpan ke `localStorage`.
