require('dotenv').config()

const http = require('http');
const express = require('express');
const cors = require('cors');
const { SunwinClient, getBankList, normalizeProxyUrl } = require('../src');
const { attachWsHub } = require('./ws-hub');
const { connectDb, isDbReady } = require('./db');
const farmRoutes = require('./routes/farm');

const app = express();
const PORT = Number(process.env.API_PORT || 3001);

app.use(cors());
app.use(express.json({ limit: '2mb' }));

connectDb().catch((err) => {
  console.error('MongoDB connection failed:', err.message);
  console.error('Farm data API will not work until MongoDB is available.');
});

function farmDbGuard(_req, res, next) {
  if (!isDbReady()) {
    return res.status(503).json({
      success: false,
      message: 'MongoDB chưa kết nối. Kiểm tra MONGODB_URI và chạy MongoDB.'
    });
  }
  return next();
}

app.use('/api/farm', farmDbGuard, farmRoutes);

function createClient(proxyUrl) {
  return new SunwinClient({ proxyUrl: normalizeProxyUrl(proxyUrl || '') });
}

function pickCommon(body) {
  return {
    username: body.username,
    password: body.password,
    proxyUrl: normalizeProxyUrl(body.proxyUrl || '')
  };
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'sunwin-api-kit',
    version: '1.5.0',
    mongodb: isDbReady(),
    routes: [
      'GET  /api/farm/state',
      'GET  /api/farm/banks',
      'GET  /api/farm/banks/grouped',
      'POST /api/farm/banks/import',
      'POST /api/login',
      'POST /api/register',
      'POST /api/full-info',
      'POST /api/wallet',
      'POST /api/bet-history',
      'POST /api/deposit-history',
      'POST /api/withdraw-history',
      'POST /api/change-password',
      'POST /api/verify-bank-account',
      'POST /api/create-code-pay',
      'POST /api/fetch-bank-accounts',
      'WS /ws/live'
    ]
  });
});

app.get('/api/banks', (_req, res) => {
  res.json({ success: true, data: getBankList() });
});

app.post('/api/login', async (req, res) => {
  try {
    const client = createClient(req.body.proxyUrl);
    const data = await client.login(pickCommon(req.body));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const client = createClient(req.body.proxyUrl);
    const result = await client.register({
      ...pickCommon(req.body),
      displayName: req.body.displayName,
      os: req.body.os,
      alsoLogin: req.body.alsoLogin !== false
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/full-info', async (req, res) => {
  try {
    const client = createClient(req.body.proxyUrl);
    const result = await client.getFullInfo({
      ...pickCommon(req.body),
      limit: Number(req.body.limit) || 5
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/bet-history', async (req, res) => {
  try {
    const client = createClient(req.body.proxyUrl);
    const loginResponse = await client.login(pickCommon(req.body));
    const info = client.parseAccountInfo(loginResponse);
    const data = await client.getBetHistory(info.accessToken, {
      limit: Number(req.body.limit) || 5,
      skip: Number(req.body.skip) || 0,
      proxyUrl: req.body.proxyUrl
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/deposit-history', async (req, res) => {
  try {
    const client = createClient(req.body.proxyUrl);
    const loginResponse = await client.login(pickCommon(req.body));
    const info = client.parseAccountInfo(loginResponse);
    const data = await client.getDepositHistory(info.accessToken, {
      limit: Number(req.body.limit) || 5,
      skip: Number(req.body.skip) || 0,
      proxyUrl: req.body.proxyUrl
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/withdraw-history', async (req, res) => {
  try {
    const client = createClient(req.body.proxyUrl);
    const loginResponse = await client.login(pickCommon(req.body));
    const info = client.parseAccountInfo(loginResponse);
    const data = await client.getWithdrawHistory(info.accessToken, {
      limit: Number(req.body.limit) || 5,
      skip: Number(req.body.skip) || 0,
      proxyUrl: req.body.proxyUrl
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/wallet', async (req, res) => {
  try {
    const client = createClient(req.body.proxyUrl);
    const loginResponse = await client.login(pickCommon(req.body));
    const info = client.parseAccountInfo(loginResponse);
    const data = await client.getWalletInfo({
      wsToken: info.wsToken,
      loginData: loginResponse.data,
      password: req.body.password,
      proxyUrl: req.body.proxyUrl
    });
    res.json({
      success: !data?.error,
      data: {
        wallet: data?.wallet || null,
        error: data?.error || null
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/change-password', async (req, res) => {
  try {
    const client = createClient(req.body.proxyUrl);
    const result = await client.changePassword({
      username: req.body.username,
      password: req.body.password,
      newPassword: req.body.newPassword,
      proxyUrl: req.body.proxyUrl
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/verify-bank-account', async (req, res) => {
  try {
    const client = createClient(req.body.proxyUrl);
    const result = await client.verifyBankAccount({
      ...pickCommon(req.body),
      bankId: req.body.bankId,
      accountHolder: req.body.accountHolder,
      accountNo: req.body.accountNo
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/create-code-pay', async (req, res) => {
  try {
    const client = createClient(req.body.proxyUrl);
    const result = await client.depositCodePay({
      ...pickCommon(req.body),
      bankAccountId: req.body.bankAccountId,
      amount: Number(req.body.amount),
      bankId: req.body.bankId
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/fetch-bank-accounts', async (req, res) => {
  try {
    const client = createClient(req.body.proxyUrl);
    const result = await client.getBankAccounts(pickCommon(req.body));
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.use('/api', (_req, res) => {
  res.status(404).json({ success: false, message: 'API route not found' });
});

app.use((err, _req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({
    success: false,
    message: err.message || 'Server error'
  });
});

const server = http.createServer(app);
attachWsHub(server);

server.listen(PORT, () => {
  console.log(`Sunwin API server running at http://localhost:${PORT}`);
  console.log(`WebSocket live monitor at ws://localhost:${PORT}/ws/live`);
});
