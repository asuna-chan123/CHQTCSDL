type ApiErrorResponse = {
  error?: string;
  message?: string;
};

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`/api${path}`, { ...init, headers });
  const contentType = response.headers.get('content-type') || '';
  const body: unknown = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const details =
      typeof body === 'object' && body !== null
        ? (body as ApiErrorResponse).error || (body as ApiErrorResponse).message
        : undefined;
    throw new Error(details || `API trả về lỗi HTTP ${response.status}.`);
  }

  return body as T;
}
