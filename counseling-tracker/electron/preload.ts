import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // 학생
  importStudents: () => ipcRenderer.invoke('students:import'),
  getStudents: (activeOnly = true) => ipcRenderer.invoke('students:get', activeOnly),
  getStudentsWithStats: (activeOnly = true) => ipcRenderer.invoke('students:getWithStats', activeOnly),
  togglePin: (studentId: number) => ipcRenderer.invoke('students:togglePin', studentId),
  archiveCurrentYear: (yearLabel: string) => ipcRenderer.invoke('students:archiveYear', yearLabel),
  addStudent: (input: unknown) => ipcRenderer.invoke('students:add', input),
  updateStudent: (id: number, patch: unknown) => ipcRenderer.invoke('students:update', id, patch),
  deleteStudent: (id: number) => ipcRenderer.invoke('students:delete', id),
  getStudentSummary: (id: number) => ipcRenderer.invoke('students:summary', id),
  getStudentById: (id: number) => ipcRenderer.invoke('students:getById', id),

  // 상담 기록
  getRecords: (filter?: unknown) => ipcRenderer.invoke('records:get', filter),
  getRecordById: (id: number) => ipcRenderer.invoke('records:getById', id),
  addRecord: (record: unknown) => ipcRenderer.invoke('records:add', record),
  updateRecord: (id: number, patch: unknown) => ipcRenderer.invoke('records:update', id, patch),
  deleteRecord: (id: number) => ipcRenderer.invoke('records:delete', id),

  // 통계 / 위기감지
  getMonthlyStats: () => ipcRenderer.invoke('stats:monthly'),
  getCrisisAlerts: () => ipcRenderer.invoke('stats:crisisAlerts'),
  getStudentRanking: (limit = 10) => ipcRenderer.invoke('stats:studentRanking', limit),
  getPinnedStudents: () => ipcRenderer.invoke('students:pinned'),
  getUpcomingAppointments: (limit = 5) => ipcRenderer.invoke('stats:upcoming', limit),
  exportAnonymizedReport: () => ipcRenderer.invoke('report:exportAnonymized'),

  // 예약(캘린더)
  getAppointmentsInRange: (startDate: string, endDate: string) => ipcRenderer.invoke('appointments:inRange', startDate, endDate),
  getAppointmentsForDate: (date: string) => ipcRenderer.invoke('appointments:forDate', date),
  checkAppointmentConflict: (input: { appt_date: string; start_time: string; end_time: string; excludeId?: number }) =>
    ipcRenderer.invoke('appointments:checkConflict', input),
  addAppointment: (input: unknown) => ipcRenderer.invoke('appointments:add', input),
  updateAppointment: (id: number, patch: unknown) => ipcRenderer.invoke('appointments:update', id, patch),
  deleteAppointment: (id: number) => ipcRenderer.invoke('appointments:delete', id),

  // 유형 / 템플릿
  getConsultTypes: () => ipcRenderer.invoke('types:get'),
  addConsultType: (input: { name: string; color: string }) => ipcRenderer.invoke('types:add', input),
  updateConsultType: (id: number, patch: { name?: string; color?: string }) => ipcRenderer.invoke('types:update', id, patch),
  deleteConsultType: (id: number) => ipcRenderer.invoke('types:delete', id),
  getQuickTemplates: (typeId: number) => ipcRenderer.invoke('templates:get', typeId),
  addQuickTemplate: (input: { type_id: number; text: string }) => ipcRenderer.invoke('templates:add', input),
  deleteQuickTemplate: (id: number) => ipcRenderer.invoke('templates:delete', id),

  // 설정
  getSetting: (key: string) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),

  // 앱 잠금
  hasPassword: () => ipcRenderer.invoke('auth:hasPassword'),
  verifyPassword: (password: string) => ipcRenderer.invoke('auth:verify', password),
  setPassword: (args: { currentPassword?: string; newPassword: string }) => ipcRenderer.invoke('auth:setPassword', args),
  removePassword: (currentPassword: string) => ipcRenderer.invoke('auth:removePassword', currentPassword)
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
