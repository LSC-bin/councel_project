/// <reference types="vite/client" />

interface RecordFilter {
  studentId?: number;
  studentQuery?: string;
  startDate?: string;
  endDate?: string;
  typeIds?: number[];
  limit?: number;
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
}

interface Student {
  id: number;
  name: string;
  school_year: string | null;
  grade: number | null;
  class_no: number | null;
  number: number | null;
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
  created_at: string;
  student_name: string;
  type_name: string;
  type_color: string;
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

interface UpcomingAppointment {
  id: number;
  next_appointment: string;
  student_id: number;
  student_name: string;
  type_name: string | null;
  type_color: string | null;
}

interface Window {
  api: {
    importStudents: () => Promise<{ imported: number; canceled?: boolean }>;
    getStudents: (activeOnly?: boolean) => Promise<Student[]>;
    getStudentsWithStats: (activeOnly?: boolean) => Promise<StudentWithStats[]>;
    togglePin: (studentId: number) => Promise<Student>;
    archiveCurrentYear: (yearLabel: string) => Promise<{ ok: boolean }>;
    addStudent: (input: NewStudent) => Promise<Student>;
    updateStudent: (id: number, patch: Partial<NewStudent>) => Promise<Student>;
    deleteStudent: (id: number) => Promise<{ ok: boolean }>;
    getStudentSummary: (id: number) => Promise<StudentSummary>;

    getRecords: (filter?: RecordFilter) => Promise<ConsultRecord[]>;
    addRecord: (record: NewRecord) => Promise<ConsultRecord>;
    updateRecord: (id: number, patch: Partial<NewRecord>) => Promise<ConsultRecord>;
    deleteRecord: (id: number) => Promise<{ ok: boolean }>;

    getMonthlyStats: () => Promise<MonthlyStats>;
    getCrisisAlerts: () => Promise<CrisisAlert[]>;
    getStudentRanking: (limit?: number) => Promise<{ student_id: number; name: string; count: number }[]>;
    getPinnedStudents: () => Promise<Student[]>;
    getUpcomingAppointments: (limit?: number) => Promise<UpcomingAppointment[]>;
    exportAnonymizedReport: () => Promise<{ canceled: boolean; filePath?: string }>;

    getConsultTypes: () => Promise<ConsultType[]>;
    getQuickTemplates: (typeId: number) => Promise<QuickTemplate[]>;

    getSetting: (key: string) => Promise<string | null>;
    setSetting: (key: string, value: string) => Promise<{ ok: boolean }>;

    hasPassword: () => Promise<boolean>;
    verifyPassword: (password: string) => Promise<boolean>;
    setPassword: (args: { currentPassword?: string; newPassword: string }) => Promise<{ ok: boolean; error?: string }>;
    removePassword: (currentPassword: string) => Promise<{ ok: boolean; error?: string }>;
  };
}
