const { HttpsProxyAgent } = require('https-proxy-agent');

/**
 * Hỗ trợ các định dạng:
 * - user:pass@host:port  (proxy xoay DataImpulse, v.v.)
 * - http://user:pass@host:port
 * - host:port (không auth)
 */
function normalizeProxyUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';

  if (/^(https?|socks5):\/\//i.test(raw)) {
    return raw;
  }

  const atIndex = raw.lastIndexOf('@');
  if (atIndex === -1) {
    if (/^[\w.-]+:\d+$/.test(raw)) {
      return `http://${raw}`;
    }
    return raw;
  }

  const credentials = raw.slice(0, atIndex);
  const hostPort = raw.slice(atIndex + 1);
  const colonIndex = credentials.indexOf(':');

  if (colonIndex === -1 || !hostPort.includes(':')) {
    return raw;
  }

  const username = credentials.slice(0, colonIndex);
  const password = credentials.slice(colonIndex + 1);
  const portSep = hostPort.lastIndexOf(':');
  const host = hostPort.slice(0, portSep);
  const port = hostPort.slice(portSep + 1);

  if (!username || !password || !host || !port) {
    return raw;
  }

  return `http://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}`;
}

function createAxiosProxyConfig(proxyUrl) {
  const normalized = normalizeProxyUrl(proxyUrl);
  if (!normalized) return {};

  const agent = new HttpsProxyAgent(normalized);
  return {
    proxy: false,
    httpAgent: agent,
    httpsAgent: agent,
    insecureHTTPParser: true
  };
}

module.exports = {
  normalizeProxyUrl,
  createAxiosProxyConfig
};
