const { execSync } = require('child_process');

const port = Number(process.argv[2] || 3001);
const isWin = process.platform === 'win32';

function killPort(targetPort) {
  try {
    if (isWin) {
      const output = execSync('netstat -ano', { encoding: 'utf8' });
      const pids = new Set();

      for (const line of output.split('\n')) {
        if (!line.includes(`:${targetPort}`) || !line.includes('LISTENING')) continue;
        const parts = line.trim().split(/\s+/);
        const pid = Number(parts[parts.length - 1]);
        if (pid > 0) pids.add(pid);
      }

      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
          console.log(`Killed PID ${pid} on port ${targetPort}`);
        } catch {}
      }
      return;
    }

    execSync(`lsof -ti:${targetPort} | xargs kill -9`, { stdio: 'ignore', shell: true });
  } catch {}
}

killPort(port);

module.exports = { killPort };
