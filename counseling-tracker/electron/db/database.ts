import initSqlJs, { type Database as SqlJsDatabase, type SqlValue } from 'sql.js';
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import * as XLSX from 'xlsx';
import { atomicWriteFileSync, decryptBuffer, encryptBuffer, isEncryptedFile, loadOrCreateKey, unwrapKey, wrapKey } from './crypto';

export interface RecordFilter {
  studentId?: number;
  studentQuery?: string;
  grade?: number | null;
  classNo?: number | null;
  startDate?: string;
  endDate?: string;
  typeIds?: number[];
  folderId?: number | null; // null=미분류 폴더만, 숫자=해당 폴더(+하위 폴더), undefined=전체
  limit?: number;
  sortBy?: 'date' | 'name' | 'number';
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
  folder_id?: number | null;
}

const DEFAULT_TYPES: { name: string; color: string }[] = [
  { name: '교우관계', color: '#4f8ef7' },
  { name: '학습', color: '#3aa76d' },
  { name: '진로', color: '#a26fe0' },
  { name: '가정환경', color: '#e0a13a' },
  { name: '정서·심리', color: '#e06a6a' },
  { name: '학교폭력', color: '#d94848' },
  { name: '출결', color: '#2383e2' },
  { name: '칭찬·상벌점', color: '#f2a90c' },
  { name: '학부모 연락', color: '#5fb37a' },
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
    guardian_name TEXT,
    guardian_phone TEXT,
    guardian2_name TEXT,
    guardian2_phone TEXT,
    student_phone TEXT,
    address TEXT,
    health_note TEXT,
    memo TEXT,
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

CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY,
    student_id INTEGER REFERENCES students(id),
    appt_date DATE NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    note TEXT,
    record_id INTEGER REFERENCES consult_records(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS record_relations (
    id INTEGER PRIMARY KEY,
    record_id INTEGER REFERENCES consult_records(id),
    related_type TEXT NOT NULL,
    related_student_id INTEGER REFERENCES students(id),
    related_label TEXT,
    relation_score INTEGER,
    note TEXT
);

CREATE TABLE IF NOT EXISTS record_folders (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS record_actions (
    id INTEGER PRIMARY KEY,
    record_id INTEGER REFERENCES consult_records(id),
    student_id INTEGER REFERENCES students(id),
    text TEXT NOT NULL,
    done BOOLEAN DEFAULT 0,
    due_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

let db: SqlJsDatabase;
let dbFilePath: string;
let dbKey: Buffer | null = null;
let dbOpen = false;
let sqlJs: Awaited<ReturnType<typeof initSqlJs>> | null = null;

const WRAPPED_KEY_FILE = 'db.key.wrapped';

function wrappedKeyPath(): string {
  return path.join(app.getPath('userData'), WRAPPED_KEY_FILE);
}

// ---------- 초기화 / 영속화 ----------
// sql.js는 DB 전체를 메모리에서 다루므로, 쓰기 작업 직후마다 파일로 저장(persist)한다.
// 상담 기록 관리 프로그램 특성상 데이터량이 크지 않아 매번 저장해도 성능에 무리가 없다.
// 저장은 AES-256-GCM 암호화 + 원자적 쓰기(임시파일→rename)로 수행한다.
//
// 암호화 키는 두 가지 방식으로 관리된다:
// 1) 기본: 랜덤 마스터 키(db.key, 파일) — 앱 실행 시 자동으로 DB를 연다.
// 2) 비밀번호 암호화 모드: db.key.wrapped이 있으면 마스터 키가 진입 비밀번호로
//    래핑(암호화)되어 있어, 비밀번호를 입력(unlockDatabase)해야 DB가 열린다.
// initDatabase()는 모드 2에서 DB를 열지 않고 false를 반환한다.
export async function initDatabase(): Promise<boolean> {
  sqlJs = await initSqlJs({
    locateFile: (file) => path.join(require.resolve('sql.js/dist/sql-wasm.wasm'))
  });

  const userDataPath = app.getPath('userData');
  if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true });
  dbFilePath = path.join(userDataPath, 'counseling.db.enc');

  if (fs.existsSync(wrappedKeyPath())) {
    // 비밀번호 암호화 모드: 잠금 해제 전까지 DB를 열지 않는다.
    return false;
  }

  dbKey = loadOrCreateKey(path.join(userDataPath, 'db.key'));
  loadDatabaseFromFile();
  return true;
}

export function isPasswordEncryptionEnabled(): boolean {
  return fs.existsSync(wrappedKeyPath());
}

export function isDatabaseOpen(): boolean {
  return dbOpen;
}

// 현재 키(dbKey)로 암호화된 DB 파일을 읽어 연다. 스키마 적용·기본값 시드까지 수행.
function loadDatabaseFromFile() {
  if (!sqlJs) throw new Error('sql.js가 초기화되지 않았습니다.');
  const legacyPlainPath = path.join(app.getPath('userData'), 'counseling.sqlite');

  if (fs.existsSync(dbFilePath)) {
    const blob = fs.readFileSync(dbFilePath);
    const plain = isEncryptedFile(blob) ? decryptBuffer(blob, dbKey!) : blob; // 손상 대비: 평문이면 그대로 읽음
    db = new sqlJs.Database(plain);
  } else if (fs.existsSync(legacyPlainPath)) {
    // 구버전 평문 DB 자동 이관: 읽어서 암호화 저장 후 원본은 .bak으로 보관
    const buffer = fs.readFileSync(legacyPlainPath);
    db = new sqlJs.Database(buffer);
    dbKey = dbKey ?? loadOrCreateKey(path.join(app.getPath('userData'), 'db.key'));
    persist();
    fs.renameSync(legacyPlainPath, `${legacyPlainPath}.bak`);
  } else {
    db = new sqlJs.Database();
  }

  db.exec(SCHEMA);
  migrateSchema();
  seedDefaults();
  persist();
  dbOpen = true;
}

// 비밀번호 암호화 모드: 진입 비밀번호로 래핑된 마스터 키를 복원하고 DB를 연다.
// 비밀번호가 틀리면 GCM 인증에서 실패 → DB는 열리지 않는다.
export function unlockDatabase(password: string): { ok: boolean; error?: string } {
  try {
    const blob = fs.readFileSync(wrappedKeyPath());
    dbKey = unwrapKey(blob, password);
    loadDatabaseFromFile();
    return { ok: true };
  } catch (e) {
    const msg = String(e);
    if (msg.includes('unable to authenticate')) {
      return { ok: false, error: '비밀번호가 올바르지 않습니다.' };
    }
    return { ok: false, error: msg };
  }
}

// 비밀번호 암호화 켜기: 새 랜덤 마스터 키로 DB를 재암호화하고,
// 마스터 키를 비밀번호로 래핑해 db.key.wrapped에 저장한다. 평문 db.key는 삭제한다.
export function enablePasswordEncryption(password: string): { ok: boolean; error?: string } {
  try {
    if (!dbOpen) return { ok: false, error: 'DB가 열려 있지 않습니다.' };
    const master = randomBytes(32);
    dbKey = master;
    persist(); // DB 전체를 새 마스터 키로 재암호화
    atomicWriteFileSync(wrappedKeyPath(), wrapKey(master, password));
    const keyFile = path.join(app.getPath('userData'), 'db.key');
    if (fs.existsSync(keyFile)) fs.rmSync(keyFile); // 평문 키 파일 제거
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// 비밀번호 변경: 마스터 키는 그대로 두고 새 비밀번호로 다시 래핑만 한다(DB 재암호화 불필요).
export function changeEncryptionPassword(newPassword: string): { ok: boolean; error?: string } {
  try {
    if (!dbOpen || !dbKey) return { ok: false, error: 'DB가 열려 있지 않습니다.' };
    atomicWriteFileSync(wrappedKeyPath(), wrapKey(dbKey, newPassword));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// 비밀번호 암호화 끄기: 새 랜덤 키를 db.key 파일로 되돌리고 래핑 파일을 삭제한다.
export function disablePasswordEncryption(): { ok: boolean; error?: string } {
  try {
    if (!dbOpen) return { ok: false, error: 'DB가 열려 있지 않습니다.' };
    const newKey = randomBytes(32);
    const keyFile = path.join(app.getPath('userData'), 'db.key');
    fs.writeFileSync(keyFile, newKey, { mode: 0o600 });
    dbKey = newKey;
    persist(); // DB를 파일 키로 재암호화
    fs.rmSync(wrappedKeyPath(), { force: true });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// 이전 버전에서 만들어진 DB에 새 컬럼을 안전하게 추가한다(이미 있으면 건너뜀).
function migrateSchema() {
  const addColumnTo = (table: string, name: string, type: string) => {
    const columns = all<{ name: string }>(`PRAGMA table_info(${table})`).map((c) => c.name);
    if (!columns.includes(name)) db.run(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
  };
  const addColumn = (name: string, type: string) => addColumnTo('students', name, type);
  addColumn('school_year', 'TEXT');
  addColumn('grade', 'INTEGER');
  addColumn('class_no', 'INTEGER');
  addColumn('number', 'INTEGER');
  addColumn('guardian_name', 'TEXT');
  addColumn('guardian_phone', 'TEXT');
  addColumn('guardian2_name', 'TEXT');
  addColumn('guardian2_phone', 'TEXT');
  addColumn('student_phone', 'TEXT');
  addColumn('address', 'TEXT');
  addColumn('health_note', 'TEXT');
  addColumn('memo', 'TEXT');
  addColumnTo('record_relations', 'relation_score', 'INTEGER');
  addColumnTo('record_relations', 'note', 'TEXT');
  addColumnTo('consult_records', 'folder_id', 'INTEGER');
  addColumnTo('record_folders', 'parent_id', 'INTEGER');
  addColumnTo('record_folders', 'sort_order', 'INTEGER');

  // 예전 방식(기록에 딸린 next_appointment)으로 저장된 예약을 새 appointments 테이블로 1회성 이관.
  // 이미 이관된 기록(record_id로 연결된 예약이 있는 경우)은 건너뛴다.
  const legacy = all<{ id: number; student_id: number; next_appointment: string }>(
    `SELECT id, student_id, next_appointment FROM consult_records WHERE next_appointment IS NOT NULL`
  );
  for (const r of legacy) {
    const existing = get('SELECT id FROM appointments WHERE record_id = ?', [r.id]);
    if (existing) continue;
    db.run(
      `INSERT INTO appointments (student_id, appt_date, start_time, end_time, note, record_id) VALUES (?, ?, '09:00', '09:30', ?, ?)`,
      [r.student_id, r.next_appointment, '상담 예약(이관됨)', r.id]
    );
  }
}

function persist() {
  const data = Buffer.from(db.export());
  const blob = dbKey ? encryptBuffer(data, dbKey) : data;
  atomicWriteFileSync(dbFilePath, blob);
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
// 엑셀 일괄 등록: 기본 컬럼(학년도·학년·반·번호·이름) 외에 보호자·연락처 등 확장 컬럼도 인식한다.
// 같은 학년도·학년·반·번호·이름의 활성 학생이 이미 있으면 중복으로 보고 건너뛴다.
export interface StudentImportResult {
  imported: number;
  skipped: number;
  canceled?: boolean;
  error?: string;
}

const TEMPLATE_HEADERS = [
  '학년도',
  '학년',
  '반',
  '번호',
  '이름',
  '보호자1',
  '보호자1 연락처',
  '보호자2',
  '보호자2 연락처',
  '학생 연락처',
  '주소',
  '특이사항',
  '메모'
];

export function buildStudentTemplateFile(filePath: string) {
  const wb = XLSX.utils.book_new();
  const sample = ['2026', '1', '2', '5', '김예시', '김보호자', '010-0000-0000', '', '', '', '', '', ''];
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, sample]);
  ws['!cols'] = TEMPLATE_HEADERS.map(() => ({ wch: 14 }));
  XLSX.utils.book_append_sheet(wb, ws, '학생명부');
  XLSX.writeFile(wb, filePath);
}

export function importStudentsFromExcel(filePath: string): StudentImportResult {
  let rows: Record<string, string | number | undefined>[];
  try {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json<Record<string, string | number | undefined>>(sheet);
  } catch (e) {
    return { imported: 0, skipped: 0, error: `엑셀 파일을 읽을 수 없습니다: ${String(e)}` };
  }

  const toInt = (v: string | number | undefined) => (v != null && String(v).trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : null);
  const str = (v: string | number | undefined) => (v != null && String(v).trim() !== '' ? String(v).trim() : null);

  let imported = 0;
  let skipped = 0;
  for (const row of rows) {
    const name = str(row['이름'] ?? row['성명'] ?? row['학생명']);
    if (!name) {
      skipped++;
      continue;
    }
    const schoolYear = str(row['학년도']);
    const grade = toInt(row['학년']);
    const classNo = toInt(row['반'] ?? row['클래스']);
    const number = toInt(row['번호']);
    // 중복 검사: 이름 + 학년도 + 학년 + 반 + 번호가 모두 같으면 이미 등록된 학생으로 본다.
    const dup = get<{ id: number }>(
      `SELECT id FROM students WHERE active = 1 AND name = ? AND school_year IS ? AND grade IS ? AND class_no IS ? AND number IS ?`,
      [name, schoolYear, grade, classNo, number]
    );
    if (dup) {
      skipped++;
      continue;
    }
    db.run(
      `INSERT INTO students
        (name, school_year, grade, class_no, number, guardian_name, guardian_phone, guardian2_name, guardian2_phone, student_phone, address, health_note, memo, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        name,
        schoolYear,
        grade,
        classNo,
        number,
        str(row['보호자1'] ?? row['보호자']),
        str(row['보호자1 연락처'] ?? row['보호자 연락처']),
        str(row['보호자2']),
        str(row['보호자2 연락처']),
        str(row['학생 연락처']),
        str(row['주소']),
        str(row['특이사항']),
        str(row['메모'])
      ]
    );
    imported++;
  }
  persist();
  return { imported, skipped };
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
  guardian_name?: string | null;
  guardian_phone?: string | null;
  guardian2_name?: string | null;
  guardian2_phone?: string | null;
  student_phone?: string | null;
  address?: string | null;
  health_note?: string | null;
  memo?: string | null;
}

export function addStudent(input: NewStudent) {
  db.run(
    `INSERT INTO students
      (name, school_year, grade, class_no, number, guardian_name, guardian_phone, guardian2_name, guardian2_phone, student_phone, address, health_note, memo, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      input.name,
      input.school_year ?? null,
      input.grade ?? null,
      input.class_no ?? null,
      input.number ?? null,
      input.guardian_name ?? null,
      input.guardian_phone ?? null,
      input.guardian2_name ?? null,
      input.guardian2_phone ?? null,
      input.student_phone ?? null,
      input.address ?? null,
      input.health_note ?? null,
      input.memo ?? null
    ]
  );
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
  db.run(
    'DELETE FROM record_relations WHERE record_id IN (SELECT id FROM consult_records WHERE student_id = ?)',
    [id]
  );
  db.run('DELETE FROM record_actions WHERE student_id = ? OR record_id IN (SELECT id FROM consult_records WHERE student_id = ?)', [id, id]);
  db.run('DELETE FROM appointments WHERE student_id = ?', [id]);
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

export function getStudentById(id: number) {
  return get('SELECT * FROM students WHERE id = ?', [id]);
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
  const nextAppointment = get<{ appt_date: string; start_time: string }>(
    `SELECT appt_date, start_time FROM appointments
     WHERE student_id = ? AND appt_date >= date('now')
     ORDER BY appt_date ASC, start_time ASC LIMIT 1`,
    [id]
  );
  return {
    totalCount,
    followUpPending,
    niceUnreflectedCount,
    lastRecordDate: lastRecord?.record_date ?? null,
    nextAppointment: nextAppointment ? `${nextAppointment.appt_date} ${nextAppointment.start_time}` : null
  };
}

// ---------- 상담 기록 ----------
export function getRecordById(id: number) {
  return get(
    `SELECT r.*, s.name as student_name, t.name as type_name, t.color as type_color, f.name as folder_name
     FROM consult_records r
     JOIN students s ON s.id = r.student_id
     LEFT JOIN consult_types t ON t.id = r.type_id
     LEFT JOIN record_folders f ON f.id = r.folder_id
     WHERE r.id = ?`,
    [id]
  );
}

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
  if (filter.grade !== undefined) {
    clauses.push('s.grade IS ?');
    params.push(filter.grade);
  }
  if (filter.classNo !== undefined) {
    clauses.push('s.class_no IS ?');
    params.push(filter.classNo);
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
  if (filter.folderId !== undefined) {
    if (filter.folderId === null) {
      clauses.push('r.folder_id IS NULL');
    } else {
      // 선택 폴더와 그 하위 폴더의 기록까지 포함
      const ids = getFolderSubtreeIds(filter.folderId);
      clauses.push(`r.folder_id IN (${ids.map(() => '?').join(',')})`);
      params.push(...ids);
    }
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const dir = filter.order === 'asc' ? 'ASC' : 'DESC';
  const sortExpr =
    filter.sortBy === 'name'
      ? `s.name ${dir}, s.grade ${dir}, s.class_no ${dir}, s.number ${dir}, r.record_date ${dir}`
      : filter.sortBy === 'number'
        ? `s.grade ${dir}, s.class_no ${dir}, s.number ${dir}, s.name ${dir}, r.record_date ${dir}`
        : `r.record_date ${dir}, r.id ${dir}`;
  const limit = filter.limit ? `LIMIT ${Number(filter.limit)}` : '';

  return all(
    `SELECT r.*, s.name as student_name, s.grade as student_grade, s.class_no as student_class_no, s.number as student_number,
            t.name as type_name, t.color as type_color, f.name as folder_name
     FROM consult_records r
     JOIN students s ON s.id = r.student_id
     LEFT JOIN consult_types t ON t.id = r.type_id
     LEFT JOIN record_folders f ON f.id = r.folder_id
     ${where}
     ORDER BY ${sortExpr}
     ${limit}`,
    params
  );
}

export function addRecord(record: NewRecord) {
  db.run(
    `INSERT INTO consult_records
      (student_id, type_id, record_date, content, state_score, follow_up_needed, next_appointment, referred_to, reflected_in_nice, folder_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.student_id,
      record.type_id,
      record.record_date,
      record.content ?? '',
      record.state_score ?? null,
      record.follow_up_needed ? 1 : 0,
      record.next_appointment ?? null,
      record.referred_to ?? '',
      record.reflected_in_nice ? 1 : 0,
      record.folder_id ?? null
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
  db.run('DELETE FROM record_relations WHERE record_id = ?', [id]);
  db.run('DELETE FROM record_actions WHERE record_id = ?', [id]);
  db.run('DELETE FROM consult_records WHERE id = ?', [id]);
  persist();
  return { ok: true };
}

// ---------- 관계(갈등 대상) ----------
export interface RecordRelationInput {
  related_type: '학생' | '보호자' | '교사' | '기타';
  related_student_id?: number | null;
  related_label?: string | null;
  relation_score?: number | null;
  note?: string | null;
}

export function getRecordRelations(recordId: number) {
  return all(
    `SELECT rr.*, s.name as related_student_name
     FROM record_relations rr
     LEFT JOIN students s ON s.id = rr.related_student_id
     WHERE rr.record_id = ?
     ORDER BY rr.id`,
    [recordId]
  );
}

// 기록의 관계 목록을 통째로 교체한다(단순하게 유지: 기존 것 지우고 새로 삽입).
export function setRecordRelations(recordId: number, relations: RecordRelationInput[]) {
  db.run('DELETE FROM record_relations WHERE record_id = ?', [recordId]);
  for (const r of relations) {
    db.run(
      'INSERT INTO record_relations (record_id, related_type, related_student_id, related_label, relation_score, note) VALUES (?, ?, ?, ?, ?, ?)',
      [recordId, r.related_type, r.related_student_id ?? null, r.related_label ?? null, r.relation_score ?? null, r.note ?? null]
    );
  }
  persist();
  return getRecordRelations(recordId);
}

// 특정 학생과 관련된 관계 현황: 이 학생이 작성 주체인 기록에서 언급한 상대 + 다른 학생 기록에서 이 학생이 상대로 언급된 경우를 합산.
// 관계 점수(1~5)는 양방향에서 매겨진 값을 모두 모아 평균을 낸다.
// 점수 이력(날짜순 score 배열)으로부터 평균/최근값/범위를 계산한다.
// - avgScore: 참고용 전체 평균
// - latestScore: 가장 최근 기록의 점수 — "지금 상태"를 대표하는 값으로 그래프에는 이 값을 쓴다(오래된 점수에 묻히지 않도록)
// - minScore/maxScore: 기록마다 점수가 크게 엇갈리는지(예: 서로 다른 기록에서 5점/1점처럼 시각이 다른 경우) 판단하는 용도
function summarizeScores(rows: { score: number | null; date: string }[]) {
  const scored = rows
    .filter((r): r is { score: number; date: string } => r.score != null)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (scored.length === 0) {
    return { avgScore: null as number | null, latestScore: null as number | null, minScore: null as number | null, maxScore: null as number | null };
  }
  const values = scored.map((s) => s.score);
  const avgScore = Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10;
  const latestScore = scored[scored.length - 1].score;
  return { avgScore, latestScore, minScore: Math.min(...values), maxScore: Math.max(...values) };
}

export function getStudentRelationSummary(studentId: number) {
  // "관계 현황"과 그래프는 이 학생을 상담한 기록(student_id = studentId)에 달린 관계만 사용한다.
  // 즉 "이 학생이 다른 사람을 어떻게 생각/평가했는지"를 보여주는 공간이며,
  // 반대로 다른 학생의 기록에서 이 학생이 언급된 경우(asTarget)는 그 다른 학생의 관점이므로 여기 섞지 않는다.
  type Row = { other_id: number; other_name: string; score: number | null; record_date: string };
  const asAuthor = all<Row>(
    `SELECT rr.related_student_id as other_id, s2.name as other_name, rr.relation_score as score, r.record_date
     FROM record_relations rr
     JOIN consult_records r ON r.id = rr.record_id
     JOIN students s2 ON s2.id = rr.related_student_id
     WHERE r.student_id = ? AND rr.related_type = '학생'`,
    [studentId]
  );
  const grouped = new Map<number, { name: string; rows: { score: number | null; date: string }[] }>();
  for (const row of asAuthor) {
    const g = grouped.get(row.other_id) ?? { name: row.other_name, rows: [] };
    g.rows.push({ score: row.score, date: row.record_date });
    grouped.set(row.other_id, g);
  }
  const students = Array.from(grouped.entries())
    .map(([id, g]) => ({ studentId: id, name: g.name, count: g.rows.length, ...summarizeScores(g.rows) }))
    .sort((a, b) => b.count - a.count);

  const otherRows = all<{ related_type: string; score: number | null; record_date: string }>(
    `SELECT rr.related_type, rr.relation_score as score, r.record_date
     FROM record_relations rr
     JOIN consult_records r ON r.id = rr.record_id
     WHERE r.student_id = ? AND rr.related_type != '학생'`,
    [studentId]
  );
  const groupedOthers = new Map<string, { score: number | null; date: string }[]>();
  for (const row of otherRows) {
    const list = groupedOthers.get(row.related_type) ?? [];
    list.push({ score: row.score, date: row.record_date });
    groupedOthers.set(row.related_type, list);
  }
  const others = Array.from(groupedOthers.entries()).map(([type, rows]) => ({
    type,
    count: rows.length,
    ...summarizeScores(rows)
  }));

  return { students, others };
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
    `SELECT a.*, s.name as student_name
     FROM appointments a
     JOIN students s ON s.id = a.student_id
     WHERE a.appt_date >= date('now')
     ORDER BY a.appt_date ASC, a.start_time ASC
     LIMIT ?`,
    [limit]
  );
}

// ---------- 예약(캘린더) ----------
export interface NewAppointment {
  student_id: number;
  appt_date: string;
  start_time: string;
  end_time: string;
  note?: string | null;
  record_id?: number | null;
}

// 같은 날짜에 시간대가 겹치는 예약이 있는지 검사한다. excludeId는 자기 자신(수정 시) 제외용.
export function checkAppointmentConflict(input: { appt_date: string; start_time: string; end_time: string; excludeId?: number }) {
  const clauses = ['a.appt_date = ?', 'a.start_time < ?', 'a.end_time > ?'];
  const params: SqlValue[] = [input.appt_date, input.end_time, input.start_time];
  if (input.excludeId) {
    clauses.push('a.id != ?');
    params.push(input.excludeId);
  }
  return all(
    `SELECT a.*, s.name as student_name
     FROM appointments a
     JOIN students s ON s.id = a.student_id
     WHERE ${clauses.join(' AND ')}
     ORDER BY a.start_time`,
    params
  );
}

export function addAppointment(input: NewAppointment) {
  const conflicts = checkAppointmentConflict(input);
  if (conflicts.length > 0) {
    return { ok: false as const, conflicts };
  }
  db.run(
    'INSERT INTO appointments (student_id, appt_date, start_time, end_time, note, record_id) VALUES (?, ?, ?, ?, ?, ?)',
    [input.student_id, input.appt_date, input.start_time, input.end_time, input.note ?? null, input.record_id ?? null]
  );
  const id = lastInsertId();
  persist();
  const appointment = get('SELECT * FROM appointments WHERE id = ?', [id]);
  return { ok: true as const, appointment };
}

export function updateAppointment(id: number, patch: Partial<NewAppointment>) {
  const current = get<{ appt_date: string; start_time: string; end_time: string }>('SELECT * FROM appointments WHERE id = ?', [id]);
  if (!current) return { ok: false as const, error: '예약을 찾을 수 없습니다.' };

  const merged = {
    appt_date: patch.appt_date ?? current.appt_date,
    start_time: patch.start_time ?? current.start_time,
    end_time: patch.end_time ?? current.end_time
  };
  const conflicts = checkAppointmentConflict({ ...merged, excludeId: id });
  if (conflicts.length > 0) {
    return { ok: false as const, conflicts };
  }

  const fields = Object.keys(patch) as (keyof NewAppointment)[];
  if (fields.length > 0) {
    const setClause = fields.map((f) => `${f} = ?`).join(', ');
    const values = fields.map((f) => patch[f] ?? null) as SqlValue[];
    run(`UPDATE appointments SET ${setClause} WHERE id = ?`, [...values, id]);
  }
  return { ok: true as const, appointment: get('SELECT * FROM appointments WHERE id = ?', [id]) };
}

export function deleteAppointment(id: number) {
  run('DELETE FROM appointments WHERE id = ?', [id]);
  return { ok: true };
}

export function getAppointmentsInRange(startDate: string, endDate: string) {
  return all(
    `SELECT a.*, s.name as student_name
     FROM appointments a
     JOIN students s ON s.id = a.student_id
     WHERE a.appt_date >= ? AND a.appt_date <= ?
     ORDER BY a.appt_date, a.start_time`,
    [startDate, endDate]
  );
}

export function getAppointmentsForDate(date: string) {
  return all(
    `SELECT a.*, s.name as student_name
     FROM appointments a
     JOIN students s ON s.id = a.student_id
     WHERE a.appt_date = ?
     ORDER BY a.start_time`,
    [date]
  );
}

export function getTodayAppointments() {
  return all(
    `SELECT a.*, s.name as student_name
     FROM appointments a
     JOIN students s ON s.id = a.student_id
     WHERE a.appt_date = date('now')
     ORDER BY a.start_time`
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

export function addConsultType(input: { name: string; color: string }) {
  db.run('INSERT INTO consult_types (name, color) VALUES (?, ?)', [input.name, input.color]);
  const id = lastInsertId();
  persist();
  return get('SELECT * FROM consult_types WHERE id = ?', [id]);
}

export function updateConsultType(id: number, patch: { name?: string; color?: string }) {
  const fields = Object.keys(patch) as (keyof typeof patch)[];
  if (fields.length > 0) {
    const setClause = fields.map((f) => `${f} = ?`).join(', ');
    const values = fields.map((f) => patch[f]) as SqlValue[];
    run(`UPDATE consult_types SET ${setClause} WHERE id = ?`, [...values, id]);
  }
  return get('SELECT * FROM consult_types WHERE id = ?', [id]);
}

// 사용 중인(상담 기록이 하나라도 있는) 유형은 삭제할 수 없다 — 기존 기록의 유형 정보가 유실되는 것을 방지.
export function deleteConsultType(id: number): { ok: boolean; error?: string } {
  const usage = Number(get<{ c: number }>('SELECT COUNT(*) as c FROM consult_records WHERE type_id = ?', [id])?.c ?? 0);
  if (usage > 0) {
    return { ok: false, error: `이 유형을 사용한 기록이 ${usage}건 있어 삭제할 수 없습니다.` };
  }
  db.run('DELETE FROM quick_templates WHERE type_id = ?', [id]);
  db.run('DELETE FROM consult_types WHERE id = ?', [id]);
  persist();
  return { ok: true };
}

export function getQuickTemplates(typeId: number) {
  return all('SELECT * FROM quick_templates WHERE type_id = ? ORDER BY id', [typeId]);
}

export function addQuickTemplate(input: { type_id: number; text: string }) {
  db.run('INSERT INTO quick_templates (type_id, text) VALUES (?, ?)', [input.type_id, input.text]);
  const id = lastInsertId();
  persist();
  return get('SELECT * FROM quick_templates WHERE id = ?', [id]);
}

export function deleteQuickTemplate(id: number) {
  run('DELETE FROM quick_templates WHERE id = ?', [id]);
  return { ok: true };
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

// ---------- 백업 / 복원 ----------
// 백업: 현재 DB 스냅샷을 비밀번호 기반 AES-256-GCM(scrypt 키 유도)으로 암호화한 .backup 파일로 저장.
// 복원: 비밀번호로 복호화해 성공하면 기존 DB를 대체. 실패(비밀번호 불일치·손상) 시 기존 DB는 그대로 유지.
export function createBackup(password: string, savePath: string): { ok: boolean; error?: string } {
  try {
    const salt = randomBytes(16);
    const key = scryptSync(password, salt, 32);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const plain = Buffer.from(db.export());
    const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
    const tag = cipher.getAuthTag();
    const blob = Buffer.concat([Buffer.from('CSLBKP1\n', 'ascii'), salt, iv, tag, ct]);
    atomicWriteFileSync(savePath, blob);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export function restoreBackup(password: string, filePath: string): { ok: boolean; error?: string } {
  try {
    const blob = fs.readFileSync(filePath);
    const magic = Buffer.from('CSLBKP1\n', 'ascii');
    if (blob.length < 8 + 16 + 12 + 16 || !blob.subarray(0, 8).equals(magic)) {
      return { ok: false, error: '백업 파일 형식이 올바르지 않습니다.' };
    }
    const salt = blob.subarray(8, 24);
    const iv = blob.subarray(24, 36);
    const tag = blob.subarray(36, 52);
    const ct = blob.subarray(52);
    const key = scryptSync(password, salt, 32);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ct), decipher.final()]); // 비밀번호 불일치 시 여기서 예외
    const DbCtor = db.constructor as new (data?: Uint8Array) => SqlJsDatabase;
    db = new DbCtor(plain);
    db.exec(SCHEMA);
    migrateSchema();
    seedDefaults();
    persist();
    return { ok: true };
  } catch (e) {
    const msg = String(e);
    if (msg.includes('Unsupported state or unable to authenticate data')) {
      return { ok: false, error: '비밀번호가 올바르지 않거나 파일이 손상되었습니다.' };
    }
    return { ok: false, error: msg };
  }
}

// ---------- 자동 백업(로컬 스냅샷) ----------
// DB 키로 암호화된 스냅샷을 userData/auto-backups에 남기고 최근 keep개만 보관한다.
// 수동 백업(.backup, 비밀번호 기반)과 달리 PC 밖으로 나가면 열 수 없는 내부 안전망이다.
function autoBackupDir(): string {
  const dir = path.join(app.getPath('userData'), 'auto-backups');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function createAutoSnapshot(keep = 7): { ok: boolean; filePath?: string; error?: string } {
  try {
    const dir = autoBackupDir();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filePath = path.join(dir, `snapshot-${stamp}.bak`);
    const data = Buffer.from(db.export());
    const blob = dbKey ? encryptBuffer(data, dbKey) : data;
    atomicWriteFileSync(filePath, blob);
    // 오래된 스냅샷 정리
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith('snapshot-') && f.endsWith('.bak'))
      .map((f) => ({ f, m: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.m - a.m);
    for (const old of files.slice(keep)) fs.rmSync(path.join(dir, old.f));
    return { ok: true, filePath };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export function listAutoSnapshots() {
  const dir = autoBackupDir();
  return fs
    .readdirSync(dir)
    .filter((f) => f.startsWith('snapshot-') && f.endsWith('.bak'))
    .map((f) => {
      const st = fs.statSync(path.join(dir, f));
      return { name: f, size: st.size, modified: st.mtime.toISOString() };
    })
    .sort((a, b) => b.modified.localeCompare(a.modified));
}

export function restoreAutoSnapshot(name: string): { ok: boolean; error?: string } {
  // 경로 이탈 방지: 파일명만 허용
  if (name.includes('/') || name.includes('\\') || name.includes('..')) {
    return { ok: false, error: '잘못된 스냅샷 이름입니다.' };
  }
  try {
    const filePath = path.join(autoBackupDir(), name);
    const blob = fs.readFileSync(filePath);
    const plain = isEncryptedFile(blob) ? decryptBuffer(blob, dbKey!) : blob;
    const DbCtor = db.constructor as new (data?: Uint8Array) => SqlJsDatabase;
    db = new DbCtor(plain);
    db.exec(SCHEMA);
    migrateSchema();
    seedDefaults();
    persist();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ---------- 상담 폴더 ----------
// 폴더는 트리 구조(parent_id) + 같은 부모 안에서 sort_order로 순서를 가진다.
export function getFolders() {
  return all(
    `SELECT f.*, (SELECT COUNT(*) FROM consult_records r WHERE r.folder_id = f.id) as record_count
     FROM record_folders f ORDER BY f.sort_order IS NULL, f.sort_order ASC, f.name`
  );
}

// 폴더 id → 자기 자신을 포함한 하위 트리 전체 id 목록 (기록 필터·삭제 시 사용)
export function getFolderSubtreeIds(folderId: number): number[] {
  const allFolders = all<{ id: number; parent_id: number | null }>('SELECT id, parent_id FROM record_folders');
  const children = new Map<number | null, number[]>();
  for (const f of allFolders) {
    const list = children.get(f.parent_id ?? null) ?? [];
    list.push(f.id);
    children.set(f.parent_id ?? null, list);
  }
  const out: number[] = [];
  const stack = [folderId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    out.push(id);
    for (const c of children.get(id) ?? []) stack.push(c);
  }
  return out;
}

export function addFolder(name: string, parentId: number | null = null): { ok: boolean; error?: string; folder?: unknown } {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return { ok: false, error: '폴더 이름을 입력하세요.' };
  // 같은 부모 안에서 이름 중복 검사
  const dup = get('SELECT id FROM record_folders WHERE name = ? AND parent_id IS ?', [trimmed, parentId]);
  if (dup) return { ok: false, error: '같은 이름의 폴더가 이미 있습니다.' };
  const maxOrder = get<{ m: number | null }>('SELECT MAX(sort_order) as m FROM record_folders WHERE parent_id IS ?', [parentId]);
  const nextOrder = Number(maxOrder?.m ?? 0) + 1;
  db.run('INSERT INTO record_folders (name, parent_id, sort_order) VALUES (?, ?, ?)', [trimmed, parentId, nextOrder]);
  const id = lastInsertId();
  persist();
  return { ok: true, folder: get('SELECT * FROM record_folders WHERE id = ?', [id]) };
}

export function renameFolder(id: number, name: string): { ok: boolean; error?: string } {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return { ok: false, error: '폴더 이름을 입력하세요.' };
  const cur = get<{ parent_id: number | null }>('SELECT parent_id FROM record_folders WHERE id = ?', [id]);
  const dup = get('SELECT id FROM record_folders WHERE name = ? AND id != ? AND parent_id IS ?', [trimmed, id, cur?.parent_id ?? null]);
  if (dup) return { ok: false, error: '같은 이름의 폴더가 이미 있습니다.' };
  run('UPDATE record_folders SET name = ? WHERE id = ?', [trimmed, id]);
  return { ok: true };
}

// 폴더 이동(드래그 앤 드롭): 부모 변경 + 같은 부모 안에서 순서 변경.
// targetParentId=null이면 최상위, beforeFolderId가 있으면 그 앞에, 없으면 맨 뒤에 놓는다.
// 자기 자신을 자기 하위로 넣는 것(순환)은 차단한다.
export function moveFolder(
  id: number,
  targetParentId: number | null,
  beforeFolderId: number | null
): { ok: boolean; error?: string } {
  if (targetParentId != null) {
    if (targetParentId === id) return { ok: false, error: '자기 자신 안으로 옮길 수 없습니다.' };
    if (getFolderSubtreeIds(id).includes(targetParentId)) {
      return { ok: false, error: '하위 폴더를 자기 자신 안으로 옮길 수 없습니다.' };
    }
  }
  const siblings = all<{ id: number }>(
    'SELECT id FROM record_folders WHERE parent_id IS ? AND id != ? ORDER BY sort_order IS NULL, sort_order ASC, name',
    [targetParentId, id]
  ).map((r) => r.id);
  let insertAt = siblings.length;
  if (beforeFolderId != null && beforeFolderId !== id) {
    const idx = siblings.indexOf(beforeFolderId);
    if (idx >= 0) insertAt = idx;
  }
  const newOrder = siblings.slice(0, insertAt).concat([id]).concat(siblings.slice(insertAt));
  db.run('UPDATE record_folders SET parent_id = ? WHERE id = ?', [targetParentId, id]);
  newOrder.forEach((fid, i) => db.run('UPDATE record_folders SET sort_order = ? WHERE id = ?', [i + 1, fid]));
  persist();
  return { ok: true };
}

// 폴더 삭제: 안의 기록은 지우지 않고 미분류로 되돌린다(기록 손실 방지).
// 하위 폴더는 부모를 삭제된 폴더의 부모로 승격시켜 보존한다.
export function deleteFolder(id: number) {
  const cur = get<{ parent_id: number | null }>('SELECT parent_id FROM record_folders WHERE id = ?', [id]);
  db.run('UPDATE record_folders SET parent_id = ? WHERE parent_id = ?', [cur?.parent_id ?? null, id]);
  db.run('UPDATE consult_records SET folder_id = NULL WHERE folder_id = ?', [id]);
  db.run('DELETE FROM record_folders WHERE id = ?', [id]);
  persist();
  return { ok: true };
}

// ---------- 조치사항(상담 이후 후속 조치) ----------
export interface NewAction {
  record_id?: number | null;
  student_id?: number | null;
  text: string;
  done?: boolean;
  due_date?: string | null;
}

export function getActions(filter: { recordId?: number; studentId?: number; pendingOnly?: boolean } = {}) {
  const clauses: string[] = [];
  const params: SqlValue[] = [];
  if (filter.recordId) {
    clauses.push('a.record_id = ?');
    params.push(filter.recordId);
  }
  if (filter.studentId) {
    clauses.push('a.student_id = ?');
    params.push(filter.studentId);
  }
  if (filter.pendingOnly) clauses.push('a.done = 0');
  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  return all(
    `SELECT a.*, s.name as student_name, r.record_date
     FROM record_actions a
     LEFT JOIN students s ON s.id = a.student_id
     LEFT JOIN consult_records r ON r.id = a.record_id
     ${where}
     ORDER BY a.done ASC, a.due_date IS NULL, a.due_date ASC, a.id DESC`,
    params
  );
}

export function addAction(input: NewAction) {
  const text = (input.text ?? '').trim();
  if (!text) return { ok: false as const, error: '조치사항 내용을 입력하세요.' };
  db.run(
    'INSERT INTO record_actions (record_id, student_id, text, done, due_date) VALUES (?, ?, ?, ?, ?)',
    [input.record_id ?? null, input.student_id ?? null, text, input.done ? 1 : 0, input.due_date ?? null]
  );
  const id = lastInsertId();
  persist();
  return { ok: true as const, action: get('SELECT * FROM record_actions WHERE id = ?', [id]) };
}

export function updateAction(id: number, patch: { text?: string; done?: boolean; due_date?: string | null }) {
  const fields: string[] = [];
  const values: SqlValue[] = [];
  if (patch.text !== undefined) {
    fields.push('text = ?');
    values.push(patch.text.trim());
  }
  if (patch.done !== undefined) {
    fields.push('done = ?');
    values.push(patch.done ? 1 : 0);
  }
  if (patch.due_date !== undefined) {
    fields.push('due_date = ?');
    values.push(patch.due_date);
  }
  if (fields.length > 0) {
    run(`UPDATE record_actions SET ${fields.join(', ')} WHERE id = ?`, [...values, id]);
  }
  return { ok: true as const, action: get('SELECT * FROM record_actions WHERE id = ?', [id]) };
}

export function deleteAction(id: number) {
  run('DELETE FROM record_actions WHERE id = ?', [id]);
  return { ok: true };
}

// ---------- 학생 관계 그래프 ----------
// 학생-학생 관계(기록의 관련 대상 중 '학생')를 무방향 쌍으로 집계한다.
// 쌍마다: 언급 횟수, 가장 최근 점수(엣지 색 기준), 전체 평균, 점수 범위, 양방향 여부.
export function getRelationGraph() {
  type Row = {
    author_id: number;
    author_name: string;
    other_id: number;
    other_name: string;
    score: number | null;
    record_date: string;
  };
  const rows = all<Row>(
    `SELECT r.student_id as author_id, s1.name as author_name,
            rr.related_student_id as other_id, s2.name as other_name,
            rr.relation_score as score, r.record_date
     FROM record_relations rr
     JOIN consult_records r ON r.id = rr.record_id
     JOIN students s1 ON s1.id = r.student_id
     JOIN students s2 ON s2.id = rr.related_student_id
     WHERE rr.related_type = '학생'`
  );

  const groups = new Map<string, { a: number; aName: string; b: number; bName: string; entries: { score: number | null; date: string; from: number }[] }>();
  for (const row of rows) {
    const key = row.author_id < row.other_id ? `${row.author_id}-${row.other_id}` : `${row.other_id}-${row.author_id}`;
    const g =
      groups.get(key) ??
      {
        a: Math.min(row.author_id, row.other_id),
        aName: row.author_id < row.other_id ? row.author_name : row.other_name,
        b: Math.max(row.author_id, row.other_id),
        bName: row.author_id < row.other_id ? row.other_name : row.author_name,
        entries: []
      };
    g.entries.push({ score: row.score, date: row.record_date, from: row.author_id });
    groups.set(key, g);
  }

  const edges = Array.from(groups.values()).map((g) => {
    const scored = g.entries.filter((e): e is { score: number; date: string; from: number } => e.score != null);
    scored.sort((x, y) => x.date.localeCompare(y.date));
    const values = scored.map((s) => s.score);
    const latest = scored.length > 0 ? scored[scored.length - 1] : null;
    return {
      a: g.a,
      aName: g.aName,
      b: g.b,
      bName: g.bName,
      count: g.entries.length,
      latestScore: latest ? latest.score : null,
      latestFrom: latest ? latest.from : null,
      avgScore: values.length > 0 ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10 : null,
      minScore: values.length > 0 ? Math.min(...values) : null,
      maxScore: values.length > 0 ? Math.max(...values) : null,
      bidirectional: new Set(g.entries.map((e) => e.from)).size > 1
    };
  });

  const nodeIds = new Set<number>();
  const nodeNames = new Map<number, string>();
  const nodeMeta = new Map<number, { grade: number | null; class_no: number | null; number: number | null }>();
  const metaRows = all<{ id: number; name: string; grade: number | null; class_no: number | null; number: number | null }>(
    'SELECT id, name, grade, class_no, number FROM students'
  );
  for (const m of metaRows) {
    nodeNames.set(m.id, m.name);
    nodeMeta.set(m.id, { grade: m.grade, class_no: m.class_no, number: m.number });
  }
  for (const e of edges) {
    nodeIds.add(e.a);
    nodeIds.add(e.b);
  }
  const nodes = Array.from(nodeIds).map((id) => ({
    id,
    name: nodeNames.get(id) ?? `#${id}`,
    grade: nodeMeta.get(id)?.grade ?? null,
    classNo: nodeMeta.get(id)?.class_no ?? null,
    number: nodeMeta.get(id)?.number ?? null
  }));

  return { nodes, edges };
}

// ---------- 학생 상담 다이제스트 ----------
// 학생 개인 화면용: 이전 상담 내용 간단 정리 + 상태 점수 시계열.
export function getStudentDigest(studentId: number) {
  // 최근 기록 5건 (요약 카드용)
  const recent = all(
    `SELECT r.id, r.record_date, r.content, r.state_score, r.follow_up_needed, r.follow_up_done,
            t.name as type_name, t.color as type_color
     FROM consult_records r
     LEFT JOIN consult_types t ON t.id = r.type_id
     WHERE r.student_id = ?
     ORDER BY r.record_date DESC, r.id DESC
     LIMIT 5`,
    [studentId]
  );

  // 상태 점수 시계열 (그래프용, 오래된 순)
  const scoreSeries = all<{ record_date: string; state_score: number }>(
    `SELECT record_date, state_score FROM consult_records
     WHERE student_id = ? AND state_score IS NOT NULL
     ORDER BY record_date ASC, id ASC`,
    [studentId]
  );

  // 미완료 조치사항
  const pendingActions = getActions({ studentId, pendingOnly: true });

  // 최근 30일 기록 건수 (위기 신호 참고용)
  const last30Count = Number(
    get<{ c: number }>(
      `SELECT COUNT(*) as c FROM consult_records WHERE student_id = ? AND record_date >= date('now', '-30 days')`,
      [studentId]
    )?.c ?? 0
  );

  return { recent, scoreSeries, pendingActions, last30Count };
}
