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
    if (result.canceled || result.filePaths.length === 0) return { imported: 0, skipped: 0, canceled: true };
    return db.importStudentsFromExcel(result.filePaths[0]);
  });
  ipcMain.handle('students:downloadTemplate', async () => {
    const result = await dialog.showSaveDialog({
      title: '학생 명부 양식 저장',
      defaultPath: '학생명부_양식.xlsx',
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    db.buildStudentTemplateFile(result.filePath);
    return { canceled: false, filePath: result.filePath };
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
  ipcMain.handle('students:digest', (_e, studentId: number) => db.getStudentDigest(studentId));
  ipcMain.handle('relations:graph', () => db.getRelationGraph());

  // 폴더
  ipcMain.handle('folders:get', () => db.getFolders());
  ipcMain.handle('folders:add', (_e, name: string, parentId?: number | null) => db.addFolder(name, parentId ?? null));
  ipcMain.handle('folders:rename', (_e, id: number, name: string) => db.renameFolder(id, name));
  ipcMain.handle('folders:move', (_e, id: number, targetParentId: number | null, beforeFolderId: number | null) =>
    db.moveFolder(id, targetParentId, beforeFolderId)
  );
  ipcMain.handle('folders:delete', (_e, id: number) => db.deleteFolder(id));

  // 조치사항
  ipcMain.handle('actions:get', (_e, filter) => db.getActions(filter));
  ipcMain.handle('actions:add', (_e, input) => db.addAction(input));
  ipcMain.handle('actions:update', (_e, id: number, patch) => db.updateAction(id, patch));
  ipcMain.handle('actions:delete', (_e, id: number) => db.deleteAction(id));

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

  // 백업 / 복원
  ipcMain.handle('backup:create', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '암호화 백업 만들기',
      defaultPath: `상담기록_백업_${new Date().toISOString().slice(0, 10)}.backup`,
      filters: [{ name: '상담기록 백업', extensions: ['backup'] }]
    });
    if (canceled || !filePath) return { canceled: true };
    return { canceled: false, needPassword: true, filePath };
  });
  ipcMain.handle('backup:createWithPassword', (_e, password: string, filePath: string) =>
    db.createBackup(password, filePath)
  );
  ipcMain.handle('backup:restore', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: '백업 파일 선택',
      filters: [{ name: '상담기록 백업', extensions: ['backup'] }],
      properties: ['openFile']
    });
    if (canceled || filePaths.length === 0) return { canceled: true };
    return { canceled: false, needPassword: true, filePath: filePaths[0] };
  });
  ipcMain.handle('backup:restoreWithPassword', (_e, password: string, filePath: string) =>
    db.restoreBackup(password, filePath)
  );
  ipcMain.handle('backup:listSnapshots', () => db.listAutoSnapshots());
  ipcMain.handle('backup:restoreSnapshot', (_e, name: string) => db.restoreAutoSnapshot(name));
  ipcMain.handle('backup:createSnapshot', () => db.createAutoSnapshot());

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

  // 앱 잠금 / 기록 암호화
  // bootState: 렌더러가 시작 시 "DB 잠금(비밀번호 암호화)인지, 단순 앱 잠금인지"를 판별한다.
  ipcMain.handle('auth:bootState', () => ({
    encryptionEnabled: db.isPasswordEncryptionEnabled(),
    dbOpen: db.isDatabaseOpen(),
    hasPassword: db.isDatabaseOpen() && !!db.getSetting(PASSWORD_SETTING_KEY)
  }));
  // unlock: DB가 닫혀 있으면(암호화 모드) 비밀번호로 DB 자체를 열고,
  // 이미 열려 있으면 기존 앱 잠금 비밀번호 검증만 수행한다.
  ipcMain.handle('auth:unlock', (_e, password: string) => {
    if (!db.isDatabaseOpen()) {
      const result = db.unlockDatabase(password);
      if (result.ok) afterDatabaseUnlocked();
      return result;
    }
    const stored = db.getSetting(PASSWORD_SETTING_KEY);
    if (!stored) return { ok: true };
    return verifyPassword(password, stored) ? { ok: true } : { ok: false, error: '비밀번호가 올바르지 않습니다.' };
  });
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
    // 기록 암호화가 켜져 있으면 같은 비밀번호로 마스터 키를 다시 래핑한다(진입 비밀번호 = 잠금 비밀번호 유지).
    if (db.isPasswordEncryptionEnabled()) {
      const rewrap = db.changeEncryptionPassword(newPassword);
      if (!rewrap.ok) return rewrap;
    }
    return { ok: true };
  });
  ipcMain.handle('auth:removePassword', (_e, currentPassword: string) => {
    const stored = db.getSetting(PASSWORD_SETTING_KEY);
    if (!stored) return { ok: true };
    if (!verifyPassword(currentPassword, stored)) {
      return { ok: false, error: '현재 비밀번호가 올바르지 않습니다.' };
    }
    // 기록 암호화가 켜져 있으면 그 비밀번호가 곧 진입 비밀번호라 잠금만 따로 해제할 수 없다.
    if (db.isPasswordEncryptionEnabled()) {
      return { ok: false, error: '상담 기록 암호화가 켜져 있습니다. 먼저 "상담 기록 암호화" 섹션에서 암호화를 해제하세요.' };
    }
    db.setSetting(PASSWORD_SETTING_KEY, '');
    return { ok: true };
  });

  // 기록 암호화 켜기: 설정한 비밀번호가 곧 앱 진입 비밀번호가 된다(앱 잠금도 함께 설정).
  ipcMain.handle('auth:enableEncryption', (_e, password: string) => {
    if (!password || password.length < 4) {
      return { ok: false, error: '비밀번호는 4자 이상이어야 합니다.' };
    }
    const result = db.enablePasswordEncryption(password);
    if (!result.ok) return result;
    db.setSetting(PASSWORD_SETTING_KEY, hashPassword(password));
    return { ok: true };
  });
  // 기록 암호화 끄기: 현재 비밀번호 확인 후 파일 키 방식으로 되돌린다.
  ipcMain.handle('auth:disableEncryption', (_e, currentPassword: string) => {
    const stored = db.getSetting(PASSWORD_SETTING_KEY);
    if (stored && !verifyPassword(currentPassword, stored)) {
      return { ok: false, error: '현재 비밀번호가 올바르지 않습니다.' };
    }
    const result = db.disablePasswordEncryption();
    if (!result.ok) return result;
    db.setSetting(PASSWORD_SETTING_KEY, '');
    return { ok: true };
  });
  ipcMain.handle('auth:encryptionEnabled', () => db.isPasswordEncryptionEnabled());
}

function checkReminders() {
  if (!Notification.isSupported()) return;
  if (!db.isDatabaseOpen()) return; // 기록 암호화 잠금 중이면 건너뜀
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

// DB가 비밀번호로 잠금 해제된 직후 1회 실행: 시작 시 스냅샷 + 위기 알림.
function afterDatabaseUnlocked() {
  db.createAutoSnapshot();
  checkReminders();
}

app.whenReady().then(async () => {
  const opened = await db.initDatabase();
  registerIpcHandlers();
  createWindow();
  if (opened) {
    checkReminders();
    // 자동 백업: 시작 시 1회 + 이후 30분마다 로컬 스냅샷(최근 7개 보관)
    db.createAutoSnapshot();
  }
  setInterval(() => {
    if (!db.isDatabaseOpen()) return; // 잠금 상태에서는 건너뜀
    checkReminders();
    db.createAutoSnapshot();
  }, 1000 * 60 * 30);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
