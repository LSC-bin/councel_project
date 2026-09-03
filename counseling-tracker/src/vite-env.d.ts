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
    importStudents: () => Promise<{ imported: number; canceled?: boolean }>;
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

    getMonthlyStats: () => Promise<MonthlyStats>;
    getCrisisAlerts: () => Promise<CrisisAlert[]>;
    getStudentRanking: (limit?: number) => Promise<{ student_id: number; name: string; count: number }[]>;
    getPinnedStudents: () => Promise<Student[]>;
    getUpcomingAppointments: (limit?: number) => Promise<UpcomingAppointment[]>;
    exportAnonymizedReport: () => Promise<{ canceled: boolean; filePath?: string }>;

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
