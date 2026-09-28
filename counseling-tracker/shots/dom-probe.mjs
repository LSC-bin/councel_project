// 앱 실제 DOM 탐색: 네비게이션 항목·주요 버튼 셀렉터 덤프
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const DISPLAY = ':98';
const xvfb = spawn('Xvfb', [DISPLAY, '-screen', '0', '1280x800x24'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const app = spawn('npx', ['electron', '.', '--no-sandbox', '--remote-debugging-port=9334'], {
  env: { ...process.env, DISPLAY }, stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 6000));
const browser = await chromium.connectOverCDP('http://127.0.0.1:9334');
const ctx = browser.contexts()[0];
const page = ctx.pages().find((p) => p.url().includes('index.html')) || ctx.pages()[0];
await page.waitForTimeout(1500);

const info = await page.evaluate(() => {
  const nav = [...document.querySelectorAll('nav *, aside *, [class*=sidebar] *, [class*=nav] *')]
    .filter((el) => el.children.length === 0 && el.textContent.trim())
    .map((el) => ({ tag: el.tagName, cls: el.className?.toString?.().slice(0, 40), txt: el.textContent.trim().slice(0, 20) }));
  const buttons = [...document.querySelectorAll('button')].slice(0, 30).map((b) => ({ cls: b.className?.slice(0, 40), txt: b.textContent.trim().slice(0, 20) }));
  return { title: document.title, url: location.hash, nav: nav.slice(0, 30), buttons, body: document.body.innerText.slice(0, 400) };
});
console.log(JSON.stringify(info, null, 1));

await browser.close();
app.kill('SIGTERM');
xvfb.kill('SIGTERM');
