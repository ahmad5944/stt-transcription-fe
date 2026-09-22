export interface StreamingClientOptions {
  baseUrl: string;
  accessToken: string;
  onRecordingId?: (recordingId: string) => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onError?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onChunkDropped?: (chunk: Blob) => void;
}

// Thin wrapper around the native WebSocket used to stream MediaRecorder chunks to Streaming.Service.
export class StreamingClient {
  private socket: WebSocket | null = null;
  private readonly options: StreamingClientOptions;

  constructor(options: StreamingClientOptions) {
    this.options = options;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Native browser WebSocket can't set an Authorization header, so the JWT is passed as a query param.
      const url = `${this.options.baseUrl}/ws/stream?access_token=${encodeURIComponent(this.options.accessToken)}`;
      const socket = new WebSocket(url);

      socket.onopen = () => resolve();
      socket.onerror = (event) => {
        this.options.onError?.(event);
        reject(event);
      };
      socket.onclose = (event) => this.options.onClose?.(event);
      socket.onmessage = (event) => {
        if (typeof event.data !== 'string') return;
        try {
          const parsed = JSON.parse(event.data) as {
            type?: string;
            recordingId?: string;
            text?: string;
            isFinal?: boolean;
          };
          if (parsed.type === 'transcript' && parsed.text) {
            console.info('Live transcript received:', parsed.text);
            this.options.onTranscript?.(parsed.text, parsed.isFinal ?? false);
          } else if (parsed.recordingId) {
            this.options.onRecordingId?.(parsed.recordingId);
          }
        } catch {
          // ignore non-JSON text frames
        }
      };

      this.socket = socket;
    });
  }

  sendChunk(chunk: Blob) {
    // socket.send() throws synchronously if readyState isn't OPEN — without this guard, a chunk
    // arriving right as the connection drops (network blip, Bluetooth dropout, server restart)
    // would throw inside MediaRecorder's ondataavailable handler and silently kill the upload.
    if (this.socket?.readyState !== WebSocket.OPEN) {
      this.options.onChunkDropped?.(chunk);
      return;
    }
    this.socket.send(chunk);
  }

  isOpen() {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  close() {
    this.socket?.close();
    this.socket = null;
  }
}
