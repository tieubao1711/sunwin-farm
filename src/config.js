module.exports = {
  platformId: Number(process.env.SUNWIN_PLATFORM_ID || 2),
  brand: process.env.SUNWIN_BRAND || 'sun.win',
  hsk: process.env.SUNWIN_HSK || 'domaytimduocday',
  os: process.env.SUNWIN_OS || 'Android 15',
  bundle: process.env.SUNWIN_BUNDLE || 'com.gamebai.sunclub',
  affId: process.env.SUNWIN_AFF_ID || 'com.gamebai.sunclub',
  appVersion: process.env.SUNWIN_APP_VERSION || '3.6.3',
  loginUrl: process.env.SUNWIN_LOGIN_URL || 'https://api.azhkthg1.net/id',
  transactionUrl: process.env.SUNWIN_TRANSACTION_URL || 'https://api.azhkthg1.net/sa',
  paygateUrl: process.env.SUNWIN_PAYGATE_URL || 'https://api1.azhkthg1.net/paygate',
  wsUrl: process.env.SUNWIN_WS_URL || 'wss://livearena.azhkthg1.net/lobby',
  timeoutMs: Number(process.env.SUNWIN_TIMEOUT_MS || 10000),
  wsTimeoutMs: Number(process.env.SUNWIN_WS_TIMEOUT_MS || 15000),
  defaultProxyUrl: process.env.SUNWIN_PROXY_URL || ''
};
