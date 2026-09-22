# Live Transcript & Speech-to-Text (STT) — Dokumentasi Fitur

## Overview
Selama merekam, audio yang di-stream ke `Streaming.Service` ditranskripsi secara periodik ("live", bukan
streaming STT asli) dan hasilnya ditampilkan di card baru "Transkrip" pada dashboard. Setelah rekaman
selesai (Stop), transkrip final dihitung ulang dari keseluruhan file dan disimpan permanen di
`Media.Service` sehingga muncul juga di daftar rekaman.

## Arsitektur

```
Browser (MediaRecorder, webm/opus)
   │  binary chunks setiap 500ms
   ▼
Streaming.Service  (/ws/stream)
   │  - tulis tiap chunk ke disk (recording final)
   │  - mirror byte ke buffer memori (cumulativeAudio)
   │  - setiap ~8 detik: snapshot buffer → POST ke Transcription.Service
   │  - kirim balik hasil ke browser lewat WebSocket yang sama:
   │      { "type": "transcript", "recordingId": "...", "text": "...", "isFinal": false }
   ▼ (saat koneksi ditutup)
RecordingCompletedEvent (RabbitMQ/MassTransit)
   ├─► Media.Service        → simpan/replace row Recording (Status=Completed)
   ├─► Notification.Service → buat notifikasi "recording selesai"
   └─► Transcription.Service → baca file penuh dari disk, transkripsi ulang (final),
                                 publish TranscriptGeneratedEvent
                                     │
                                     ▼
                              Media.Service → update Recording.TranscriptText
```

### Internal endpoint: `Transcription.Service` `POST /internal/transcribe`
- Dipanggil oleh `Streaming.Service` (interim, tiap ~8 detik) dan dipakai secara internal oleh
  `RecordingCompletedConsumer` (final, lewat pemanggilan langsung ke `ISpeechToTextProvider`, tanpa HTTP).
- Menerima `multipart/form-data` dengan field file `audio`.
- Diamankan header `X-Internal-Key` (dicocokkan dengan config `Internal:ApiKey`) — endpoint ini
  **tidak** diroutekan lewat Gateway, hanya dipanggil service-to-service.
- Mengembalikan `{ "text": "..." }`.

### `ISpeechToTextProvider` — titik ganti provider STT
- File: `src/Services/Transcription/SpeechToText/ISpeechToTextProvider.cs`
- Implementasi saat ini: `OpenAiWhisperProvider` (`src/Services/Transcription/SpeechToText/OpenAiWhisperProvider.cs`),
  memanggil `POST https://api.openai.com/v1/audio/transcriptions` (`model=whisper-1`, `language=id`).
- Untuk pindah provider (misalnya ke Azure AI Speech nanti): buat kelas baru yang mengimplementasikan
  `ISpeechToTextProvider`, lalu ganti registrasi di `Program.cs`:
  `builder.Services.AddHttpClient<ISpeechToTextProvider, OpenAiWhisperProvider>();` → ganti tipe implementasinya.
  Tidak ada kode lain (endpoint, consumer, Streaming.Service) yang perlu diubah.

## Reset Transcript (tombol "Reset")
- Tombol "Reset" ada di header card "Transkrip" (`DeviceSelection.tsx`), memanggil `setTranscript('')`
  untuk mengosongkan teks transkrip yang tampil di layar.
- Hanya bersih di sisi client (state React) — tidak memanggil endpoint apa pun dan tidak menghapus
  `TranscriptText` yang sudah tersimpan di `Media.Service` untuk rekaman yang sudah selesai.
- Tombol `disabled` selama `isRecording === true`, karena transkrip live akan langsung ditimpa lagi
  oleh update WebSocket berikutnya (setiap ~8 detik) — reset hanya berguna setelah rekaman dihentikan.

## Konfigurasi & Secrets yang wajib diisi

