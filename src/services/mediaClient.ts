const API_BASE_URL = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

export interface Recording {
  id: string;
  userId: string;
  filePath: string;
  format: string;
  durationSeconds: number;
  status: 'Processing' | 'Completed' | number;
  createdAtUtc: string;
  transcriptText?: string | null;
}

export async function fetchRecordings(userId: string): Promise<Recording[]> {
  const response = await fetch(`${API_BASE_URL}/api/recordings/${userId}`);
  if (!response.ok) {
    throw new Error(`Gagal mengambil daftar rekaman (status ${response.status}).`);
  }
  return (await response.json()) as Recording[];
}

export async function deleteRecording(recordingId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/recordings/${recordingId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Gagal menghapus rekaman (status ${response.status}).`);
  }
}
