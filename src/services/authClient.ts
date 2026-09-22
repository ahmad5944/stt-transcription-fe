const API_BASE_URL = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

export interface AuthResponse {
  accessToken: string;
  expiresAtUtc: string;
  userId: string;
  email: string;
}

async function postAuth(path: string, email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const message = response.status === 401
      ? 'Email atau password salah.'
      : response.status === 409
        ? 'Email sudah terdaftar.'
        : `Gagal (status ${response.status}).`;
    throw new Error(message);
  }

  return (await response.json()) as AuthResponse;
}

export function login(email: string, password: string) {
  return postAuth('/api/auth/login', email, password);
}

export function register(email: string, password: string) {
  return postAuth('/api/auth/register', email, password);
}
