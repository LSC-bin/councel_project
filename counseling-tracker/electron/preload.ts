import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // 학생
  importStudents: () => ipcRenderer.invoke('students:import'),
  getStudents: (activeOnly = true) => ipcRenderer.invoke('students:get', activeOnly),
  togglePin: (studentId: number) => ipcRenderer.invoke('students:togglePin', studentId),
  archiveCurrentYear: (yearLabel: string) => ipcRenderer.invoke('students:archiveYear', yearLabel),

  // 상담 기록
  getRecords: (filter?: unknown) => ipcRenderer.invoke('records:get', filter),
  addRecord: (record: unknown) => ipcRenderer.invoke('records:add', record),
  updateRecord: (id: number, patch: unknown) => ipcRenderer.invoke('records:update', id, patch),
  deleteRecord: (id: number) => ipcRenderer.invoke('records:delete', id),

  // 통계 / 위기감지
  getMonthlyStats: () => ipcRenderer.invoke('stats:monthly'),
  getCrisisAlerts: () => ipcRenderer.invoke('stats:crisisAlerts'),
  getStudentRanking: (limit = 10) => ipcRenderer.invoke('stats:studentRanking', limit),
  exportAnonymizedReport: () => ipcRenderer.invoke('report:exportAnonymized'),

  // 유형 / 템플릿
  getConsultTypes: () => ipcRenderer.invoke('types:get'),
  getQuickTemplates: (typeId: number) => ipcRenderer.invoke('templates:get', typeId),

  // 설정
  getSetting: (key: string) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value)
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
