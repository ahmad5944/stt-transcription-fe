import { useEffect, useRef, useState } from 'react';
import { deleteRecording, fetchRecordings, type Recording } from '../services/mediaClient';

const STREAMING_HTTP_URL = (import.meta.env.VITE_STREAMING_HTTP_URL as string | undefined) ?? 'http://localhost:5003';

function isCompleted(status: Recording['status']) {
  return status === 1 || status === 'Completed';
}

function formatFileName(recording: Recording) {
  return `Rekaman_${recording.id.slice(0, 8)}.${recording.format}`;
}

export function RecordingsList() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const load = () => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      setError('userId tidak ditemukan, silakan login ulang.');
      return;
    }

    setIsLoading(true);
    setError(null);
    fetchRecordings(userId)
      .then(setRecordings)
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-mount, no data-fetching lib used here
    load();
  }, []);
  useEffect(() => () => audioRef.current?.pause(), []);

  const togglePlay = (recording: Recording) => {
    if (playingId === recording.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    audioRef.current?.pause();
    const audio = new Audio(`${STREAMING_HTTP_URL}/recordings/${recording.id}`);
    audio.onended = () => setPlayingId(null);
    audio.play().catch(() => setError('Gagal memutar rekaman.'));
    audioRef.current = audio;
    setPlayingId(recording.id);
  };

  const handleDelete = async (recording: Recording) => {
    if (!confirm('Hapus rekaman ini? Tindakan ini tidak dapat dibatalkan.')) return;

    if (playingId === recording.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    }

    try {
      await deleteRecording(recording.id);
      setRecordings((prev) => prev.filter((r) => r.id !== recording.id));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="card recordings-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h3 style={{ margin: 0 }}>Rekaman Suara Terakhir</h3>
        <button type="button" className="refresh-link" onClick={load} disabled={isLoading}>
          {isLoading ? '...' : 'Refresh'}
        </button>
      </div>

      {error && <p style={{ color: '#f87171', fontSize: 12 }}>{error}</p>}
      {!error && recordings.length === 0 && !isLoading && (
        <p style={{ color: '#6b7280', fontSize: 12 }}>Belum ada rekaman.</p>
      )}

      <ul>
        {recordings.map((recording) => (
          <li key={recording.id} className="recording-item">
            <div className="recording-info">
              <span className="recording-name">{formatFileName(recording)}</span>
              <span className="recording-meta">
                {new Date(recording.createdAtUtc).toLocaleDateString()}, {new Date(recording.createdAtUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              {recording.transcriptText && (
                <span className="recording-transcript" title={recording.transcriptText}>{recording.transcriptText}</span>
              )}
            </div>
            {isCompleted(recording.status) && (
              <div className="recording-actions">
                <button type="button" className="play-btn" onClick={() => togglePlay(recording)}>
                  {playingId === recording.id ? '⏸' : '▶'}
                </button>
                <button type="button" className="delete-btn" onClick={() => handleDelete(recording)} title="Hapus rekaman">
                  🗑
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
