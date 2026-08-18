export async function callApi(endpoint, body) {
  const res = await fetch(`/api/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();

  if (!contentType.includes('application/json')) {
    const hint = text.slice(0, 180).replace(/\s+/g, ' ').trim();
    if (res.status === 404) {
      throw new Error(`API route /api/${endpoint} không tồn tại. Hãy restart API server: npm run server`);
    }
    if (res.status === 500 || res.status === 502 || res.status === 503 || res.status === 504) {
      throw new Error(
        hint.includes('ECONNREFUSED') || hint.includes('proxy')
          ? `API server chưa chạy hoặc vừa crash. Restart: npm run server`
          : `API lỗi HTTP ${res.status}. Restart server nếu vừa sửa code: npm run server`
      );
    }
    throw new Error(`API trả về không phải JSON (HTTP ${res.status})${hint ? `: ${hint}` : ''}`);
  }

  const data = JSON.parse(text);

  if (!res.ok) {
    throw new Error(data.message || `HTTP ${res.status}`);
  }

  return data;
}

export async function fetchBanks() {
  const res = await fetch('/api/banks');
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data.data || [];
}

export async function checkHealth() {
  const res = await fetch('/api/health');
  return res.json();
}

