function decodeJwtPayload(token) {
  try {
    if (!token) return null;

    const parts = String(token).split('.');
    const payloadPart = parts.length >= 2 ? parts[1] : parts[0];
    let b64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');

    while (b64.length % 4) b64 += '=';

    return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

module.exports = {
  decodeJwtPayload
};
