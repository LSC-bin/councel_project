/// <reference types="vite/client" />

interface RecordFilter {
  studentId?: number;
  studentQuery?: string;
  grade?: number | null;
  classNo?: number | null;
  startDate?: string;
  endDate?: string;
  typeIds?: number[];
  folderId?: number | null;
  limit?: number;
  sortBy?: 'date' | 'name' | 'number';
  order?: 'asc' | 'desc';
}

interface NewRecord {
  student_id: number;
  type_id: number;
  record_date: string;
  content: string;
  state_score?: number | null;
  follow_up_needed?: boolean;
  follow_up_done?: boolean;
  next_appointment?: string | null;
  referred_to?: string;
  reflected_in_nice?: boolean;
  folder_id?: number | null;
}

interface RecordFolder {
  id: number;
  name: string;
  created_at: string;
  record_count: number;
  parent_id: number | null;
  sort_order: number | null;
}

interface RecordAction {
  id: number;
  record_id: number | null;
  student_id: number | null;
  text: string;
  done: number;
  due_date: string | null;
  created_at: string;
  student_name: string | null;
  record_date: string | null;
}

interface NewAction {
  record_id?: number | null;
  student_id?: number | null;
  text: string;
  done?: boolean;
  due_date?: string | null;
}

interface StudentDigestRecord {
  id: number;
  record_date: string;
  content: string;
  state_score: number | null;
  follow_up_needed: number;
  follow_up_done: number;
  type_name: string | null;
  type_color: string | null;
}

interface RelationEdge {
  a: number;
  aName: string;
  b: number;
  bName: string;
  count: number;
  latestScore: number | null;
  latestFrom: number | null;
  avgScore: number | null;
  minScore: number | null;
  maxScore: number | null;
  bidirectional: boolean;
}

interface RelationGraph {
  nodes: { id: number; name: string; grade: number | null; classNo: number | null; number: number | null }[];
  edges: RelationEdge[];
}

interface StudentDigest {
  recent: StudentDigestRecord[];
  scoreSeries: { record_date: string; state_score: number }[];
  pendingActions: RecordAction[];
  last30Count: number;
}

interface Student {
  id: number;
  name: string;
  school_year: string | null;
  grade: number | null;
  class_no: number | null;
  number: number | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian2_name: string | null;
  guardian2_phone: string | null;
  student_phone: string | null;
  address: string | null;
  health_note: string | null;
  memo: string | null;
  pinned: number;
  active: number;
  archived_year: string | null;
}

interface StudentWithStats extends Student {
  record_count: number;
  last_record_date: string | null;
}

interface StudentSummary {
  totalCount: number;
  followUpPending: number;
  niceUnreflectedCount: number;
  lastRecordDate: string | null;
  nextAppointment: string | null;
}

interface NewStudent {
  name: string;
  school_year?: string | null;
  grade?: number | null;
  class_no?: number | null;
  number?: number | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
  guardian2_name?: string | null;
  guardian2_phone?: string | null;
  student_phone?: string | null;
  address?: string | null;
  health_note?: string | null;
  memo?: string | null;
}

interface ConsultType {
  id: number;
  name: string;
  color: string;
}

interface QuickTemplate {
  id: number;
  type_id: number;
  text: string;
}

interface ConsultRecord {
  id: number;
  student_id: number;
  type_id: number;
  record_date: string;
  content: string;
  state_score: number | null;
  follow_up_needed: number;
  follow_up_done: number;
  next_appointment: string | null;
  referred_to: string;
  reflected_in_nice: number;
  folder_id: number | null;
  created_at: string;
  student_name: string;
  type_name: string;
  type_color: string;
  folder_name?: string | null;
  student_grade?: number | null;
  student_class_no?: number | null;
  student_number?: number | null;
}

interface MonthlyStats {
  monthly: { month: string; count: number }[];
  byType: { type_name: string; type_color: string; count: number }[];
  thisMonthCount: number;
  followUpPending: number;
  studentCount: number;
  niceUnreflectedCount: number;
}

interface CrisisAlert {
  student_id: number;
  name: string;
  count: number;
}

type RelatedType = '학생' | '보호자' | '교사' | '기타';

interface RecordRelation {
  id: number;
  record_id: number;
  related_type: RelatedType;
  related_student_id: number | null;
  related_label: string | null;
  relation_score: number | null;
  note: string | null;
  related_student_name: string | null;
}

interface RecordRelationInput {
  related_type: RelatedType;
  related_student_id?: number | null;
  related_label?: string | null;
  relation_score?: number | null;
  note?: string | null;
}

interface RelationScoreStats {
  count: number;
  avgScore: number | null;
  latestScore: number | null;
  minScore: number | null;
  maxScore: number | null;
}

interface StudentRelationSummary {
  students: ({ studentId: number; name: string } & RelationScoreStats)[];
  others: ({ type: string } & RelationScoreStats)[];
}

interface Appointment {
  id: number;
  student_id: number;
  appt_date: string;
  start_time: string;
  end_time: string;
  note: string | null;
  record_id: number | null;
  created_at: string;
  student_name: string;
}

interface NewAppointment {
  student_id: number;
  appt_date: string;
  start_time: string;
  end_time: string;
  note?: string | null;
  record_id?: number | null;
}

type UpcomingAppointment = Appointment;

