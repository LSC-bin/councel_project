import initSqlJs, { type Database as SqlJsDatabase, type SqlValue } from 'sql.js';
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';

export interface RecordFilter {
  studentId?: number;
  studentQuery?: string;
  startDate?: string;
  endDate?: string;
  typeIds?: number[];
  limit?: number;
  order?: 'asc' | 'desc';
}

export interface NewRecord {
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

const DEFAULT_TYPES: { name: string; color: string }[] = [
  { name: '교우관계', color: '#4f8ef7' },
  { name: '학습', color: '#3aa76d' },
  { name: '진로', color: '#a26fe0' },
  { name: '가정환경', color: '#e0a13a' },
  { name: '정서·심리', color: '#e06a6a' },
  { name: '학교폭력', color: '#d94848' },
  { name: '기타', color: '#8a8f98' }
];

const DEFAULT_TEMPLATES: Record<string, string[]> = {
  교우관계: ['교우관계 갈등 - 중재 완료', '또래 관계 개선을 위한 지속 관찰 필요'],
  학습: ['학습 부진 상담 - 방과후 보충 안내', '학습 동기 저하 - 목표 설정 상담 진행'],
  '정서·심리': ['정서적 어려움 호소 - Wee클래스 연계 안내']
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    school_year TEXT,
    grade INTEGER,
    class_no INTEGER,
    number INTEGER,
    pinned BOOLEAN DEFAULT 0,
    active BOOLEAN DEFAULT 1,
    archived_year TEXT
);

CREATE TABLE IF NOT EXISTS consult_types (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT
);

CREATE TABLE IF NOT EXISTS quick_templates (
    id INTEGER PRIMARY KEY,
    type_id INTEGER REFERENCES consult_types(id),
    text TEXT
);

CREATE TABLE IF NOT EXISTS consult_records (
    id INTEGER PRIMARY KEY,
    student_id INTEGER REFERENCES students(id),
    type_id INTEGER REFERENCES consult_types(id),
    record_date DATE NOT NULL,
    content TEXT,
    state_score INTEGER,
    follow_up_needed BOOLEAN DEFAULT 0,
    follow_up_done BOOLEAN DEFAULT 0,
    next_appointment DATE,
    referred_to TEXT,
    reflected_in_nice BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);
`;

let db: SqlJsDatabase;
let dbFilePath: string;

// ---------- 초기화 / 영속화 ----------
// sql.js는 DB 전체를 메모리에서 다루므로, 쓰기 작업 직후마다 파일로 저장(persist)한다.
// 상담 기록 관리 프로그램 특성상 데이터량이 크지 않아 매번 저장해도 성능에 무리가 없다.
export async function initDatabase(): Promise<SqlJsDatabase> {
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(require.resolve('sql.js/dist/sql-wasm.wasm'))
  });

  const userDataPath = app.getPath('userData');
  if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true });
  dbFilePath = path.join(userDataPath, 'counseling.sqlite');

  if (fs.existsSync(dbFilePath)) {
    const buffer = fs.readFileSync(dbFilePath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.exec(SCHEMA);
  migrateSchema();
  seedDefaults();
  persist();
  return db;
}

// 이전 버전에서 만들어진 DB에 새 컬럼을 안전하게 추가한다(이미 있으면 건너뜀).
function migrateSchema() {
  const columns = all<{ name: string }>('PRAGMA table_info(students)').map((c) => c.name);
  const addColumn = (name: string, type: string) => {
    if (!columns.includes(name)) db.run(`ALTER TABLE students ADD COLUMN ${name} ${type}`);
  };
  addColumn('school_year', 'TEXT');
  addColumn('grade', 'INTEGER');
  addColumn('class_no', 'INTEGER');
  addColumn('number', 'INTEGER');
}

function persist() {
  const data = db.export();
  fs.writeFileSync(dbFilePath, Buffer.from(data));
}

// ---------- 쿼리 헬퍼 ----------
function all<T = Record<string, SqlValue>>(sql: string, params: SqlValue[] = []): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as T);
  stmt.free();
  return rows;
}

function get<T = Record<string, SqlValue>>(sql: string, params: SqlValue[] = []): T | undefined {
  const rows = all<T>(sql, params);
  return rows[0];
}

function run(sql: string, params: SqlValue[] = []) {
  db.run(sql, params);
  persist();
}

function lastInsertId(): number {
  const row = get<{ id: number }>('SELECT last_insert_rowid() as id');
  return row ? Number(row.id) : 0;
}

function seedDefaults() {
  const typeCount = Number(get<{ c: number }>('SELECT COUNT(*) as c FROM consult_types')?.c ?? 0);
  if (typeCount === 0) {
    for (const t of DEFAULT_TYPES) {
      db.run('INSERT INTO consult_types (name, color) VALUES (?, ?)', [t.name, t.color]);
      const typeId = lastInsertId();
      const templates = DEFAULT_TEMPLATES[t.name];
      if (templates) {
        for (const text of templates) {
          db.run('INSERT INTO quick_templates (type_id, text) VALUES (?, ?)', [typeId, text]);
        }
      }
    }
  }
}

// ---------- 학생 ----------
export function importStudentsFromExcel(filePath: string) {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<{
    학년도?: string | number;
    학년?: string | number;
    반?: string | number;
    번호?: string | number;
    이름?: string;
  }>(sheet);

  const toInt = (v: string | number | undefined) => (v != null && v !== '' ? Number(v) : null);

  let count = 0;
  for (const row of rows) {
    const name = row['이름'];
    if (!name) continue;
    const schoolYear = row['학년도'] != null && row['학년도'] !== '' ? String(row['학년도']) : null;
    db.run('INSERT INTO students (name, school_year, grade, class_no, number, active) VALUES (?, ?, ?, ?, ?, 1)', [
      name,
      schoolYear,
      toInt(row['학년']),
      toInt(row['반']),
      toInt(row['번호'])
    ]);
    count++;
  }
  persist();
  return { imported: count };
}

export function getStudents(activeOnly = true) {
  const order = 'ORDER BY school_year DESC, grade, class_no, number, name';
  return activeOnly ? all(`SELECT * FROM students WHERE active = 1 ${order}`) : all(`SELECT * FROM students ${order}`);
}

export function togglePin(studentId: number) {
  run('UPDATE students SET pinned = NOT pinned WHERE id = ?', [studentId]);
  return get('SELECT * FROM students WHERE id = ?', [studentId]);
}

export function archiveCurrentYear(yearLabel: string) {
  run('UPDATE students SET archived_year = ?, active = 0 WHERE active = 1', [yearLabel]);
  return { ok: true };
}

export interface NewStudent {
  name: string;
  school_year?: string | null;
  grade?: number | null;
  class_no?: number | null;
  number?: number | null;
}

export function addStudent(input: NewStudent) {
  db.run('INSERT INTO students (name, school_year, grade, class_no, number, active) VALUES (?, ?, ?, ?, ?, 1)', [
    input.name,
    input.school_year ?? null,
    input.grade ?? null,
    input.class_no ?? null,
    input.number ?? null
  ]);
  const id = lastInsertId();
  persist();
  return get('SELECT * FROM students WHERE id = ?', [id]);
}

export function updateStudent(id: number, patch: Partial<NewStudent>) {
  const fields = Object.keys(patch) as (keyof NewStudent)[];
  if (fields.length > 0) {
    const setClause = fields.map((f) => `${f} = ?`).join(', ');
    const values = fields.map((f) => patch[f] ?? null) as SqlValue[];
    run(`UPDATE students SET ${setClause} WHERE id = ?`, [...values, id]);
  }
  return get('SELECT * FROM students WHERE id = ?', [id]);
}

// 학생을 삭제하면 해당 학생의 상담 기록도 함께 삭제된다(되돌릴 수 없음, 렌더러에서 확인 후 호출).
export function deleteStudent(id: number) {
  db.run('DELETE FROM consult_records WHERE student_id = ?', [id]);
  db.run('DELETE FROM students WHERE id = ?', [id]);
  persist();
  return { ok: true };
}

export function getStudentsWithStats(activeOnly = true) {
  const where = activeOnly ? 'WHERE s.active = 1' : '';
  return all(
    `SELECT s.*, COUNT(r.id) as record_count, MAX(r.record_date) as last_record_date
     FROM students s
     LEFT JOIN consult_records r ON r.student_id = s.id
     ${where}
     GROUP BY s.id
     ORDER BY s.school_year DESC, s.grade, s.class_no, s.number, s.name`
  );
}

export function getStudentSummary(id: number) {
  const totalCount = Number(
    get<{ c: number }>('SELECT COUNT(*) as c FROM consult_records WHERE student_id = ?', [id])?.c ?? 0
  );
  const followUpPending = Number(
    get<{ c: number }>(
      'SELECT COUNT(*) as c FROM consult_records WHERE student_id = ? AND follow_up_needed = 1 AND follow_up_done = 0',
      [id]
    )?.c ?? 0
  );
  const niceUnreflectedCount = Number(
    get<{ c: number }>(
      'SELECT COUNT(*) as c FROM consult_records WHERE student_id = ? AND reflected_in_nice = 0',
      [id]
    )?.c ?? 0
  );
  const lastRecord = get<{ record_date: string }>(
    'SELECT record_date FROM consult_records WHERE student_id = ? ORDER BY record_date DESC LIMIT 1',
    [id]
  );
  const nextAppointment = get<{ next_appointment: string }>(
    `SELECT next_appointment FROM consult_records
     WHERE student_id = ? AND next_appointment IS NOT NULL AND next_appointment >= date('now')
     ORDER BY next_appointment ASC LIMIT 1`,
    [id]
  );
  return {
    totalCount,
    followUpPending,
    niceUnreflectedCount,
    lastRecordDate: lastRecord?.record_date ?? null,
    nextAppointment: nextAppointment?.next_appointment ?? null
  };
}

// ---------- 상담 기록 ----------
export function getRecords(filter: RecordFilter = {}) {
  const clauses: string[] = [];
  const params: SqlValue[] = [];

  if (filter.studentId) {
    clauses.push('r.student_id = ?');
    params.push(filter.studentId);
  }
  if (filter.studentQuery) {
    clauses.push('s.name LIKE ?');
    params.push(`%${filter.studentQuery}%`);
  }
  if (filter.startDate) {
    clauses.push('r.record_date >= ?');
    params.push(filter.startDate);
  }
  if (filter.endDate) {
    clauses.push('r.record_date <= ?');
    params.push(filter.endDate);
  }
  if (filter.typeIds && filter.typeIds.length > 0) {
    clauses.push(`r.type_id IN (${filter.typeIds.map(() => '?').join(',')})`);
    params.push(...filter.typeIds);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const order = filter.order === 'asc' ? 'ASC' : 'DESC';
  const limit = filter.limit ? `LIMIT ${Number(filter.limit)}` : '';

  return all(
    `SELECT r.*, s.name as student_name, t.name as type_name, t.color as type_color
     FROM consult_records r
     JOIN students s ON s.id = r.student_id
     LEFT JOIN consult_types t ON t.id = r.type_id
     ${where}
     ORDER BY r.record_date ${order}, r.id ${order}
     ${limit}`,
    params
  );
}

export function addRecord(record: NewRecord) {
  db.run(
    `INSERT INTO consult_records
      (student_id, type_id, record_date, content, state_score, follow_up_needed, next_appointment, referred_to, reflected_in_nice)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.student_id,
      record.type_id,
      record.record_date,
      record.content ?? '',
      record.state_score ?? null,
      record.follow_up_needed ? 1 : 0,
      record.next_appointment ?? null,
      record.referred_to ?? '',
      record.reflected_in_nice ? 1 : 0
    ]
  );
  const id = lastInsertId();
  persist();
  return get('SELECT * FROM consult_records WHERE id = ?', [id]);
}

