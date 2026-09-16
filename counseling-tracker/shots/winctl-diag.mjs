import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const PORT = 9446;
const proc = spawn('xvfb-run', ['-a', 'npx', 'electron', '.', `--remote-debugging-port=${PORT}`, '--no-sandbox'], {
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
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
    break;
  } catch {}
}
if (!browser) {
  console.log('CONNECT FAIL\n', log.slice(-2000));
  proc.kill('SIGKILL');
  process.exit(1);
}
let page = null;
for (let i = 0; i < 40; i++) {
  page = browser.contexts().flatMap((c) => c.pages()).find((p) => p.url().startsWith('file://'));
  if (page && (await page.$('.win-controls'))) break;
  page = null;
  await new Promise((r) => setTimeout(r, 1000));
}
if (!page) {
  console.log('NO APP PAGE');
  proc.kill('SIGKILL');
  process.exit(1);
}
await page.waitForTimeout(800);

// A) JS 직접 클릭 (IPC 경로 검증)
await page.evaluate(() => document.querySelectorAll('.win-btn')[1].click());
await page.waitForTimeout(700);
console.log('A js-click maximize ->', await page.evaluate(() => window.api.winIsMaximized()));
await page.evaluate(() => document.querySelectorAll('.win-btn')[1].click());
await page.waitForTimeout(700);
console.log('A js-click restore  ->', await page.evaluate(() => window.api.winIsMaximized()));

// B) 실제 마우스 클릭 (히트테스트 검증)
const box = await page.locator('.win-btn').nth(1).boundingBox();
console.log('B maximize btn box:', JSON.stringify(box));
const elAt = await page.evaluate(([x, y]) => {
  const el = document.elementFromPoint(x, y);
  return el ? el.className + '|' + el.tagName : 'null';
}, [box.x + box.width / 2, box.y + box.height / 2]);
console.log('B elementFromPoint at btn:', elAt);
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await page.waitForTimeout(700);
console.log('B mouse-click maximize ->', await page.evaluate(() => window.api.winIsMaximized()));

proc.kill('SIGKILL');
process.exit(0);