interface Window {
  api: {
    importStudents: () => Promise<{ imported: number; skipped: number; canceled?: boolean; error?: string }>;
    downloadStudentTemplate: () => Promise<{ canceled: boolean; filePath?: string }>;
    getStudents: (activeOnly?: boolean) => Promise<Student[]>;
    getStudentsWithStats: (activeOnly?: boolean) => Promise<StudentWithStats[]>;
    togglePin: (studentId: number) => Promise<Student>;
    archiveCurrentYear: (yearLabel: string) => Promise<{ ok: boolean }>;
    addStudent: (input: NewStudent) => Promise<Student>;
    updateStudent: (id: number, patch: Partial<NewStudent>) => Promise<Student>;
    deleteStudent: (id: number) => Promise<{ ok: boolean }>;
    getStudentSummary: (id: number) => Promise<StudentSummary>;
    getStudentById: (id: number) => Promise<Student | undefined>;

    getRecords: (filter?: RecordFilter) => Promise<ConsultRecord[]>;
    getRecordById: (id: number) => Promise<ConsultRecord | undefined>;
    addRecord: (record: NewRecord) => Promise<ConsultRecord>;
    updateRecord: (id: number, patch: Partial<NewRecord>) => Promise<ConsultRecord>;
    deleteRecord: (id: number) => Promise<{ ok: boolean }>;
    getRecordRelations: (recordId: number) => Promise<RecordRelation[]>;
    setRecordRelations: (recordId: number, relations: RecordRelationInput[]) => Promise<RecordRelation[]>;
    getStudentRelationSummary: (studentId: number) => Promise<StudentRelationSummary>;
    getStudentDigest: (studentId: number) => Promise<StudentDigest>;
    getRelationGraph: () => Promise<RelationGraph>;

    getFolders: () => Promise<RecordFolder[]>;
    addFolder: (name: string, parentId?: number | null) => Promise<{ ok: boolean; error?: string; folder?: RecordFolder }>;
    renameFolder: (id: number, name: string) => Promise<{ ok: boolean; error?: string }>;
    moveFolder: (id: number, targetParentId: number | null, beforeFolderId: number | null) => Promise<{ ok: boolean; error?: string }>;
    deleteFolder: (id: number) => Promise<{ ok: boolean }>;

    getActions: (filter?: { recordId?: number; studentId?: number; pendingOnly?: boolean }) => Promise<RecordAction[]>;
    addAction: (input: NewAction) => Promise<{ ok: boolean; error?: string; action?: RecordAction }>;
    updateAction: (id: number, patch: { text?: string; done?: boolean; due_date?: string | null }) => Promise<{ ok: boolean; action?: RecordAction }>;
    deleteAction: (id: number) => Promise<{ ok: boolean }>;

    getMonthlyStats: () => Promise<MonthlyStats>;
    getCrisisAlerts: () => Promise<CrisisAlert[]>;
    getStudentRanking: (limit?: number) => Promise<{ student_id: number; name: string; count: number }[]>;
    getPinnedStudents: () => Promise<Student[]>;
    getUpcomingAppointments: (limit?: number) => Promise<UpcomingAppointment[]>;
    exportAnonymizedReport: () => Promise<{ canceled: boolean; filePath?: string }>;
    createBackupDialog: () => Promise<{ canceled: boolean; needPassword?: boolean; filePath?: string }>;
    createBackupWithPassword: (password: string, filePath: string) => Promise<{ ok: boolean; error?: string }>;
    restoreBackupDialog: () => Promise<{ canceled: boolean; needPassword?: boolean; filePath?: string }>;
    restoreBackupWithPassword: (password: string, filePath: string) => Promise<{ ok: boolean; error?: string }>;
    listAutoSnapshots: () => Promise<{ name: string; size: number; modified: string }[]>;
    restoreAutoSnapshot: (name: string) => Promise<{ ok: boolean; error?: string }>;
    createAutoSnapshot: () => Promise<{ ok: boolean; filePath?: string; error?: string }>;

    getAppointmentsInRange: (startDate: string, endDate: string) => Promise<Appointment[]>;
    getAppointmentsForDate: (date: string) => Promise<Appointment[]>;
    checkAppointmentConflict: (input: {
      appt_date: string;
      start_time: string;
      end_time: string;
      excludeId?: number;
    }) => Promise<Appointment[]>;
    addAppointment: (input: NewAppointment) => Promise<{ ok: boolean; appointment?: Appointment; conflicts?: Appointment[] }>;
    updateAppointment: (
      id: number,
      patch: Partial<NewAppointment>
    ) => Promise<{ ok: boolean; appointment?: Appointment; conflicts?: Appointment[]; error?: string }>;
    deleteAppointment: (id: number) => Promise<{ ok: boolean }>;

    getConsultTypes: () => Promise<ConsultType[]>;
    addConsultType: (input: { name: string; color: string }) => Promise<ConsultType>;
    updateConsultType: (id: number, patch: { name?: string; color?: string }) => Promise<ConsultType>;
    deleteConsultType: (id: number) => Promise<{ ok: boolean; error?: string }>;
    getQuickTemplates: (typeId: number) => Promise<QuickTemplate[]>;
    addQuickTemplate: (input: { type_id: number; text: string }) => Promise<QuickTemplate>;
    deleteQuickTemplate: (id: number) => Promise<{ ok: boolean }>;

    getSetting: (key: string) => Promise<string | null>;
    setSetting: (key: string, value: string) => Promise<{ ok: boolean }>;

    hasPassword: () => Promise<boolean>;
    verifyPassword: (password: string) => Promise<boolean>;
    setPassword: (args: { currentPassword?: string; newPassword: string }) => Promise<{ ok: boolean; error?: string }>;
    removePassword: (currentPassword: string) => Promise<{ ok: boolean; error?: string }>;
  };
}