export function updateRecord(id: number, patch: Partial<NewRecord>) {
  const fields = Object.keys(patch) as (keyof NewRecord)[];
  if (fields.length > 0) {
    const setClause = fields.map((f) => `${f} = ?`).join(', ');
    const values = fields.map((f) => {
      const v = patch[f];
      if (typeof v === 'boolean') return v ? 1 : 0;
      return v ?? null;
    }) as SqlValue[];
    run(`UPDATE consult_records SET ${setClause} WHERE id = ?`, [...values, id]);
  }
  return get('SELECT * FROM consult_records WHERE id = ?', [id]);
}

export function deleteRecord(id: number) {
  run('DELETE FROM consult_records WHERE id = ?', [id]);
  return { ok: true };
}

// ---------- 통계 / 위기감지 ----------
export function getMonthlyStats() {
  const monthly = all(
    `SELECT strftime('%Y-%m', record_date) as month, COUNT(*) as count
     FROM consult_records
     GROUP BY month
     ORDER BY month DESC
     LIMIT 12`
  );

  const byType = all(
    `SELECT t.name as type_name, t.color as type_color, COUNT(*) as count
     FROM consult_records r
     JOIN consult_types t ON t.id = r.type_id
     GROUP BY r.type_id
     ORDER BY count DESC`
  );

  const thisMonthCount = Number(
    get<{ c: number }>(`SELECT COUNT(*) as c FROM consult_records WHERE record_date >= date('now', 'start of month')`)
      ?.c ?? 0
  );

  const followUpPending = Number(
    get<{ c: number }>(
      `SELECT COUNT(*) as c FROM consult_records WHERE follow_up_needed = 1 AND follow_up_done = 0`
    )?.c ?? 0
  );

  const studentCount = Number(get<{ c: number }>('SELECT COUNT(*) as c FROM students WHERE active = 1')?.c ?? 0);

  const niceUnreflectedCount = Number(
    get<{ c: number }>('SELECT COUNT(*) as c FROM consult_records WHERE reflected_in_nice = 0')?.c ?? 0
  );

  return { monthly, byType, thisMonthCount, followUpPending, studentCount, niceUnreflectedCount };
}

