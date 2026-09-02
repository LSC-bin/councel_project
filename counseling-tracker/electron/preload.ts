import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // 학생
  importStudents: () => ipcRenderer.invoke('students:import'),
  getStudents: (activeOnly = true) => ipcRenderer.invoke('students:get', activeOnly),
  getStudentsWithStats: (activeOnly = true) => ipcRenderer.invoke('students:getWithStats', activeOnly),
  togglePin: (studentId: number) => ipcRenderer.invoke('students:togglePin', studentId),
  archiveCurrentYear: (yearLabel: string) => ipcRenderer.invoke('students:archiveYear', yearLabel),
  addStudent: (input: { name: string; student_no?: string | null; class_name?: string | null }) =>
    ipcRenderer.invoke('students:add', input),
  updateStudent: (id: number, patch: unknown) => ipcRenderer.invoke('students:update', id, patch),
  deleteStudent: (id: number) => ipcRenderer.invoke('students:delete', id),
  getStudentSummary: (id: number) => ipcRenderer.invoke('students:summary', id),

  // 상담 기록
  getRecords: (filter?: unknown) => ipcRenderer.invoke('records:get', filter),
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

  // 유형 / 템플릿
  getConsultTypes: () => ipcRenderer.invoke('types:get'),
  getQuickTemplates: (typeId: number) => ipcRenderer.invoke('templates:get', typeId),

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