| Service | Key | Keterangan |
|---|---|---|
| Transcription.Service | `OpenAI:ApiKey` (`OpenAI__ApiKey`) | **WAJIB diisi manual** (env var/user-secrets), tidak boleh di-commit. Kosong secara default. |
| Transcription.Service | `OpenAI:Model` (`OpenAI__Model`) | Default `whisper-1`. |
| Transcription.Service | `Internal:ApiKey` (`Internal__ApiKey`) | Shared secret dengan Streaming.Service, sama seperti pola JWT SigningKey yang sudah ada. Ganti nilai dev default sebelum production. |
| Transcription.Service | `Transcription:StoragePath` | Harus menunjuk ke folder yang sama dengan `Streaming:StoragePath` milik Streaming.Service (di docker-compose keduanya di-mount ke volume `recordings-data` pada path `/recordings`). |
| Streaming.Service | `Transcription:InternalBaseUrl` | URL dasar ke endpoint internal Transcription.Service (docker: `http://transcription-service:8080`). |
| Streaming.Service | `Streaming:TranscriptionIntervalSeconds` | Interval polling live transcript, default 8 detik. Bisa diperbesar untuk mengurangi biaya/API call. |

Cara set API key OpenAI untuk `dotnet run` lokal (tanpa docker):
```powershell
cd src/Services/Transcription
dotnet user-secrets set "OpenAI:ApiKey" "sk-..."
```
Untuk docker-compose, set environment variable `OPENAI_API_KEY` di shell sebelum `docker compose up`
(dipetakan ke `OpenAI__ApiKey` di service `transcription-service`).

## Keputusan Desain
- **Bukan streaming STT asli** — OpenAI Whisper API tidak punya endpoint streaming, jadi "live" di sini
  berarti re-transkripsi periodik dari rekaman kumulatif sejauh ini, dikirim balik lewat WebSocket yang
  sudah ada. Transkrip final (paling akurat) dihitung sekali saat rekaman selesai.
- Endpoint transkripsi internal tidak melewati Gateway dan diamankan header shared-secret, bukan JWT,
  karena ini murni komunikasi service-to-service.
- Hanya 1 panggilan transkripsi interim yang boleh berjalan bersamaan per sesi rekaman (di-guard dengan
  `Interlocked.CompareExchange`) agar tidak menumpuk request ke OpenAI saat network/API lambat.

## Known Limitations / Risiko
1. Snapshot audio webm yang dikirim di tengah rekaman adalah potongan kumulatif dari stream
   `MediaRecorder` yang sama (bukan file webm yang di-finalize) — asumsinya tetap bisa didekode
   OpenAI. Jika ternyata gagal di pemakaian nyata, mitigasi: perbesar `TranscriptionIntervalSeconds`
   atau batasi transkripsi live hanya pada boundary chunk MediaRecorder.
2. Biaya & rate limit: setiap sesi rekaman aktif memanggil OpenAI kurang lebih setiap 8 detik. Untuk
   demo tanpa budget API, set interval lebih besar atau kosongkan `OpenAI:ApiKey` (interim akan gagal
   secara diam-diam dan di-skip, tanpa mengganggu perekaman audio itu sendiri).
3. Untuk dev lokal tanpa docker, `Streaming.Service` dan `Transcription.Service` harus dikonfigurasi
   dengan `StoragePath` yang sama (working directory berbeda per proses secara default).

## QA Checklist (manual)
- [ ] `dotnet build` solution BE sukses tanpa error
- [ ] `npm run build` dan `npm run lint` FE sukses tanpa error/warning
- [ ] Login → pilih device → mulai rekam → teks transkrip muncul di card "Transkrip" dalam ~8 detik
- [ ] Stop rekam → daftar rekaman refresh → transkrip final muncul di item rekaman setelah beberapa saat
- [ ] PiP: tombol navbar selalu bisa buka/tutup PiP baik sedang merekam maupun tidak
- [ ] PiP: minimize/pindah tab SAAT merekam → PiP terbuka otomatis
- [ ] PiP: kembali ke tab setelah auto-open → PiP tertutup otomatis
- [ ] PiP: minimize/pindah tab TANPA merekam → PiP TIDAK terbuka otomatis
- [ ] PiP fallback modal bisa di-scroll dengan benar, tidak "jump to top"
- [ ] Login page tampil dengan tema gelap konsisten dengan dashboard
- [ ] Resize browser ke ~1400px/1000px/700px/380px — layout dashboard, transcript card, PiP, dan login
      tetap rapi di semua ukuran
