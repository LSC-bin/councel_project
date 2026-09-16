// 프레임리스 창 커스텀 윈도우 컨트롤 기능 테스트 (xvfb + CDP)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const proc = spawn('xvfb-run', ['-a', 'npx', 'electron', '.', '--remote-debugging-port=9444', '--no-sandbox'], {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe']
});
let log = '';
proc.stdout.on('data', (d) => (log += d));
proc.stderr.on('data', (d) => (log += d));

// 데몬 대기
let browser = null;
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  try {
    browser = await chromium.connectOverCDP('http://127.0.0.1:9444');
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
  page = browser
    .contexts()
    .flatMap((c) => c.pages())
    .find((p) => p.url().startsWith('file://'));
  if (page) {
    try {
      const has = await page.$('.win-controls');
      if (has) break;
    } catch {}
  }
  await new Promise((r) => setTimeout(r, 1000));
}
if (!page) {
  console.log('NO APP PAGE\n', log.slice(-1500));
  proc.kill('SIGKILL');
  process.exit(1);
}
await page.waitForTimeout(1000);

// 1) IPC 연결 확인
const isMax0 = await page.evaluate(() => window.api.winIsMaximized());
console.log('isMaximized initial:', isMax0);

// 2) 최대화 토글
await page.click('.win-btn:nth-child(2)');
await page.waitForTimeout(800);
const isMax1 = await page.evaluate(() => window.api.winIsMaximized());
console.log('after maximize click:', isMax1);
await page.click('.win-btn:nth-child(2)');
await page.waitForTimeout(800);
const isMax2 = await page.evaluate(() => window.api.winIsMaximized());
console.log('after restore click:', isMax2);

// 3) 최소화
await page.click('.win-btn:nth-child(1)');
await page.waitForTimeout(1000);
const vis = await page.evaluate(() => document.visibilityState);
console.log('visibility after minimize:', vis);

// 복구(최소화 해제는 OS 수준이라 IPC로 불가 → 상태만 기록)
console.log('log tail:', log.slice(-400));
proc.kill('SIGKILL');
process.exit(0);
