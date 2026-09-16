// 관계 그래프: 클릭=선택 / 드래그=선택 안됨 + 노드 이동 확인 (xvfb + CDP)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const proc = spawn('xvfb-run', ['-a', 'npx', 'electron', '.', '--remote-debugging-port=9447', '--no-sandbox'], {
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
    browser = await chromium.connectOverCDP('http://127.0.0.1:9447');
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
      const has = await page.$('.sidebar');
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

async function gotoRelations() {
  await page.evaluate(() => { window.location.hash = '#/'; });
  await page.waitForTimeout(500);
  await page.evaluate(() => { window.location.hash = '#/relations'; });
  // 그래프 노드(10개 이상)가 렌더될 때까지 폴링
  for (let i = 0; i < 30; i++) {
    const n = await page.$$('svg g circle');
    if (n.length >= 10) return n;
    await page.waitForTimeout(300);
  }
  return page.$$('svg g circle');
}

const panelTitles = () => page.$$eval('.section-title', (els) => els.map((e) => e.textContent.trim()));

// 1) 클릭 → 선택 패널
let nodes = await gotoRelations();
console.log('node count:', nodes.length);
let box = await nodes[0].boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await page.waitForTimeout(500);
console.log('after click panel:', JSON.stringify(await panelTitles()));

// 2) 상태 리셋 후 드래그 → 선택 패널 없어야 하고, 노드 위치는 바뀌어야 함
nodes = await gotoRelations();
box = await nodes[0].boundingBox();
const before = { x: box.x, y: box.y };
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 + 70, box.y + box.height / 2 + 50, { steps: 10 });
await page.mouse.up();
await page.waitForTimeout(500);
console.log('after drag panel:', JSON.stringify(await panelTitles()));
const after = await nodes[0].boundingBox();
console.log('node moved:', JSON.stringify(before), '->', JSON.stringify(after), 'moved:', Math.hypot(after.x - before.x, after.y - before.y) > 10);
await page.screenshot({ path: 'shots/graph-drag.png' });

proc.kill('SIGKILL');
process.exit(0);
