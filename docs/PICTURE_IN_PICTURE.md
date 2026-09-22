# Picture-in-Picture (PiP) Mode - Dokumentasi Fitur

## Overview
Fitur Picture-in-Picture memungkinkan user untuk membuka jendela floating terpisah yang berisi kontrol rekaman audio, sehingga bisa tetap melakukan rekaman sementara main window dikerjakan untuk hal lain.

## Fitur Utama
1. **Floating Window** - Jendela terpisah dari browser utama yang bisa dipindahkan
2. **Responsive UI** - Menyesuaikan tampilan berdasarkan ukuran jendela:
   - **Full mode** (width ≥ 400px): Tampilkan semua kontrol termasuk VU meter dan status lengkap
   - **Compact mode** (width < 400px): Hanya tampilkan select device, tombol Rekam, dan tombol Stop
3. **Dukungan Browser** - Chrome 111+, Edge 111+ (Document PiP API), dengan fallback floating modal untuk browser lain
4. **State Synchronization** - Status rekaman tersinkron dengan main window
5. **Recording-aware auto-open/close**:
   - Tombol 📺 PiP di navbar selalu bisa membuka/menutup PiP kapan saja, terlepas dari status rekaman.
   - PiP terbuka otomatis HANYA ketika sedang merekam DAN tab disembunyikan/di-minimize (`document.hidden`).
   - Jika tidak sedang merekam, menyembunyikan/minimize tab TIDAK membuka PiP otomatis.
   - PiP yang terbuka otomatis akan tertutup otomatis begitu tab terlihat kembali; PiP yang dibuka manual lewat tombol navbar tetap terbuka.

## Implementasi Teknis

### File-file Penting
- `src/hooks/usePictureInPicture.ts` - Hook untuk Document PiP API
- `src/components/PiPControlPanel.tsx` - Komponen kontrol PiP dengan dual mode
- `src/pages/DeviceSelection.tsx` - Integration dengan main UI
- `src/pages/Dashboard.css` - Styling PiP

### Architecture
```
Main Window
└── DeviceSelection.tsx
    ├── useAudioCapture()   # State recording
    ├── usePictureInPicture() # Hook PiP
    └── Button: "📌 PiP Mode"
        └── PiP Window
            └── PiPControlPanel
                ├── Device select
                ├── Start/Stop buttons
                ├── VU meter (full mode only)
                └── Status (full mode only)
```

### API Details
**Document Picture-in-Picture API** digunakan karena:
- Dapat merender React components asli (bukan hanya video element)
- Support CSS stylesheet dari main document
- Bisa attach event listeners untuk resize detection
- Full DOM manipulation capability

**Pembatasan:**
- Hanya tersedia di Chrome 111+ dan Edge 111+
- Window PiP harus berasal dari user interaction (klik tombol)
- Tidak bisa programmatically close PiP tanpa user action (keamanan browser)

### Responsive Logic
```javascript
// Di usePictureInPicture hook
const handleResize = () => {
  if (pipWindow) {
    const newWidth = pipWindow.innerWidth;
    const newHeight = pipWindow.innerHeight;
    setPipSize({ width: newWidth, height: newHeight });
    setCompact(newWidth < COMPACT_THRESHOLD); // 400px
  }
};

// Di PiPControlPanel component
export function PiPControlPanel({ compact = false, ...props }) {
  return (
    <div className={`pip-panel ${compact ? 'pip-panel--compact' : ''}`}>
      {compact ? (
        // Compact mode: minimal UI
        <div className="compact-controls">...</div>
      ) : (
        // Full mode: semua kontrol
        <div className="full-controls">...</div>
      )}
    </div>
  );
}
```

### Testing Checklist
- [ ] Tombol "� PiP" muncul di header dashboard dan selalu bisa membuka/menutup PiP
- [ ] Klik tombol membuka PiP window floating (native) atau fallback modal
- [ ] Dropdown device berfungsi di PiP window
- [ ] Tombol Rekam dan Stop bekerja normal di PiP
- [ ] WebSocket connection tetap aktif saat recording di PiP
- [ ] Resize window PiP trigger responsive mode change
- [ ] Width < 400px → mode compact (hanya select, rekam, stop)
- [ ] Width ≥ 400px → mode full dengan VU meter & status
- [ ] Close PiP window tidak mengganggu main window
- [ ] Sedang merekam + minimize/pindah tab → PiP fallback modal terbuka otomatis
- [ ] Sedang merekam + kembali ke tab → PiP auto-opened tertutup otomatis
- [ ] TIDAK sedang merekam + minimize/pindah tab → PiP TIDAK terbuka otomatis
- [ ] PiP dibuka manual lewat tombol navbar tetap terbuka walau kembali ke tab
- [ ] Fallback modal (non-native browser) bisa di-scroll dan tidak "jump to top" saat konten melebihi tinggi panel
- [ ] Native PiP window (Chrome/Edge) bisa di-scroll dan tidak "jump to top" walau VU meter/level terus update saat merekam

