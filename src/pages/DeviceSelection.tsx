import { useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useAudioCapture } from '../hooks/useAudioCapture';
import { usePictureInPicture } from '../hooks/usePictureInPicture';
import { PiPControlPanel } from '../components/PiPControlPanel';
import { StreamingClient } from '../services/websocketClient';
import { RecordingsList } from './RecordingsList';
import './Dashboard.css';

const STREAMING_WS_URL = (import.meta.env.VITE_STREAMING_WS_URL as string | undefined) ?? 'ws://localhost:5003';
const MIN_DB = -80;

interface DeviceSelectionProps {
  onLogout: () => void;
}

export function DeviceSelection({ onLogout }: DeviceSelectionProps) {
  const {
    devices,
    selectedDeviceId,
    isRecording,
    level,
    listDevices,
    startMonitoring,
    startRecording,
    stopRecording,
  } = useAudioCapture();

  const {
    isPiPActive,
    pipWindow,
    isCompact,
    useFallbackModal,
    openPiP,
    closePiP,
    pipContainerRef,
  } = usePictureInPicture(isRecording);

  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [status, setStatus] = useState('Menunggu perangkat dipilih.');
  const [client, setClient] = useState<StreamingClient | null>(null);
  const [recordingsKey, setRecordingsKey] = useState(0);
  const [transcript, setTranscript] = useState('');
  const isStoppingRef = useRef(false);

  useEffect(() => {
    listDevices().catch((err: Error) => setStatus(`Gagal membaca perangkat audio: ${err.message}`));
  }, [listDevices]);

  const handleSelectDevice = async (deviceId: string) => {
    try {
      await startMonitoring(deviceId);
      setStatus('Perangkat siap.');
    } catch (err) {
      setStatus(`Gagal mengakses perangkat: ${(err as Error).message}`);
    }
  };

  const handleStart = async () => {
    if (!selectedDeviceId) return;

    // NOTE: no login UI yet — for manual testing, set an access token via localStorage.setItem('accessToken', '<jwt>').
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setStatus('Belum login. Set localStorage "accessToken" dengan JWT dari Auth.Service untuk testing.');
      return;
    }

    isStoppingRef.current = false;
    setTranscript('');

    // Fires on a genuinely unexpected disconnect (network blip, Bluetooth dropout, server restart) —
    // without this, the mic keeps "recording" locally while every chunk silently fails to upload,
    // and the user only finds out the recording is missing/incomplete after clicking Stop.
    const handleUnexpectedDisconnect = (reason: string) => {
      if (isStoppingRef.current) return;
      isStoppingRef.current = true;
      stopRecording();
      setClient(null);
      setStatus(`Koneksi terputus (${reason}) — rekaman dihentikan otomatis, bagian akhir mungkin tidak tersimpan.`);
      setTimeout(() => setRecordingsKey((key) => key + 1), 1500);
    };

    const streamingClient = new StreamingClient({
      baseUrl: STREAMING_WS_URL,
      accessToken: token,
      onRecordingId: setRecordingId,
      onTranscript: (text, isFinal) => {
        console.info('Transcript callback received:', { isFinal, text });
        setTranscript(text);
      },
      onClose: () => handleUnexpectedDisconnect('koneksi streaming ditutup'),
      onError: () => handleUnexpectedDisconnect('error pada koneksi streaming'),
    });

    try {
      await streamingClient.connect();
    } catch {
      setStatus('Gagal terhubung ke Streaming.Service.');
      return;
    }

    setClient(streamingClient);
    setStatus('Suara Masuk • Koneksi Aman — Streaming Aktif (128 kbps)');

    try {
      startRecording(
        (chunk) => streamingClient.sendChunk(chunk),
        () => streamingClient.close(),
        (error) => handleUnexpectedDisconnect(error.message),
      );
    } catch (err) {
      setStatus(`Gagal memulai rekaman: ${(err as Error).message}`);
      streamingClient.close();
      setClient(null);
    }
  };

  const handleStop = () => {
    isStoppingRef.current = true;
    stopRecording();
    client?.close();
    setClient(null);
    setStatus('Rekaman selesai.');
    // Media.Service processes the RecordingCompleted event asynchronously, give it a moment before refreshing.
    setTimeout(() => setRecordingsKey((key) => key + 1), 1500);
  };

  // Open PiP and render control panel inside PiP window
  const handleOpenPiP = () => {
    if (isPiPActive && useFallbackModal) {
      // Close fallback modal if already open
      closePiP();
    } else {
      openPiP();
    }
  };

  // Effect to render PiPControlPanel when PiP window is active or resized
  const pipRootRef = useRef<Root | null>(null);

  // Creates the PiP root ONCE per window open (not on every prop change) — otherwise wiping
  // body.innerHTML on every render (e.g. every `level` tick) destroys the DOM and resets scroll.
  // eslint-disable-next-line react-hooks/immutability -- pipWindow is a separate native Window/Document, not React-managed state
  useEffect(() => {
    if (isPiPActive && pipWindow) {
      // eslint-disable-next-line react-hooks/immutability -- pipWindow is a separate native Window/Document, not React-managed state
      pipWindow.document.body.innerHTML = '<div id="pip-root"></div>';
      const rootDiv = pipWindow.document.getElementById('pip-root');

      if (rootDiv) {
        rootDiv.style.width = '100%';
        rootDiv.style.height = '100%';

        pipRootRef.current = createRoot(rootDiv);
      }

      return () => {
        pipRootRef.current?.unmount();
        pipRootRef.current = null;
      };
    }
  }, [isPiPActive, pipWindow]);

  // Re-renders into the already-created root whenever control-panel props change, instead of
  // recreating the root/DOM — keeps whatever scroll position the user set inside the PiP window.
  // `pipWindow` must be a dep too, otherwise the very first render into a freshly-created root is
  // skipped (none of the other deps changed when the window just opened) — leaving a black screen.
  useEffect(() => {
    pipRootRef.current?.render(
      <PiPControlPanel
        compact={isCompact}
        devices={devices}
        selectedDeviceId={selectedDeviceId}
        onSelectDevice={handleSelectDevice}
        onStart={handleStart}
        onStop={handleStop}
        isRecording={isRecording}
        level={level}
      />
    );
    // handleSelectDevice/handleStart/handleStop are intentionally omitted: they're recreated every
    // render (not memoized), so including them would re-render the PiP root every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipWindow, isCompact, devices, selectedDeviceId, isRecording, level]);

  const dbValue = level > 0 ? Math.max(MIN_DB, 20 * Math.log10(level)) : MIN_DB;
  const levelPercent = ((dbValue - MIN_DB) / -MIN_DB) * 100;

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Bluetooth Microphone Testing</h1>
        <div className="header-actions">
          <button
            type="button"
            className="icon-btn pip-launch-btn"
            onClick={handleOpenPiP}
            title={isPiPActive ? "PiP Aktif" : "Buka Picture-in-Picture"}
          >
            📺 PiP
          </button>
          <button type="button" className="icon-btn" title="Pengaturan">⚙</button>
          <button type="button" className="icon-btn avatar-btn" onClick={onLogout} title="Logout">👤</button>
        </div>
      </header>

      {/* Fallback floating modal if native Document PiP fails or is unsupported */}
      {useFallbackModal && isPiPActive && (
        <div className="pip-fallback-overlay" ref={pipContainerRef}>
          <div className="pip-fallback-modal">
            <div className="pip-fallback-header">
              <span>Picture-in-Picture Control</span>
              <button
                type="button"
                className="pip-fallback-close"
                onClick={() => handleOpenPiP()}
              >
                ✕
              </button>
            </div>
            <PiPControlPanel
              compact={isCompact}
              devices={devices}
              selectedDeviceId={selectedDeviceId}
              onSelectDevice={handleSelectDevice}
              onStart={handleStart}
              onStop={handleStop}
              isRecording={isRecording}
              level={level}
              onClose={() => handleOpenPiP()}
            />
          </div>
        </div>
      )}

      <div className="dashboard-grid">
        <div className="column column-left">
          <div className="card">
            <h3>Select Audio Device</h3>
            <div className="device-select-wrapper">
              <span className="mic-icon">🎙</span>
              <select
                id="device-select"
                value={selectedDeviceId ?? ''}
                onChange={(event) => handleSelectDevice(event.target.value)}
              >
                <option value="" disabled>Select Microphone...</option>
                {devices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="card">
            <h3>Level-Meter (dB)</h3>
            <div className="db-value">{dbValue.toFixed(0)} dB</div>
            <div className="level-bar-track">
              <div className="level-bar-fill" style={{ width: `${levelPercent}%` }} />
            </div>
            <div className="level-bar-labels">
              <span>{MIN_DB} dB</span>
              <span>0 dB</span>
            </div>
            <div className="level-caption">Audio Input Level</div>
          </div>
        </div>

        <div className="column column-middle">
          <div className="record-controls">
            <button type="button" className="record-btn" onClick={handleStart} disabled={!selectedDeviceId || isRecording}>
              <span className="circle">🎙</span>
              <span className="label">REKAM</span>
              <span className="sublabel">Mulai Rekam</span>
            </button>
            <button type="button" className="stop-btn" onClick={handleStop} disabled={!isRecording}>
              <span className="circle">■</span>
              <span className="label">STOP</span>
              <span className="sublabel">Hentikan</span>
            </button>
          </div>

          <div className="card status-card">
            <h3>Status</h3>
            <div className="status-row">
              <span className={`status-dot${isRecording ? '' : ' status-dot-idle'}`} />
              <span>{status}</span>
            </div>
            {recordingId && <div className="mt-2.5 text-center text-xs text-slate-500">Recording ID: {recordingId}</div>}
          </div>
        </div>

        <div className="column column-right">
          <RecordingsList key={recordingsKey} />
        </div>
      </div>

      <div className="card transcript-card">
        <div className="transcript-header">
          <h3 className="m-0">Transkrip</h3>
          {isRecording && <span className="transcript-live-dot" title="Live" />}
          <button
            type="button"
            className="refresh-link ml-auto"
            onClick={() => setTranscript('')}
            disabled={isRecording}
          >
            Reset
          </button>
        </div>
        <div className="transcript-body">
          {transcript || (
            <span className="transcript-placeholder">
              Transkrip akan muncul di sini secara live saat Anda mulai merekam.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
