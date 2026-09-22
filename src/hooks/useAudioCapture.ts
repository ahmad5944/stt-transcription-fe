import { useCallback, useEffect, useRef, useState } from 'react';

export interface AudioDevice {
  deviceId: string;
  label: string;
}

export function useAudioCapture() {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [level, setLevel] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const levelIntervalRef = useRef<number | null>(null);

  // Labels are only populated by the browser once microphone permission has been granted.
  const listDevices = useCallback(async () => {
    const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    tempStream.getTracks().forEach((track) => track.stop());

    const all = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = all
      .filter((d) => d.kind === 'audioinput')
      .map((d) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0, 6)}` }));
    setDevices(audioInputs);
    return audioInputs;
  }, []);

  useEffect(() => {
    // A Bluetooth mic disconnecting/reconnecting shows up as a devicechange event.
    const handleDeviceChange = () => {
      listDevices().catch(() => undefined);
    };
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
  }, [listDevices]);

  const stopMonitoring = useCallback(() => {
    if (levelIntervalRef.current !== null) {
      clearInterval(levelIntervalRef.current);
      levelIntervalRef.current = null;
    }
    audioContextRef.current?.close();
    audioContextRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setLevel(0);
  }, []);

  const startMonitoring = useCallback(async (deviceId: string) => {
    stopMonitoring();

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: deviceId } },
    });
    streamRef.current = stream;

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    audioContextRef.current = audioContext;

    const data = new Uint8Array(analyser.frequencyBinCount);
    levelIntervalRef.current = window.setInterval(() => {
      analyser.getByteFrequencyData(data);
      const average = data.reduce((sum, value) => sum + value, 0) / data.length;
      setLevel(average / 255);
    }, 100);

    setSelectedDeviceId(deviceId);
  }, [stopMonitoring]);

  const startRecording = useCallback((onChunk: (chunk: Blob) => void, onStop: () => void, onError?: (error: Error) => void) => {
    if (!streamRef.current) {
      throw new Error('Belum ada stream aktif. Panggil startMonitoring dulu.');
    }

    // A Bluetooth mic dropping out mid-recording ends its track, which MediaRecorder reports via onerror.
    const audioTrack = streamRef.current.getAudioTracks()[0];
    audioTrack?.addEventListener('ended', () => {
      onError?.(new Error('Perangkat audio terputus (kemungkinan Bluetooth mic keluar jangkauan/mati).'));
    });

    const recorder = new MediaRecorder(streamRef.current, { mimeType: 'audio/webm;codecs=opus' });
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) onChunk(event.data);
    };
    recorder.onstop = onStop;
    recorder.onerror = (event) => {
      onError?.(new Error(`MediaRecorder error: ${(event as unknown as { error?: Error }).error?.message ?? 'unknown'}`));
    };
    recorder.start(500); // emit a chunk every 500ms
    recorderRef.current = recorder;
    setIsRecording(true);
  }, []);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setIsRecording(false);
  }, []);

  return {
    devices,
    selectedDeviceId,
    isRecording,
    level,
    listDevices,
    startMonitoring,
    stopMonitoring,
    startRecording,
    stopRecording,
  };
}
