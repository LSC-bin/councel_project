// 시연 동영상 녹화 v2: Xvfb + electron + CDP 조작 + ffmpeg x11grab
// 사용: node shots/demo-record.mjs
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const DISPLAY = ':99';
const OUT = process.env.DEMO_OUT || 'shots/demo-raw.mp4';
const PORT = '9333';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1) Xvfb
const xvfb = spawn('Xvfb', [DISPLAY, '-screen', '0', '1280x800x24'], { stdio: 'ignore' });
await sleep(1500);

// 2) ffmpeg 녹화
if (fs.existsSync(OUT)) fs.unlinkSync(OUT);
const rec = spawn('ffmpeg', [
  '-y', '-f', 'x11grab', '-video_size', '1280x800', '-framerate', '15',
  '-i', DISPLAY, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26',
  '-pix_fmt', 'yuv420p', OUT,
], { env: { ...process.env, DISPLAY }, stdio: 'ignore' });
await sleep(1000);

// 3) electron
const app = spawn('npx', ['electron', '.', '--no-sandbox', `--remote-debugging-port=${PORT}`], {
  env: { ...process.env, DISPLAY }, stdio: 'ignore',
});
await sleep(7000);

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
const ctx = browser.contexts()[0];
const page = ctx.pages().find((p) => p.url().includes('index.html')) || ctx.pages()[0];
await page.waitForTimeout(2000);

const nav = async (label, ms = 8000) => {
  try {
    await page.click(`text="${label}"`, { timeout: 4000 });
  } catch (e) { console.log('nav 실패:', label); }
  await page.waitForTimeout(ms);
};

// 시나리오 (총 ~4분 30초 목표)
await page.waitForTimeout(6000);            // 대시보드 (위기 알림·캘린더·최근 기록)

await nav('기록 입력', 20000);              // 상담 기록 입력 화면
// 학생 선택·내용 입력 시연
try {
  const inputs = page.locator('input, textarea');
  const n = await inputs.count();
  console.log('기록입력 input 수:', n);
} catch {}

await nav('조회·검색', 15000);              // 검색 화면
try {
  const search = page.locator('input[placeholder*="검색"], input[type="search"]').first();
  if (await search.count()) {
    await search.click();
    await search.type('김민준', { delay: 150 });
    await page.waitForTimeout(4000);
  }
} catch (e) { console.log('검색 시연 실패:', e.message.slice(0, 80)); }

await nav('학생 관리', 12000);              // 학생 목록
try {
  await page.click('.student-row, tbody tr', { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(5000);          // 학생 상세
} catch {}

await nav('관계 그래프', 15000);            // 학생 관계 그래프

await nav('통계', 15000);                   // 월별·유형별 통계 차트

await nav('보고서·백업', 12000);            // 엑셀 내보내기·백업 화면

await nav('설정', 12000);                   // 보안(암호화)·데이터 설정

await nav('대시보드', 6000);                // 마무리
await page.waitForTimeout(3000);

// 정리
await browser.close();
app.kill('SIGTERM');
await sleep(800);
rec.kill('SIGINT');
await sleep(3000);
xvfb.kill('SIGTERM');

const size = fs.existsSync(OUT) ? fs.statSync(OUT).size : 0;
console.log('녹화 완료:', OUT, (size / 1024 / 1024).toFixed(1) + 'MB');
