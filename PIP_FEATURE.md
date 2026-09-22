# Picture-in-Picture (PiP) Feature Documentation

## Overview
Fitur Picture-in-Picture (PiP) memungkinkan pengguna untuk mengontrol perekaman audio melalui jendela mengambang yang dapat di-resize. Jendela ini tetap berada di atas aplikasi lain dan menyediakan kontrol esensial untuk perekaman audio Bluetooth.

## Architecture & Integration

### Components
- **`usePictureInPicture.ts`**: Custom hook yang mengelola lifecycle PiP window:
  - Native Document PiP API (Chrome 116+)
  - Fallback floating modal untuk browser yang belum mendukung Native PiP
  - `ResizeObserver` untuk mendeteksi perubahan ukuran jendela dan beralih antara **Full Mode** dan **Compact Mode** (breakpoint: < 400px)
  - `pipContainerRef` di-attach ke elemen `.pip-fallback-overlay` di `DeviceSelection.tsx` — ini yang membuat resize modal fallback benar-benar terdeteksi

- **`PiPControlPanel.tsx`**: UI Component yang dirender di dalam PiP window/modal. Menggunakan **class CSS yang sama persis** dengan dashboard utama (`.card`, `.device-select-wrapper`, `.level-bar-track`/`.level-bar-fill`, `.record-btn`/`.stop-btn`/`.circle`) alih-alih inline style, sehingga tampilannya identik dengan web:
  - **Full Mode**: Card "Select Audio Device", Card "Level-Meter (dB)", tombol bulat REKAM (biru) & STOP (abu)
  - **Compact Mode**: Select audio device + tombol bulat kecil (`.circle--sm`) REKAM & STOP saja — tanpa card level-meter

- **`DeviceSelection.tsx`**: Dashboard utama yang mengintegrasikan PiP hook dan meneruskan handlers & state dari `useAudioCapture()`. Untuk native PiP window (dokumen terpisah), CSS `Dashboard.css` disuntikkan via `import dashboardCssText from './Dashboard.css?raw'` agar class yang sama tersedia di jendela PiP.

### Synchronized State
PiP dan Dashboard Utama menggunakan state yang sama secara real-time — merekam tetap berjalan normal walau PiP aktif, karena `handleStart`/`handleStop`/`useAudioCapture` yang dipanggil persis sama dengan yang dipakai dashboard utama:
- Audio device selection
- Live audio level meter
- Recording state (Rekam/Stop)
- WebSocket connection & audio streaming

## Responsive Behavior

| Mode | Trigger Breakpoint | Komponen Terlihat |
|---|---|---|
| **Full Mode** | Width >= 400px | Card Select Device, Card Level-Meter, Tombol bulat REKAM, Tombol bulat STOP |
| **Compact Mode** | Width < 400px | Select Device Dropdown, Tombol bulat kecil REKAM (icon only), Tombol bulat kecil STOP (icon only) |

## Cara Penggunaan
1. Klik tombol **📺 PiP** di bagian kanan atas header Dashboard.
2. Jika browser mendukung Native PiP, jendela PiP terpisah akan muncul.
3. Jika Native PiP tidak tersedia, Floating Modal PiP akan otomatis terbuka di sudut kanan bawah.
4. Anda dapat memperkecil/memperbesar ukuran PiP (drag sudut/resize) untuk beralih antara mode Full dan Compact.
5. Memilih perangkat audio atau mengklik tombol Rekam/Stop di dalam PiP akan langsung mengeksekusi perekaman audio streaming secara real-time, baik di jendela PiP maupun dashboard utama.

