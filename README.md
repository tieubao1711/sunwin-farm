# Sunwin API Kit

Package tach rieng tu `nodesunwin` de dung cho tool nuoi account.

## Cai dat

```bash
npm install
```

## API co san

- `client.login({ username, password, proxyUrl })`
- `client.register({ username, password, displayName, proxyUrl, alsoLogin })`
- `client.getFullInfo({ username, password, proxyUrl, limit })`
- `client.getBetHistory(accessToken, { limit, skip, proxyUrl })`
- `client.getDepositHistory(accessToken, { limit, skip, proxyUrl })`
- `client.getWithdrawHistory(accessToken, { limit, skip, proxyUrl })`
- `client.getWalletInfo({ wsToken, loginData, password, proxyUrl })`
- `client.changePassword({ username, password, newPassword, proxyUrl })`
- `client.verifyBankAccount({ username, password, bankId, accountHolder, accountNo, proxyUrl })`
- `client.depositCodePay({ username, password, bankAccountId, amount, bankId, proxyUrl })`
- `client.getBankAccounts({ username, password, proxyUrl })` — lấy `verifiedBankAccounts`, `verifiedAccountHolder`
- `getBankNameById(bankId)` / `getBankList()` — map id ngân hàng

## Vi du dang ky tai khoan

```js
const { SunwinClient } = require('./src');

const client = new SunwinClient();

async function run() {
  const result = await client.register({
    username: 'olaolaola123',
    password: 'abc123',
    displayName: 'olambbm123'
  });

  console.log(result.success);
  console.log(result.account);
  console.log(result.deviceId);
}

run().catch(console.error);
```

## Vi du get full info

```js
const { SunwinClient } = require('./src');

const client = new SunwinClient({
  proxyUrl: 'http://user:pass@host:port'
});

async function run() {
  const result = await client.getFullInfo({
    username: 'account',
    password: 'password',
    limit: 5
  });

  console.log(result.data.profile);
  console.log(result.data.walletInfo);
  console.log(result.data.transactions);
  console.log(result.data.slipHistory.deposit);
  console.log(result.data.slipHistory.withdraw);
}

run().catch(console.error);
```

## Vi du doi mat khau

```js
const { SunwinClient } = require('./src');

const client = new SunwinClient();

async function run() {
  const result = await client.changePassword({
    username: 'account',
    password: 'oldPassword',
    newPassword: 'newPassword'
  });

  console.log(result);
}

run().catch(console.error);
```

## Vi du xac minh ngan hang

```js
const { SunwinClient } = require('./src');

const client = new SunwinClient();

async function run() {
  const result = await client.verifyBankAccount({
    username: 'account',
    password: 'password',
    bankId: '6429821834cff105eef75182', // PGbank
    accountHolder: 'nguyen van trung',
    accountNo: '5213125213'
  });

  console.log(result);
}

run().catch(console.error);
```

## Vi du nap CodePay

```js
const { SunwinClient } = require('./src');

const client = new SunwinClient();

async function run() {
  const result = await client.depositCodePay({
    username: 'account',
    password: 'password',
    bankAccountId: '69833b1a6b14962ff9289a5d',
    amount: 100000,
    bankId: '69833b1a6b14962ff9289a5d'
  });

  console.log(result.data.data.codepay);
  console.log(result.data.data.qrcode);
}

run().catch(console.error);
```

## Web test API (Vite + React)

Chay dong thoi API server va frontend:

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- API server: `http://localhost:3001`

Frontend proxy `/api/*` sang server Node, server goi `SunwinClient` trong `src/`.

## Chay example bang env

```bash
set SUNWIN_USERNAME=account
set SUNWIN_PASSWORD=password
set SUNWIN_PROXY_URL=615ec4dce0eb1e0b638e__nocr.vn:8975de743c3be814@gw.dataimpulse.com:823
npm run test:login
```

```bash
set SUNWIN_USERNAME=account
set SUNWIN_PASSWORD=oldPassword
set SUNWIN_NEW_PASSWORD=newPassword
npm run test:change-password
```

## Config env

- `SUNWIN_PLATFORM_ID`, default `2`
- `SUNWIN_BRAND`, default `sun.win`
- `SUNWIN_HSK`, default tu project hien tai
- `SUNWIN_LOGIN_URL`, default `https://api.azhkthg1.net/id`
- `SUNWIN_TRANSACTION_URL`, default `https://api.azhkthg1.net/sa`
- `SUNWIN_PAYGATE_URL`, default `https://api1.azhkthg1.net/paygate`
- `SUNWIN_WS_URL`, default `wss://livearena.azhkthg1.net/lobby`
- `SUNWIN_TIMEOUT_MS`, default `10000`
- `SUNWIN_WS_TIMEOUT_MS`, default `15000`
- `SUNWIN_PROXY_URL`, proxy mac dinh — ho tro `user:pass@host:port` hoac `http://...`

## Proxy xoay

Dán trực tiếp chuỗi proxy xoay (DataImpulse, v.v.):

```
615ec4dce0eb1e0b638e__nocr.vn:8975de743c3be814@gw.dataimpulse.com:823
```

Kit tự chuyển thành URL cho axios/WebSocket. Có thể set qua UI hoặc env `SUNWIN_PROXY_URL`.

