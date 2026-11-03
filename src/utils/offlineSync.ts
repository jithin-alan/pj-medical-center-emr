const QUEUE_KEY = 'pj-offline-request-queue';

type QueuedRequest = {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  createdAt: string;
};

const getQueue = (): QueuedRequest[] => {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
};

const setQueue = (queue: QueuedRequest[]) => {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

export const pendingOfflineRequestCount = () => getQueue().length;

export const flushOfflineQueue = async () => {
  if (!navigator.onLine) return false;

  let queue = getQueue();
  for (const request of queue) {
    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
      if (!response.ok) continue;
      queue = queue.filter((item) => item.id !== request.id);
      setQueue(queue);
      window.dispatchEvent(new CustomEvent('pj-offline-synced', { detail: request }));
    } catch {
      return false;
    }
  }
  return true;
};

export const installOfflineFetch = () => {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(method) && url.startsWith('/api/') ||
      !['GET', 'HEAD', 'OPTIONS'].includes(method) && new URL(url, window.location.origin).pathname.startsWith('/api/');

    if (isMutation && !navigator.onLine) {
      const requestHeaders = init?.headers || (input instanceof Request ? input.headers : undefined);
      const headers: Record<string, string> = {};
      new Headers(requestHeaders).forEach((value, key) => { headers[key] = value; });
      const queue = getQueue();
      queue.push({
        id: crypto.randomUUID(),
        url: url.startsWith('http') ? new URL(url).pathname : url,
        method,
        headers,
        body: typeof init?.body === 'string' ? init.body : undefined,
        createdAt: new Date().toISOString(),
      });
      setQueue(queue);
      window.dispatchEvent(new CustomEvent('pj-offline-queued'));
      return new Response(JSON.stringify({ queued: true, offline: true }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return originalFetch(input, init);
  };
};

window.addEventListener('online', () => void flushOfflineQueue());