export function getPinnedStudents() {
  return all('SELECT * FROM students WHERE pinned = 1 AND active = 1 ORDER BY name');
}

export function getUpcomingAppointments(limit = 5) {
  return all(
    `SELECT r.id, r.next_appointment, r.student_id, s.name as student_name, t.name as type_name, t.color as type_color
     FROM consult_records r
     JOIN students s ON s.id = r.student_id
     LEFT JOIN consult_types t ON t.id = r.type_id
     WHERE r.next_appointment IS NOT NULL AND r.next_appointment >= date('now')
     ORDER BY r.next_appointment ASC
     LIMIT ?`,
    [limit]
  );
}

export function getStudentRanking(limit = 10) {
  return all(
    `SELECT s.id as student_id, s.name, COUNT(*) as count
     FROM consult_records r
     JOIN students s ON s.id = r.student_id
     GROUP BY r.student_id
     ORDER BY count DESC
     LIMIT ?`,
    [limit]
  );
}

export function getCrisisAlerts() {
  const thresholdDays = Number(getSetting('crisis_threshold_days') ?? 14);
  const thresholdCount = Number(getSetting('crisis_threshold_count') ?? 3);
  return all(
    `SELECT r.student_id, s.name, COUNT(*) as count
     FROM consult_records r
     JOIN students s ON s.id = r.student_id
     WHERE r.record_date >= date('now', '-' || ? || ' days')
     GROUP BY r.student_id
     HAVING count >= ?`,
    [thresholdDays, thresholdCount]
  );
}

// ---------- 유형 / 템플릿 ----------
export function getConsultTypes() {
  return all('SELECT * FROM consult_types ORDER BY id');
}

export function getQuickTemplates(typeId: number) {
  return all('SELECT * FROM quick_templates WHERE type_id = ? ORDER BY id', [typeId]);
}

// ---------- 설정 ----------
export function getSetting(key: string): string | null {
  const row = get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : null;
}

export function setSetting(key: string, value: string) {
  run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [
    key,
    value
  ]);
  return { ok: true };
}