### Troubleshooting
**Issue 1: PiP button tidak muncul atau tidak berfungsi**
- Cek browser support: `'documentPictureInPicture' in window`
- Pastikan di Chrome/Edge terbaru
- Button harus di-trigger oleh user click (bukan programmatically)

**Issue 2: Styling tidak konsisten di PiP window**
- Hook `usePictureInPicture` seharusnya copy stylesheet
- Periksa CSS specificity untuk `.pip-panel` selector

**Issue 3: State tidak tersinkron**
- Pastikan semua props yang diperlukan di-pass ke `PiPControlPanel`
- Verifikasi callback functions (`onSelectDevice`, `onStart`, `onStop`) di-reference dengan benar

**Issue 4 (FIXED): Fallback modal tidak bisa di-scroll, selalu "jump to top"**
- Root cause: class `.pip-fallback-overlay`, `.pip-fallback-modal`, `.pip-panel*` dipakai di komponen
  tapi tidak punya rule sama sekali di `Dashboard.css` sumber — sehingga tidak ada `position: fixed`,
  `max-height`, atau `overflow-y: auto` yang membatasi/menscroll konten.
- Fix: rules `.pip-fallback-overlay` (position fixed + ukuran + `resize: both`), `.pip-panel`
  (flex column, `overflow: hidden`), dan `.pip-panel-content` (`flex: 1; min-height: 0; overflow-y: auto`)
  ditambahkan ke `Dashboard.css`. Kunci perbaikannya adalah `min-height: 0` pada elemen flex yang perlu
  scroll — tanpa itu flex item tidak akan menyusut di bawah ukuran kontennya sehingga overflow tidak
  pernah benar-benar terjadi di dalam panel.

**Issue 5 (FIXED): Native PiP window tidak bisa di-scroll, selalu "jump to top" saat scroll down**
- Root cause: berbeda dari Issue 4 (yang soal CSS), ini soal DOM. Effect yang me-render
  `PiPControlPanel` ke dalam native Document PiP window (di `DeviceSelection.tsx`) sebelumnya
  mereset seluruh DOM window PiP (`pipWindow.document.body.innerHTML = ...`) dan memanggil
  `createRoot()` baru setiap kali salah satu dependency-nya berubah — termasuk `level` (nilai
  VU meter), yang di-update lewat `setInterval` di `useAudioCapture.ts` kira-kira setiap 100ms
  selama monitoring/merekam. Akibatnya seluruh isi window PiP dibongkar-pasang ulang berkali-kali
  per detik, sehingga posisi scroll manapun yang sedang dibuat user langsung hilang — persis
  gejala "scroll down selalu balik ke atas".
- Fix: effect dipecah jadi dua. Effect pertama (dependency `[isPiPActive, pipWindow]`) hanya
  membuat `#pip-root` dan `createRoot()` SEKALI saat window PiP dibuka, root-nya disimpan di
  `useRef`. Effect kedua (dependency `[isCompact, devices, selectedDeviceId, isRecording, level]`)
  hanya memanggil `root.render(<PiPControlPanel .../>)` ke root yang sudah ada — ini re-render
  React biasa (reconciliation), bukan bongkar-pasang DOM, sehingga posisi scroll tetap terjaga.

**Issue 6 (FIXED): PiP window muncul tapi layar hitam (blank)**
- Muncul sebagai regresi langsung dari fix Issue 5 di atas. Effect kedua ("render ke root yang
  sudah ada") tadinya punya dependency array `[isCompact, devices, selectedDeviceId, isRecording, level]`
  — TIDAK termasuk `pipWindow`. Saat window PiP baru dibuka, effect pertama (yang membuat root)
  ikut ter-trigger karena `pipWindow` berubah, tapi effect kedua TIDAK ikut ter-trigger karena
  tidak satu pun dependency miliknya berubah pada commit yang sama — akibatnya root yang baru
  dibuat tidak pernah di-render isinya sama sekali, sehingga window PiP tampil hitam kosong.
- Fix: tambahkan `pipWindow` ke dependency array effect kedua juga, supaya kedua effect
  ter-trigger bersamaan saat window baru terbuka.
- Hardening tambahan: style yang di-inject ke PiP window sekarang memakai `html, body { height: 100%; }`
  supaya rantai `#pip-root -> .pip-panel` yang sama-sama `height: 100%` punya ancestor height yang
  eksplisit. Di browser automation test terbaru, native Document PiP di environment harness masih
  gagal membuat window dan jatuh ke fallback modal, tetapi fallback modal menampilkan komponen lengkap
  dan bisa di-scroll setelah overlay diperkecil.

## Future Improvements
1. **PiP position persistence** - Simpan posisi window terakhir di localStorage
2. **Multi-monitor support** - Drag PiP ke monitor lain
3. **Audio preview di PiP** - Tambahkan audio monitor kecil
4. **Live transcript di PiP** - Tampilkan potongan transkrip live juga di panel PiP, tidak hanya di main window