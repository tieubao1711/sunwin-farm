const { SunwinClient } = require('../src');

async function main() {
  const username = process.env.SUNWIN_USERNAME;
  const password = process.env.SUNWIN_PASSWORD;
  const proxyUrl = process.env.SUNWIN_PROXY_URL || '';

  if (!username || !password) {
    throw new Error('Set SUNWIN_USERNAME and SUNWIN_PASSWORD first');
  }

  const client = new SunwinClient({ proxyUrl });
  const result = await client.getFullInfo({ username, password, limit: 5 });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
