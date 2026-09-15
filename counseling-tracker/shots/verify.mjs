// 상담기록관리 렌더러를 chromium headless로 띄워 macOS 스타일 스크린샷 검증
// window.api 스텁: preload 없이 정적 렌더러만 확인
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('out/renderer');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(ROOT, 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  res.end(fs.readFileSync(p));
});
await new Promise((r) => server.listen(8931, r));

const stub = `
window.api = new Proxy({}, { get: (_t, prop) => {
  const map = {
    getPlatform: 'linux', bootState: {encryptionEnabled:false, dbOpen:true, hasPassword:true},
    getSetting: 'light', getPendingActionsSummary: {overdue:1, today:2, tomorrow:0, total:3},
    getMonthlyStats: {monthly:[{month:'2026-08',count:12},{month:'2026-09',count:9}], byType:[{type_name:'개인상담',type_color:'#007aff',count:8},{type_name:'학업',type_color:'#34c759',count:4}], thisMonthCount:9, followUpPending:2, studentCount:48, niceUnreflectedCount:3},
    getCrisisAlerts: [{student_id:1, name:'김민준', count:5}],
    getRecords: [
      {id:1, student_id:1, student_name:'김민준', record_date:'2026-09-15', content:'친구 관계 고민 상담. 다소 위축된 모습 보임.', type_name:'개인상담', type_color:'#007aff', state_score:6, follow_up_needed:1, follow_up_done:0, reflected_in_nice:0, next_appointment:'2026-09-18', folder_name:null},
      {id:2, student_id:2, student_name:'이서연', record_date:'2026-09-14', content:'진로 상담. 특성화고 진학 희망.', type_name:'진로', type_color:'#ff9500', state_score:8, follow_up_needed:0, follow_up_done:0, reflected_in_nice:1, next_appointment:null, folder_name:null},
      {id:3, student_id:3, student_name:'박지호', record_date:'2026-09-13', content:'수업 태도 관련 생활지도.', type_name:'생활지도', type_color:'#ff3b30', state_score:5, follow_up_needed:1, follow_up_done:0, reflected_in_nice:0, next_appointment:null, folder_name:null}],
    getPinnedStudents: [{id:1,name:'김민준',grade:1,class_no:2,number:5,pinned:1},{id:2,name:'이서연',grade:1,class_no:2,number:12,pinned:1}],
    getActions: [{id:1, text:'보호자 전화 상담', done:0, due_date:'2026-09-15', student_name:'김민준', repeat_days:null},{id:2, text:'위클래스 연계 의뢰', done:0, due_date:'2026-09-20', student_name:'박지호', repeat_days:null}],
    getStudentsWithStats: [{id:1,name:'김민준',grade:1,class_no:2,number:5,record_count:6,last_record_date:'2026-09-15',pinned:1,active:1},{id:2,name:'이서연',grade:1,class_no:2,number:12,record_count:2,last_record_date:'2026-09-14',pinned:1,active:1}],
    getFolders: [{id:1,name:'1학기',record_count:20,parent_id:null},{id:2,name:'위기학생',record_count:5,parent_id:null}],
    getUpcomingAppointments: [{id:1,student_name:'김민준',appt_date:'2026-09-16',start_time:'14:00',end_time:'14:40',note:null}],
    getAppointmentsInRange: [{id:1,student_id:1,student_name:'김민준',appt_date:'2026-09-16',start_time:'14:00',end_time:'14:40',note:null}],
    getClassHeatmap: [{grade:1,class_no:2,count:7},{grade:1,class_no:1,count:3}],
    getStudentRanking: [{student_id:1,name:'김민준',grade:1,class_no:2,number:5,count:6}],
    getTypeTrend: [], getClassSummary: [], getRecentAudit: [],
  };
  const v = map[prop];
  return () => Promise.resolve(v === undefined ? [] : v);
}});
`;

const browser = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(stub);
await page.goto('http://localhost:8931/', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
// 잠금 화면(비밀번호 있음) → 잠금 해제 스크린샷
await page.screenshot({ path: 'shots/lock.png' });
await page.fill('.input', 'test1234');
await page.click('.btn-primary');
await page.waitForTimeout(800);
await page.screenshot({ path: 'shots/dashboard.png' });
// 다크 테마 확인
await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/dashboard-dark.png' });
await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
// 다른 페이지들
for (const [hash, name] of [['#/input','input'],['#/students','students'],['#/statistics','statistics'],['#/settings','settings']]) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `shots/${name}.png` });
}
await browser.close();
server.close();
console.log('shots done');
