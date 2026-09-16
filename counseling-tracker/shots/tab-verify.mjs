// 학생 추가 모달 탭 + 설정 탭 스크린샷 검증 (xvfb + CDP)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const proc = spawn('xvfb-run', ['-a', 'npx', 'electron', '.', '--remote-debugging-port=9445', '--no-sandbox'], {
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
    browser = await chromium.connectOverCDP('http://127.0.0.1:9445');
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

// 잠금화면이면 우회 시도
const locked = await page.$('.lock-screen');
if (locked) console.log('LOCK SCREEN present — skipping navigation shots');

// 1) 학생 관리: 버튼 1개(학생 추가)인지 확인
await page.evaluate(() => { window.location.hash = '#/students'; });
await page.waitForTimeout(800);
const btnTexts = await page.$$eval('button', (bs) => bs.map((b) => b.textContent.trim()).filter(Boolean));
console.log('students page buttons:', JSON.stringify(btnTexts));

// 학생 추가 모달 열기
const addBtn = await page.$('button.btn-primary');
await addBtn.click();
await page.waitForTimeout(600);
const tabs1 = await page.$$eval('.seg-tab', (bs) => bs.map((b) => b.textContent.trim()));
console.log('add modal tabs:', JSON.stringify(tabs1));
await page.screenshot({ path: 'shots/tab-student-manual.png' });

// 엑셀 등록 탭 클릭
const excelTab = (await page.$$('.seg-tab'))[1];
await excelTab.click();
await page.waitForTimeout(400);
const modalBtns = await page.$$eval('.modal-card button', (bs) => bs.map((b) => b.textContent.trim()).filter(Boolean));
console.log('excel tab buttons:', JSON.stringify(modalBtns));
await page.screenshot({ path: 'shots/tab-student-excel.png' });
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// 2) 설정 탭
await page.evaluate(() => { window.location.hash = '#/settings'; });
await page.waitForTimeout(800);
const setTabs = await page.$$eval('.seg-tab', (bs) => bs.map((b) => b.textContent.trim()));
console.log('settings tabs:', JSON.stringify(setTabs));
const sections = await page.$$eval('.section-title', (bs) => bs.map((b) => b.textContent.trim()));
console.log('settings visible sections (data tab):', JSON.stringify(sections));
await page.screenshot({ path: 'shots/tab-settings-data.png' });

// 보안 탭 클릭
const secTab = (await page.$$('.seg-tab')).find; // not used
const tabsEls = await page.$$('.seg-tab');
await tabsEls[2].click();
await page.waitForTimeout(400);
const secSections = await page.$$eval('.section-title', (bs) => bs.map((b) => b.textContent.trim()));
console.log('security tab sections:', JSON.stringify(secSections));
await page.screenshot({ path: 'shots/tab-settings-security.png' });

// 기록·유형 탭
await tabsEls[1].click();
await page.waitForTimeout(400);
const recSections = await page.$$eval('.section-title', (bs) => bs.map((b) => b.textContent.trim()));
console.log('record tab sections:', JSON.stringify(recSections));
await page.screenshot({ path: 'shots/tab-settings-record.png' });

proc.kill('SIGKILL');
process.exit(0);
