import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve('out/renderer');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(ROOT, 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  res.end(fs.readFileSync(p));
});
await new Promise((r) => server.listen(8932, r));
const stub = `
window.api = new Proxy({}, { get: (_t, prop) => {
  const map = {
    getPlatform: 'linux', bootState: {encryptionEnabled:false, dbOpen:true, hasPassword:false},
    getSetting: 'light', getPendingActionsSummary: {overdue:0, today:0, tomorrow:0, total:0},
    getStudentsWithStats: [{id:1,name:'김민준',grade:1,class_no:2,number:5,record_count:6,last_record_date:'2026-09-15',pinned:0,active:1}],
    getStudents: [{id:1,name:'김민준',grade:1,class_no:2,number:5,pinned:0,active:1}],
    getFolders: [], getConsultTypes: [{id:1,name:'개인상담',color:'#007aff'}],
    getRecords: [], getActions: [], getMonthlyStats: {monthly:[],byType:[],thisMonthCount:0,followUpPending:0,studentCount:1,niceUnreflectedCount:0},
    getCrisisAlerts: [], getPinnedStudents: [], getUpcomingAppointments: [], getAppointmentsInRange: [],
    getClassHeatmap: [], getStudentRanking: [], getTypeTrend: [], getClassSummary: [], getRecentAudit: [],
    getQuickTemplates: [],
  };
  const v = map[prop];
  return (...a) => Promise.resolve(v === undefined ? [] : v);
}});
`;
const browser = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(stub);
await page.goto('http://localhost:8932/#/students', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await page.click('text=학생 추가');
await page.waitForTimeout(600);
await page.screenshot({ path: 'shots/modal.png' });
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.click('.sidebar-toggle');
await page.waitForTimeout(600);
await page.screenshot({ path: 'shots/collapsed.png' });
await browser.close();
server.close();
console.log('extra shots done');
