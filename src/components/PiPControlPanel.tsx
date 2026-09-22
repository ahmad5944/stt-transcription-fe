// PiPControlPanel - Component for Picture-in-Picture mode

interface PiPControlPanelProps {
  compact?: boolean;
  devices: Array<{ deviceId: string; label: string }>;
  selectedDeviceId: string | null;
  onSelectDevice: (deviceId: string) => Promise<void>;
  onStart: () => Promise<void>;
  onStop: () => void;
  isRecording: boolean;
  level: number;
}

const MIN_DB = -80;

export function PiPControlPanel({
  compact = false,
  devices,
  selectedDeviceId,
  onSelectDevice,
  onStart,
  onStop,
  isRecording,
  level,
  onClose,
}: PiPControlPanelProps & { onClose?: () => void }) {
  const dbValue = level > 0 ? Math.max(MIN_DB, 20 * Math.log10(level)) : MIN_DB;
  const levelPercent = ((dbValue - MIN_DB) / -MIN_DB) * 100;

  const handleDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSelectDevice(e.target.value);
  };

  const deviceSelect = (
    <div className="device-select-wrapper">
      <span className="mic-icon">🎙</span>
      <select value={selectedDeviceId ?? ''} onChange={handleDeviceChange}>
        <option value="" disabled>Select Microphone...</option>
        {devices.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className={`pip-panel ${compact ? 'pip-panel--compact' : ''}`}>
      <div className="pip-panel-header">
        <h2 className="pip-title">{compact ? '🎙 PiP' : '📺 Picture-in-Picture Control'}</h2>
        {onClose && (
          <button type="button" className="icon-btn" onClick={onClose} title="Tutup PiP">✕</button>
        )}
      </div>

      <div className={`pip-panel-content ${compact ? 'pip-panel-content--compact' : ''}`}>
        {compact ? (
          /* Compact mode: same building blocks as the dashboard, minus the level-meter */
          <>
            {deviceSelect}
            <div className="record-controls record-controls--compact">
              <button
                type="button"
                className="record-btn"
                onClick={onStart}
                disabled={!selectedDeviceId || isRecording}
                title="Mulai Rekam"
              >
                <span className="circle circle--sm">🎙</span>
              </button>
              <button
                type="button"
                className="stop-btn"
                onClick={onStop}
                disabled={!isRecording}
                title="Hentikan"
              >
                <span className="circle circle--sm">■</span>
              </button>
            </div>
          </>
        ) : (
          /* Full mode: identical cards/buttons to the main dashboard */
          <>
            <div className="card">
              <h3>Select Audio Device</h3>
              {deviceSelect}
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

            <div className="record-controls">
              <button type="button" className="record-btn" onClick={onStart} disabled={!selectedDeviceId || isRecording}>
                <span className="circle">🎙</span>
                <span className="label">REKAM</span>
                <span className="sublabel">Mulai Rekam</span>
              </button>
              <button type="button" className="stop-btn" onClick={onStop} disabled={!isRecording}>
                <span className="circle">■</span>
                <span className="label">STOP</span>
                <span className="sublabel">Hentikan</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
