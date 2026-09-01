import Database from 'better-sqlite3';
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';

export interface RecordFilter {
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

// schema.sql과 내용이 동일합니다. 빌드 산출물 경로 문제를 피하기 위해 문자열로 내장합니다.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    student_no TEXT,
    class_name TEXT,
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

let db: Database.Database;

export function initDatabase(): Database.Database {
  const userDataPath = app.getPath('userData');
  if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true });
  const dbPath = path.join(userDataPath, 'counseling.db');

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);

  seedDefaults();
  return db;
}

function seedDefaults() {
  const typeCount = (db.prepare('SELECT COUNT(*) as c FROM consult_types').get() as { c: number }).c;
  if (typeCount === 0) {
    const insertType = db.prepare('INSERT INTO consult_types (name, color) VALUES (?, ?)');
    const insertTemplate = db.prepare('INSERT INTO quick_templates (type_id, text) VALUES (?, ?)');
    const tx = db.transaction(() => {
      for (const t of DEFAULT_TYPES) {
        const info = insertType.run(t.name, t.color);
        const templates = DEFAULT_TEMPLATES[t.name];
        if (templates) {
          for (const text of templates) insertTemplate.run(info.lastInsertRowid, text);
        }
      }
    });
    tx();
  }
}

export function getDb() {
  return db;
}

// ---------- 학생 ----------
export function importStudentsFromExcel(filePath: string) {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<{ 이름?: string; 학번?: string | number; 번호?: string | number }>(sheet);

  const insert = db.prepare('INSERT INTO students (name, student_no, active) VALUES (?, ?, 1)');
  const tx = db.transaction((rows: any[]) => {
    let count = 0;
    for (const row of rows) {
      const name = row['이름'];
      if (!name) continue;
      const studentNo = row['학번'] != null ? String(row['학번']) : null;
      insert.run(name, studentNo);
      count++;
    }
    return count;
  });
  const imported = tx(rows);
  return { imported };
}

export function getStudents(activeOnly = true) {
  const query = activeOnly
    ? 'SELECT * FROM students WHERE active = 1 ORDER BY name'
    : 'SELECT * FROM students ORDER BY name';
  return db.prepare(query).all();
}

export function togglePin(studentId: number) {
  db.prepare('UPDATE students SET pinned = NOT pinned WHERE id = ?').run(studentId);
  return db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
}

export function archiveCurrentYear(yearLabel: string) {
  const tx = db.transaction(() => {
    db.prepare('UPDATE students SET archived_year = ?, active = 0 WHERE active = 1').run(yearLabel);
  });
  tx();
  return { ok: true };
}

// ---------- 상담 기록 ----------
export function getRecords(filter: RecordFilter = {}) {
  const clauses: string[] = [];
  const params: any[] = [];

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

  return db
    .prepare(
      `SELECT r.*, s.name as student_name, t.name as type_name, t.color as type_color
       FROM consult_records r
       JOIN students s ON s.id = r.student_id
       LEFT JOIN consult_types t ON t.id = r.type_id
       ${where}
       ORDER BY r.record_date ${order}, r.id ${order}
       ${limit}`
    )
    .all(...params);
}

export function addRecord(record: NewRecord) {
  const info = db
    .prepare(
      `INSERT INTO consult_records
        (student_id, type_id, record_date, content, state_score, follow_up_needed, next_appointment, referred_to, reflected_in_nice)
       VALUES (@student_id, @type_id, @record_date, @content, @state_score, @follow_up_needed, @next_appointment, @referred_to, @reflected_in_nice)`
    )
    .run({
      student_id: record.student_id,
      type_id: record.type_id,
      record_date: record.record_date,
      content: record.content ?? '',
      state_score: record.state_score ?? null,
      follow_up_needed: record.follow_up_needed ? 1 : 0,
      next_appointment: record.next_appointment ?? null,
      referred_to: record.referred_to ?? '',
      reflected_in_nice: record.reflected_in_nice ? 1 : 0
    });
  return db.prepare('SELECT * FROM consult_records WHERE id = ?').get(info.lastInsertRowid);
}

export function updateRecord(id: number, patch: Partial<NewRecord>) {
  const fields = Object.keys(patch);
  if (fields.length === 0) return db.prepare('SELECT * FROM consult_records WHERE id = ?').get(id);
  const setClause = fields.map((f) => `${f} = @${f}`).join(', ');
  db.prepare(`UPDATE consult_records SET ${setClause} WHERE id = @id`).run({ ...patch, id });
  return db.prepare('SELECT * FROM consult_records WHERE id = ?').get(id);
}

export function deleteRecord(id: number) {
  db.prepare('DELETE FROM consult_records WHERE id = ?').run(id);
  return { ok: true };
}

// ---------- 통계 / 위기감지 ----------
export function getMonthlyStats() {
  const monthly = db
    .prepare(
      `SELECT strftime('%Y-%m', record_date) as month, COUNT(*) as count
       FROM consult_records
       GROUP BY month
       ORDER BY month DESC
       LIMIT 12`
    )
    .all();

  const byType = db
    .prepare(
      `SELECT t.name as type_name, t.color as type_color, COUNT(*) as count
       FROM consult_records r
       JOIN consult_types t ON t.id = r.type_id
       GROUP BY r.type_id
       ORDER BY count DESC`
    )
    .all();

  const thisMonthCount = (
    db
      .prepare(`SELECT COUNT(*) as c FROM consult_records WHERE record_date >= date('now', 'start of month')`)
      .get() as { c: number }
  ).c;

  const followUpPending = (
    db.prepare(`SELECT COUNT(*) as c FROM consult_records WHERE follow_up_needed = 1 AND follow_up_done = 0`).get() as {
      c: number;
    }
  ).c;

  const studentCount = (db.prepare('SELECT COUNT(*) as c FROM students WHERE active = 1').get() as { c: number }).c;

  return { monthly, byType, thisMonthCount, followUpPending, studentCount };
}

export function getStudentRanking(limit = 10) {
  return db
    .prepare(
      `SELECT s.id as student_id, s.name, COUNT(*) as count
       FROM consult_records r
       JOIN students s ON s.id = r.student_id
       GROUP BY r.student_id
       ORDER BY count DESC
       LIMIT ?`
    )
    .all(limit);
}

export function getCrisisAlerts() {
  const thresholdDays = Number(getSetting('crisis_threshold_days') ?? 14);
  const thresholdCount = Number(getSetting('crisis_threshold_count') ?? 3);
  return db
    .prepare(
      `SELECT r.student_id, s.name, COUNT(*) as count
       FROM consult_records r
       JOIN students s ON s.id = r.student_id
       WHERE r.record_date >= date('now', '-' || ? || ' days')
       GROUP BY r.student_id
       HAVING count >= ?`
    )
    .all(thresholdDays, thresholdCount);
}

// ---------- 유형 / 템플릿 ----------
export function getConsultTypes() {
  return db.prepare('SELECT * FROM consult_types ORDER BY id').all();
}

export function getQuickTemplates(typeId: number) {
  return db.prepare('SELECT * FROM quick_templates WHERE type_id = ? ORDER BY id').all(typeId);
}

// ---------- 설정 ----------
export function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

export function setSetting(key: string, value: string) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(
    key,
    value
  );
  return { ok: true };
}
