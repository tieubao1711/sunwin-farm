const { WebSocketServer } = require('ws');
const { SunwinClient, SunwinWSSession } = require('../src');
const { normalizeProxyUrl } = require('../src/proxy');

function attachWsHub(server) {
  const wss = new WebSocketServer({ server, path: '/ws/live' });
  const clients = new Set();

  function send(client, payload) {
    if (client.readyState === 1) {
      client.send(JSON.stringify(payload));
    }
  }

  wss.on('connection', (client) => {
    clients.add(client);
    let session = null;

    send(client, { type: 'status', status: 'idle', at: Date.now() });

    client.on('message', async (raw) => {
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        send(client, { type: 'error', message: 'Invalid JSON message' });
        return;
      }

      if (message.type === 'connect') {
        if (session) session.disconnect();

        const { username, password, proxyUrl: rawProxy } = message;
        const proxyUrl = normalizeProxyUrl(rawProxy || '');
        if (!username || !password) {
          send(client, { type: 'error', message: 'Missing username/password' });
          return;
        }

        try {
          send(client, { type: 'status', status: 'logging-in', at: Date.now() });

          const apiClient = new SunwinClient({ proxyUrl: proxyUrl || '' });
          const loginResponse = await apiClient.login({ username, password, proxyUrl });
          const info = apiClient.parseAccountInfo(loginResponse);

          send(client, {
            type: 'login',
            success: true,
            profile: info.profile,
            at: Date.now()
          });

          session = new SunwinWSSession({
            axiosConfig: apiClient.getAxiosConfig({ proxyUrl })
          });

          session.on('status', (data) => {
            send(client, { type: 'status', ...data, at: Date.now() });
          });

          session.on('wallet', (data) => {
            send(client, { type: 'wallet', ...data, at: Date.now() });
          });

          session.on('message', (entry) => {
            send(client, { type: 'message', entry, at: Date.now() });
          });

          session.on('error', (data) => {
            send(client, { type: 'error', ...data, at: Date.now() });
          });

          session.connect({
            token: info.wsToken,
            loginData: loginResponse.data,
            password
          });
        } catch (err) {
          send(client, { type: 'error', message: err.message, at: Date.now() });
          send(client, { type: 'status', status: 'error', at: Date.now() });
        }
        return;
      }

      if (message.type === 'disconnect') {
        if (session) {
          session.disconnect();
          session = null;
        }
        send(client, { type: 'status', status: 'disconnected', at: Date.now() });
        return;
      }

      if (message.type === 'state') {
        send(client, {
          type: 'state',
          data: session ? session.getState() : { status: 'idle' },
          at: Date.now()
        });
      }
    });

    client.on('close', () => {
      clients.delete(client);
      if (session) {
        session.disconnect();
        session = null;
      }
    });
  });

  return wss;
}

module.exports = {
  attachWsHub
};
