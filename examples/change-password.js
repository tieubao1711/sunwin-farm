const { SunwinClient } = require('../src');

async function main() {
  const username = process.env.SUNWIN_USERNAME;
  const password = process.env.SUNWIN_PASSWORD;
  const newPassword = process.env.SUNWIN_NEW_PASSWORD;
  const proxyUrl = process.env.SUNWIN_PROXY_URL || '';

  if (!username || !password || !newPassword) {
    throw new Error('Set SUNWIN_USERNAME, SUNWIN_PASSWORD and SUNWIN_NEW_PASSWORD first');
  }

  const client = new SunwinClient({ proxyUrl });
  const result = await client.changePassword({ username, password, newPassword });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
