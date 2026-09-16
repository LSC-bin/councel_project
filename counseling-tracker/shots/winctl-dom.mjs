import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
const PORT = 9447;
const proc = spawn('xvfb-run', ['-a', 'npx', 'electron', '.', `--remote-debugging-port=${PORT}`, '--no-sandbox'], {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe']
});
let browser = null;
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  try {
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
    break;
  } catch {}
}
let page = null;
for (let i = 0; i < 40; i++) {
  page = browser.contexts().flatMap((c) => c.pages()).find((p) => p.url().startsWith('file://'));
  if (page && (await page.$('.win-controls'))) break;
  page = null;
  await new Promise((r) => setTimeout(r, 1000));
}
await page.waitForTimeout(1500);
console.log(
  await page.evaluate(() => {
    const wc = document.querySelector('.win-controls');
    const hdr = document.querySelector('.page-header');
    return JSON.stringify({
      wcClass: wc?.className,
      wcParent: wc?.parentElement?.className,
      hdrExists: !!hdr,
      hdrChildren: hdr ? Array.from(hdr.children).map((c) => c.className) : null,
      hash: location.hash
    });
  })
);
proc.kill('SIGKILL');
process.exit(0);
