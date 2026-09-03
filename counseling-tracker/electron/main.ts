import { app, BrowserWindow, ipcMain, dialog, Notification } from 'electron';
import path from 'node:path';
import * as db from './db/database';
import { buildAnonymizedReport } from './report';
import { hashPassword, verifyPassword } from './auth';

const PASSWORD_SETTING_KEY = 'app_password_hash';

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  return win;
}

function registerIpcHandlers() {
  // 학생
  ipcMain.handle('students:import', async () => {
    const result = await dialog.showOpenDialog({
      title: '학생 명부 업로드',
      filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
      properties: ['openFile']
    });
    if (result.canceled || result.filePaths.length === 0) return { imported: 0, canceled: true };
    return db.importStudentsFromExcel(result.filePaths[0]);
  });
  ipcMain.handle('students:get', (_e, activeOnly = true) => db.getStudents(activeOnly));
  ipcMain.handle('students:getWithStats', (_e, activeOnly = true) => db.getStudentsWithStats(activeOnly));
  ipcMain.handle('students:togglePin', (_e, studentId: number) => db.togglePin(studentId));
  ipcMain.handle('students:archiveYear', (_e, yearLabel: string) => db.archiveCurrentYear(yearLabel));
  ipcMain.handle('students:add', (_e, input) => db.addStudent(input));
  ipcMain.handle('students:update', (_e, id: number, patch) => db.updateStudent(id, patch));
  ipcMain.handle('students:delete', (_e, id: number) => db.deleteStudent(id));
  ipcMain.handle('students:summary', (_e, id: number) => db.getStudentSummary(id));
  ipcMain.handle('students:getById', (_e, id: number) => db.getStudentById(id));

  // 상담 기록
  ipcMain.handle('records:get', (_e, filter) => db.getRecords(filter));
  ipcMain.handle('records:getById', (_e, id: number) => db.getRecordById(id));
  ipcMain.handle('records:add', (_e, record) => db.addRecord(record));
  ipcMain.handle('records:update', (_e, id: number, patch) => db.updateRecord(id, patch));
  ipcMain.handle('records:delete', (_e, id: number) => db.deleteRecord(id));
  ipcMain.handle('records:getRelations', (_e, recordId: number) => db.getRecordRelations(recordId));
  ipcMain.handle('records:setRelations', (_e, recordId: number, relations) => db.setRecordRelations(recordId, relations));
  ipcMain.handle('students:relationSummary', (_e, studentId: number) => db.getStudentRelationSummary(studentId));

  // 통계 / 위기감지
  ipcMain.handle('stats:monthly', () => db.getMonthlyStats());
  ipcMain.handle('stats:crisisAlerts', () => db.getCrisisAlerts());
  ipcMain.handle('stats:studentRanking', (_e, limit = 10) => db.getStudentRanking(limit));
  ipcMain.handle('students:pinned', () => db.getPinnedStudents());
  ipcMain.handle('stats:upcoming', (_e, limit = 5) => db.getUpcomingAppointments(limit));

  // 예약(캘린더)
  ipcMain.handle('appointments:inRange', (_e, startDate: string, endDate: string) => db.getAppointmentsInRange(startDate, endDate));
  ipcMain.handle('appointments:forDate', (_e, date: string) => db.getAppointmentsForDate(date));
  ipcMain.handle('appointments:checkConflict', (_e, input) => db.checkAppointmentConflict(input));
  ipcMain.handle('appointments:add', (_e, input) => db.addAppointment(input));
  ipcMain.handle('appointments:update', (_e, id: number, patch) => db.updateAppointment(id, patch));
  ipcMain.handle('appointments:delete', (_e, id: number) => db.deleteAppointment(id));
  ipcMain.handle('report:exportAnonymized', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = await dialog.showSaveDialog({
      title: '익명화 통계 내보내기',
      defaultPath: `상담통계_익명화_${today}.xlsx`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    await buildAnonymizedReport(result.filePath);
    return { canceled: false, filePath: result.filePath };
  });

  // 유형 / 템플릿
  ipcMain.handle('types:get', () => db.getConsultTypes());
  ipcMain.handle('types:add', (_e, input) => db.addConsultType(input));
  ipcMain.handle('types:update', (_e, id: number, patch) => db.updateConsultType(id, patch));
  ipcMain.handle('types:delete', (_e, id: number) => db.deleteConsultType(id));
  ipcMain.handle('templates:get', (_e, typeId: number) => db.getQuickTemplates(typeId));
  ipcMain.handle('templates:add', (_e, input) => db.addQuickTemplate(input));
  ipcMain.handle('templates:delete', (_e, id: number) => db.deleteQuickTemplate(id));

  // 설정
  ipcMain.handle('settings:get', (_e, key: string) => db.getSetting(key));
  ipcMain.handle('settings:set', (_e, key: string, value: string) => db.setSetting(key, value));

  // 앱 잠금
  ipcMain.handle('auth:hasPassword', () => !!db.getSetting(PASSWORD_SETTING_KEY));
  ipcMain.handle('auth:verify', (_e, password: string) => {
    const stored = db.getSetting(PASSWORD_SETTING_KEY);
    if (!stored) return true;
    return verifyPassword(password, stored);
  });
  ipcMain.handle('auth:setPassword', (_e, { currentPassword, newPassword }: { currentPassword?: string; newPassword: string }) => {
    const stored = db.getSetting(PASSWORD_SETTING_KEY);
    if (stored) {
      if (!currentPassword || !verifyPassword(currentPassword, stored)) {
        return { ok: false, error: '현재 비밀번호가 올바르지 않습니다.' };
      }
    }
    if (!newPassword || newPassword.length < 4) {
      return { ok: false, error: '비밀번호는 4자 이상이어야 합니다.' };
    }
    db.setSetting(PASSWORD_SETTING_KEY, hashPassword(newPassword));
    return { ok: true };
  });
  ipcMain.handle('auth:removePassword', (_e, currentPassword: string) => {
    const stored = db.getSetting(PASSWORD_SETTING_KEY);
    if (!stored) return { ok: true };
    if (!verifyPassword(currentPassword, stored)) {
      return { ok: false, error: '현재 비밀번호가 올바르지 않습니다.' };
    }
    db.setSetting(PASSWORD_SETTING_KEY, '');
    return { ok: true };
  });
}

function checkReminders() {
  if (!Notification.isSupported()) return;
  const alerts = db.getCrisisAlerts();
  for (const a of alerts as { name: string; count: number }[]) {
    new Notification({
      title: '상담기록관리',
      body: `${a.name} 학생 - 최근 14일간 기록 ${a.count}건, 확인이 필요합니다.`
    }).show();
  }

  const today = db.getTodayAppointments() as { student_name: string; start_time: string; end_time: string }[];
  if (today.length > 0) {
    const summary = today.map((a) => `${a.start_time} ${a.student_name}`).join(', ');
    new Notification({
      title: '오늘의 예약',
      body: `오늘 예약 ${today.length}건: ${summary}`
    }).show();
  }
}

app.whenReady().then(async () => {
  await db.initDatabase();
  registerIpcHandlers();
  createWindow();
  checkReminders();
  setInterval(checkReminders, 1000 * 60 * 60);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
