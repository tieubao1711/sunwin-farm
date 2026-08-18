const { EventEmitter } = require('events');
const WebSocket = require('ws');
const defaultConfig = require('./config');

const CMD_LABELS = {
  0: 'ping',
  1: 'init',
  5: 'wallet'
};

function sendBinary(ws, commandId, payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify([commandId, payload]));
}

function sendPing(ws) {
  sendBinary(ws, 0, { t: Date.now() });
}

function sendInit(ws, type, username, password, info, signature, pid) {
  ws.send(JSON.stringify([
    1,
    type,
    username,
    password,
    {
      info: JSON.stringify(info),
      signature,
      pid,
      subi: true
    }
  ]));
}

function toAmount(value) {
  if (value == null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseWallet(payload = {}) {
  if (!payload.As) return null;
  return {
    gold: toAmount(payload.As.gold),
    chip: toAmount(payload.As.chip),
    vip: payload.As.vip ?? null,
    safe: toAmount(payload.As.safe),
    guarranteed_chip: toAmount(payload.As.guarranteed_chip),
    guarranteed_gold: toAmount(payload.As.guarranteed_gold)
  };
}

class SunwinWSSession extends EventEmitter {
  constructor({ config = defaultConfig, axiosConfig = {} } = {}) {
    super();
    this.config = config;
    this.axiosConfig = axiosConfig;
    this.ws = null;
    this.status = 'idle';
    this.wallet = null;
    this.wsMeta = null;
    this.messages = [];
    this.error = null;
    this.connectedAt = null;
    this.lastMessageAt = null;
    this.pingInterval = null;
    this.loginContext = null;
    this.on('error', () => {});
  }

  getState() {
    return {
      status: this.status,
      wallet: this.wallet,
      wsMeta: this.wsMeta,
      error: this.error,
      connectedAt: this.connectedAt,
      lastMessageAt: this.lastMessageAt,
      messageCount: this.messages.length,
      lastMessage: this.messages[0] || null
    };
  }

  _setStatus(status, meta = {}) {
    this.status = status;
    this.emit('status', { status, ...meta });
  }

  _pushMessage(parsed) {
    const entry = {
      at: Date.now(),
      cmd: Array.isArray(parsed) ? parsed[0] : null,
      cmdLabel: CMD_LABELS[Array.isArray(parsed) ? parsed[0] : ''] || 'unknown',
      payload: Array.isArray(parsed) ? parsed[1] : parsed,
      raw: parsed
    };

    this.messages.unshift(entry);
    if (this.messages.length > 200) this.messages.length = 200;
    this.lastMessageAt = entry.at;
    this.emit('message', entry);
    return entry;
  }

  _handleParsedMessage(parsed) {
    const entry = this._pushMessage(parsed);

    if (entry.cmd === 5) {
      const wallet = parseWallet(entry.payload);
      if (wallet) {
        this.wallet = wallet;
        this.wsMeta = {
          gold: wallet.gold,
          chip: wallet.chip,
          vip: wallet.vip,
          safe: wallet.safe
        };
        this.emit('wallet', { wallet, wsMeta: this.wsMeta });
      }
    }
  }

  connect({ token, loginData, password }) {
    if (this.ws) this.disconnect();

    this.loginContext = { token, loginData, password };
    this.error = null;
    this._setStatus('connecting');

    const agent = this.axiosConfig.httpsAgent || this.axiosConfig.httpAgent || null;
    const ws = new WebSocket(`${this.config.wsUrl}?token=${token}`, {
      agent: agent || undefined,
      handshakeTimeout: this.config.wsTimeoutMs,
      perMessageDeflate: false
    });

    this.ws = ws;

    ws.on('open', () => {
      this.connectedAt = Date.now();
      this._setStatus('connected');

      this.pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) sendPing(ws);
      }, 30000);

      const username = loginData?.info?.username || loginData?.username || '';
      sendInit(
        ws,
        'Livestream',
        username,
        password,
        loginData?.info || loginData,
        loginData?.signature,
        loginData?.platformId || this.config.platformId
      );
    });

    ws.on('message', (data) => {
      try {
        this._handleParsedMessage(JSON.parse(data.toString()));
      } catch (err) {
        this.error = err.message;
        this.emit('error', { message: err.message });
      }
    });

    ws.on('close', (code, reason) => {
      this._cleanup();
      this._setStatus('disconnected', {
        code,
        reason: reason?.toString() || ''
      });
    });

    ws.on('error', (err) => {
      this.error = err.message;
      this._cleanup();
      this._setStatus('error', { message: err.message });
      this.emit('error', { message: err.message });
    });

    return this;
  }

  _cleanup() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  disconnect() {
    this._cleanup();
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    if (this.status !== 'error') {
      this._setStatus('disconnected');
    }
  }

  waitForWallet(timeoutMs = defaultConfig.wsTimeoutMs) {
    if (this.wallet) {
      return Promise.resolve({ wallet: this.wallet, wsMeta: this.wsMeta });
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        cleanup();
        resolve({
          wallet: this.wallet,
          wsMeta: this.wsMeta,
          error: this.error || (this.wallet ? null : 'Wallet timeout')
        });
      }, timeoutMs);

      const onWallet = ({ wallet, wsMeta }) => {
        cleanup();
        resolve({ wallet, wsMeta });
      };

      const onError = ({ message }) => {
        cleanup();
        resolve({ wallet: this.wallet, wsMeta: this.wsMeta, error: message });
      };

      const cleanup = () => {
        clearTimeout(timeout);
        this.off('wallet', onWallet);
        this.off('error', onError);
      };

      this.on('wallet', onWallet);
      this.on('error', onError);
    });
  }
}

function getWalletInfoFromWS(options) {
  const session = new SunwinWSSession(options);

  return session
    .connect({
      token: options.token,
      loginData: options.loginData,
      password: options.password
    })
    .waitForWallet(options.config?.wsTimeoutMs || defaultConfig.wsTimeoutMs)
    .then((result) => {
      session.disconnect();
      return result;
    });
}

module.exports = {
  SunwinWSSession,
  getWalletInfoFromWS,
  CMD_LABELS,
  parseWallet
};
