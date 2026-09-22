# Manajemen Rekaman — Hapus Rekaman (Delete Recording)

## Overview
Menambahkan kemampuan untuk menghapus rekaman suara yang sudah selesai (`Completed`) langsung dari
daftar rekaman di dashboard, baik dari sisi data (`Media.Service`) maupun file fisiknya
(`Streaming.Service`).

## Alur

```
Browser (RecordingsList.tsx)
   │  klik tombol hapus (🗑) pada item rekaman Completed
   │  confirm() dialog
   ▼
DELETE {API_BASE_URL}/api/recordings/{recordingId}   (lewat Gateway, tanpa auth header — lihat catatan di bawah)
   ▼
Media.Service
   │  hapus row Recording dari MediaDbContext
   │  publish RecordingDeletedEvent (RabbitMQ/MassTransit)
   ▼
Streaming.Service — RecordingDeletedConsumer
   └─► hapus file {StoragePath}/{recordingId}.webm dari disk, jika ada
```

## Endpoint

`DELETE /api/recordings/{recordingId:guid}` (Media.Service, diteruskan Gateway lewat route
`/api/recordings/{**catch-all}` yang sudah ada, tidak perlu perubahan config Gateway)

- 204 No Content — berhasil dihapus.
- 404 Not Found — `recordingId` tidak ditemukan di database.

Implementasi: [src/Services/Media/Program.cs](../../../Backend/binus-meeting-transcription-be/src/Services/Media/Program.cs)
(repo backend terpisah — path relatif di atas hanya indikatif, sesuaikan dengan lokasi lokal repo BE).

## Event contract

`RecordingDeletedEvent(Guid RecordingId, Guid UserId, string FilePath, DateTime DeletedAtUtc)` —
`src/Shared/Contracts/RecordingDeletedEvent.cs`, mengikuti pola `RecordingCompletedEvent` yang sudah ada.

Dikonsumsi oleh `RecordingDeletedConsumer` di `Streaming.Service/Consumers/` untuk menghapus file
`{recordingId}.webm` dari `Streaming:StoragePath`.

## Frontend

- `src/services/mediaClient.ts` — `deleteRecording(recordingId: string): Promise<void>`.
- `src/pages/RecordingsList.tsx` — tombol 🗑 di sebelah tombol ▶, hanya muncul untuk rekaman
  `Completed` (kondisi sama dengan tombol play). Klik memunculkan `confirm()`; setelah berhasil,
  item langsung dihapus dari state lokal (tanpa perlu refetch daftar), dan playback dihentikan
  lebih dulu jika rekaman yang dihapus sedang diputar.

## Known limitation
- Endpoint DELETE belum diamankan JWT/otorisasi kepemilikan (mengikuti pola endpoint GET
  `/api/recordings/{userId}` yang saat ini juga tidak memvalidasi token) — siapa pun yang tahu
  `recordingId` bisa menghapusnya. Perlu ditambahkan pengecekan `sub` claim vs `Recording.UserId`
  jika endpoint ini akan dipakai di luar lingkungan development.
- Tidak ada cleanup terkait di `Notification.Service` (notifikasi lama untuk rekaman yang dihapus
  tetap ada) — di luar scope perubahan ini.
