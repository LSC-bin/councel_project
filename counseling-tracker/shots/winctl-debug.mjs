import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const proc = spawn('xvfb-run', ['-a', 'npx', 'electron', '.', '--remote-debugging-port=9334', '--no-sandbox'], {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe']
});
let log = '';
proc.stdout.on('data', (d) => (log += d));
proc.stderr.on('data', (d) => (log += d));

let browser = null;
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  try {
    browser = await chromium.connectOverCDP('http://127.0.0.1:9334');
    break;
  } catch {}
}
if (!browser) {
  console.log('CONNECT FAIL\n', log.slice(-3000));
  proc.kill('SIGKILL');
  process.exit(1);
}
await new Promise((r) => setTimeout(r, 3000));
for (const ctx of browser.contexts()) {
  for (const p of ctx.pages()) {
    console.log('PAGE:', p.url());
    try {
      const html = await p.evaluate(() => document.body ? document.body.innerHTML.slice(0, 600) : 'NO BODY');
      console.log('BODY:', html.replace(/\s+/g, ' '));
      const errs = await p.evaluate(() => (window.__errs ?? null));
      console.log('---');
    } catch (e) {
      console.log('eval fail', e.message);
    }
  }
}
console.log('ELECTRON LOG:', log.slice(-1500));
proc.kill('SIGKILL');
process.exit(0);
