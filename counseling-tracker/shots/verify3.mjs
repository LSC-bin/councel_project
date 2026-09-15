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
await new Promise((r) => server.listen(8933, r));
const stub = `
window.api = new Proxy({}, { get: (_t, prop) => {
  const map = {
    getPlatform: 'linux', bootState: {encryptionEnabled:false, dbOpen:true, hasPassword:false},
    getSetting: 'light', getPendingActionsSummary: {overdue:1, today:2, tomorrow:0, total:3},
    getMonthlyStats: {monthly:[{month:'2026-08',count:12},{month:'2026-09',count:9}], byType:[{type_name:'개인상담',type_color:'#007aff',count:8},{type_name:'학업',type_color:'#34c759',count:4}], thisMonthCount:9, followUpPending:2, studentCount:48, niceUnreflectedCount:3},
    getCrisisAlerts: [],
    getRecords: [
      {id:1, student_id:1, student_name:'김민준', record_date:'2026-09-15', content:'친구 관계 고민 상담.', type_name:'개인상담', type_color:'#007aff', state_score:6, follow_up_needed:1, follow_up_done:0, reflected_in_nice:0, next_appointment:'2026-09-18', folder_name:null},
      {id:2, student_id:2, student_name:'이서연', record_date:'2026-09-14', content:'진로 상담.', type_name:'진로', type_color:'#ff9500', state_score:8, follow_up_needed:0, follow_up_done:0, reflected_in_nice:1, next_appointment:null, folder_name:null}],
    getPinnedStudents: [{id:1,name:'김민준',grade:1,class_no:2,number:5,pinned:1},{id:2,name:'이서연',grade:1,class_no:2,number:12,pinned:1},{id:3,name:'박지호',grade:1,class_no:3,number:1,pinned:1}],
    getActions: [{id:1, text:'보호자 전화 상담', done:0, due_date:'2026-09-15', student_name:'김민준', repeat_days:null},{id:2, text:'위클래스 연계 의뢰', done:0, due_date:'2026-09-20', student_name:'박지호', repeat_days:null}],
    getStudentsWithStats: [{id:1,name:'김민준',grade:1,class_no:2,number:5,record_count:6,last_record_date:'2026-09-15',pinned:1,active:1}],
    getFolders: [], getUpcomingAppointments: [{id:1,student_name:'김민준',appt_date:'2026-09-16',start_time:'14:00',end_time:'14:40',note:null}],
    getAppointmentsInRange: [{id:1,student_id:1,student_name:'김민준',appt_date:'2026-09-16',start_time:'14:00',end_time:'14:40',note:null}],
    getClassHeatmap: [{grade:1,class_no:2,count:7},{grade:1,class_no:1,count:3}],
    getStudentRanking: [{student_id:1,name:'김민준',grade:1,class_no:2,number:5,count:6}],
    getTypeTrend: [{type_id:1,type_name:'개인상담',type_color:'#007aff',month:'2026-08',count:5},{type_id:1,type_name:'개인상담',type_color:'#007aff',month:'2026-09',count:8},{type_id:2,type_name:'학업',type_color:'#34c759',month:'2026-09',count:4}],
    getClassSummary: [], getRecentAudit: [], getConsultTypes: [{id:1,name:'개인상담',color:'#007aff'}],
    getStudents: [{id:1,name:'김민준',grade:1,class_no:2,number:5,pinned:0,active:1}],
  };
  const v = map[prop];
  return (...a) => Promise.resolve(v === undefined ? [] : v);
}});
`;
const browser = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(stub);
await page.goto('http://localhost:8933/', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.screenshot({ path: 'shots/v2-dash-light.png' });
await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/v2-dash-dark.png' });
await page.goto('http://localhost:8933/#/statistics', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.screenshot({ path: 'shots/v2-stats-dark.png' });
await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
await page.waitForTimeout(600);
await page.screenshot({ path: 'shots/v2-stats-light.png' });
await browser.close();
server.close();
console.log('v2 shots done');
