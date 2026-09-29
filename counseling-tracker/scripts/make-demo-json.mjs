// 예시 데이터 JSON 생성 스크립트 (대회 시연·검증용)
//
// 목적: 예전에는 npm run seed:demo 로 개발 PC의 암호화 DB를 직접 고쳐야 예시 데이터가 들어갔지만,
//       이제는 앱의 [설정 > 데이터 > JSON 가져오기] 로 바로 불러올 수 있는 JSON 파일을 만들어 둔다.
//       생성된 JSON은 앱의 "JSON 내보내기"와 완전히 같은 형식이므로 백업 파일처럼 보관·복원할 수 있다.
//
// 실행: npm run make:demo-json
// 출력: samples/예시데이터_1학년2반.json
//
// 규칙: 실제 학생이 아닌 가상 이름만 사용(대회 제출 규정), 결과는 항상 동일(고정 시드 난수).
//       날짜는 실행일(KST) 기준 상대 날짜로 계산되므로 필요할 때 다시 실행하면 최신 날짜로 갱신된다.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'samples', '예시데이터_1학년2반.json');

// ---------- 앱 DB 스키마 (electron/db/database.ts SCHEMA + migrateSchema 컬럼) ----------
const DDL = `
CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY, name TEXT NOT NULL, school_year TEXT, grade INTEGER, class_no INTEGER,
    number INTEGER, guardian_name TEXT, guardian_phone TEXT, guardian2_name TEXT, guardian2_phone TEXT,
    student_phone TEXT, address TEXT, health_note TEXT, memo TEXT,
    pinned BOOLEAN DEFAULT 0, active BOOLEAN DEFAULT 1, archived_year TEXT
);
CREATE TABLE IF NOT EXISTS consult_types (id INTEGER PRIMARY KEY, name TEXT NOT NULL, color TEXT);
CREATE TABLE IF NOT EXISTS quick_templates (id INTEGER PRIMARY KEY, type_id INTEGER, text TEXT);
CREATE TABLE IF NOT EXISTS consult_records (
    id INTEGER PRIMARY KEY, student_id INTEGER, type_id INTEGER, record_date DATE NOT NULL, content TEXT,
    state_score INTEGER, follow_up_needed BOOLEAN DEFAULT 0, follow_up_done BOOLEAN DEFAULT 0,
    next_appointment DATE, referred_to TEXT, reflected_in_nice BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, folder_id INTEGER
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY, student_id INTEGER, appt_date DATE NOT NULL, start_time TEXT NOT NULL,
    end_time TEXT NOT NULL, note TEXT, record_id INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS record_relations (
    id INTEGER PRIMARY KEY, record_id INTEGER, related_type TEXT NOT NULL, related_student_id INTEGER,
    related_label TEXT, relation_score INTEGER, note TEXT
);
CREATE TABLE IF NOT EXISTS record_folders (
    id INTEGER PRIMARY KEY, name TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    parent_id INTEGER, sort_order INTEGER
);
CREATE TABLE IF NOT EXISTS record_actions (
    id INTEGER PRIMARY KEY, record_id INTEGER, student_id INTEGER, text TEXT NOT NULL,
    done BOOLEAN DEFAULT 0, due_date DATE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    done_date TEXT, done_note TEXT, repeat_days INTEGER
);
`;

const TYPES = [
  { id: 1, name: '교우관계', color: '#4f8ef7' },
  { id: 2, name: '학습', color: '#3aa76d' },
  { id: 3, name: '진로', color: '#a26fe0' },
  { id: 4, name: '가정환경', color: '#e0a13a' },
  { id: 5, name: '정서·심리', color: '#e06a6a' },
  { id: 6, name: '학교폭력', color: '#d94848' },
  { id: 7, name: '출결', color: '#2383e2' },
  { id: 8, name: '칭찬·상벌점', color: '#f2a90c' },
  { id: 9, name: '학부모 연락', color: '#5fb37a' },
  { id: 10, name: '기타', color: '#8a8f98' }
];

const TEMPLATES = [
  [1, '교우관계 갈등 - 중재 완료'],
  [1, '또래 관계 개선을 위한 지속 관찰 필요'],
  [2, '학습 부진 상담 - 방과후 보충 안내'],
  [2, '학습 동기 저하 - 목표 설정 상담 진행'],
  [5, '정서적 어려움 호소 - Wee클래스 연계 안내']
];

const STUDENT_NAMES = [
  '김민준', '이서연', '박도윤', '최예은', '정하준', '강지우', '조수빈', '윤연우', '장시우', '임다은',
  '한지호', '오서준', '신유진', '권은서', '황현우', '안소율', '송준서', '류아윤', '전동현', '홍채원',
  '문민서', '양지안', '배태윤', '백나윤', '남성민', '노하은', '심준혁', '하윤서', '주재현', '구수아'
];

const CONTENT_BY_TYPE = {
  교우관계: ['짝과의 갈등 상담 후 화해 지도', '또래관계 개선을 위한 지속 관찰', '모둠활동 중 다툼 중재 완료', '친구 관계 어려움 호소 상담'],
  학습: ['학습 부진 상담 - 방과후 보충 안내', '학습 동기 저하 - 목표 설정 상담 진행', '과제 미제출 관련 지도', '성적 하락 원인 상담'],
  진로: ['희망 진로 탐색 상담', '진로 검사 결과 안내 및 상담', '고교·학과 선택 관련 상담'],
  가정환경: ['가정환경 변화로 인한 정서 지원 상담', '보호자 면담 요청 및 진행'],
  '정서·심리': ['정서적 어려움 호소 - Wee클래스 연계 안내', '불안감 호소 상담 진행', '스트레스 관리 지도'],
  학교폭력: ['학교폭력 관련 초기 상담', '관련 사안 조사 협조 요청'],
  출결: ['지각 누적 관련 상담', '결석 사유 확인 및 지도', '무단조퇴 관련 지도'],
  '칭찬·상벌점': ['봉사활동 우수 칭찬', '선행 상점 부여', '규칙 위반으로 벌점 부여 및 지도'],
  '학부모 연락': ['보호자 전화 상담 진행', '가정통신 관련 안내 통화'],
  기타: ['개별 상담 진행', '진로체험 관련 안내']
};

// 관계 데모: [기록 주체 번호(1-based), 상대 번호, 점수(1~5 또는 null), 며칠 전]
const RELATION_ENTRIES = [
  [1, 2, 1, 60], [1, 2, 2, 20], [2, 1, 1, 18],
  [2, 3, 2, 50], [2, 3, 3, 12],
  [1, 3, 1, 40],
  [4, 5, 5, 70], [4, 5, 4, 15],
  [5, 6, 4, 55], [5, 6, 5, 10], [6, 5, 4, 9],
  [4, 6, 5, 30],
  [7, 8, 3, 45], [7, 8, 3, 8],
  [8, 9, 2, 35], [8, 9, 4, 6],
  [9, 10, null, 25],
  [10, 11, 4, 22],
  [12, 13, 1, 65], [12, 13, 1, 28], [12, 13, 2, 5],
  [14, 15, 5, 18],
  [16, 17, 3, 33],
  [18, 19, 2, 14],
  [20, 21, 4, 48], [20, 21, 5, 7],
  [22, 23, null, 40], [22, 23, 3, 11],
  [24, 25, 1, 26],
  [26, 27, 5, 16], [26, 27, 5, 4],
  [28, 29, 3, 38], [28, 29, 2, 9],
  [30, 1, 4, 21],
  [15, 16, 2, 44], [15, 16, 3, 13],
  [5, 7, 4, 29]
];

// 조치사항: [학생 index, 내용, 마감(양수=며칠 뒤, 음수=며칠 전), 완료 여부]
const ACTION_SEED = [
  [0, '보호자 전화 상담 진행', 3, 0],
  [1, 'Wee클래스 연계 결과 확인', -2, 0],
  [4, '짝 변경 후 적응 관찰', 7, 0],
  [7, '칭찬 스티커 부여', null, 1],
  [11, '보호자 면담 일정 조율', 5, 0],
  [19, '방과후 프로그램 신청 안내', null, 1]
];

// ---------- 고정 시드 난수 (실행할 때마다 같은 결과) ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260929);
const randInt = (min, max) => Math.floor(rnd() * (max - min + 1)) + min;
const pick = (arr) => arr[randInt(0, arr.length - 1)];

// ---------- 날짜 (KST 기준 상대 날짜) ----------
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
function kstNow() {
  return new Date(Date.now() + KST_OFFSET_MS);
}
function dateDaysAgo(days) {
  return new Date(kstNow().getTime() - days * DAY_MS).toISOString().slice(0, 10);
}
function stampDaysAgo(days) {
  return `${dateDaysAgo(days)} ${new Date(kstNow().getTime() - days * DAY_MS).toISOString().slice(11, 19)}`;
}
function futureDateWithinDays(maxForward) {
  return dateDaysAgo(-randInt(1, maxForward));
}

const TODAY_STAMP = stampDaysAgo(0);

// ---------- 행 생성 ----------
const students = STUDENT_NAMES.map((name, i) => ({
  id: i + 1,
  name,
  school_year: '2026',
  grade: 1,
  class_no: 2,
  number: i + 1,
  guardian_name: null,
  guardian_phone: null,
  guardian2_name: null,
  guardian2_phone: null,
  student_phone: null,
  address: null,
  health_note: null,
  memo: null,
  pinned: i < 3 ? 1 : 0,
  active: 1,
  archived_year: null
}));

const recordFolders = [
  { id: 1, name: '위기학생 관리', created_at: TODAY_STAMP, parent_id: null, sort_order: 1 },
  { id: 2, name: '학급 적응 지원', created_at: TODAY_STAMP, parent_id: null, sort_order: 2 }
];

const consultRecords = [];
const recordRelations = [];
const recordActions = [];
const appointments = [];

const typeByName = (name) => TYPES.find((t) => t.name === name) ?? TYPES[9];

function addRecord(studentId, typeName, daysAgo, opts = {}) {
  const type = typeByName(typeName);
  const pool = CONTENT_BY_TYPE[typeName] ?? ['개별 상담 진행'];
  const id = consultRecords.length + 1;
  consultRecords.push({
    id,
    student_id: studentId,
    type_id: type.id,
    record_date: dateDaysAgo(daysAgo),
    content: opts.content ?? pick(pool),
    state_score: opts.stateScore ?? (rnd() < 0.75 ? randInt(1, 5) : null),
    follow_up_needed: opts.followUpNeeded ? 1 : 0,
    follow_up_done: opts.followUpDone ? 1 : 0,
    next_appointment: null,
    referred_to: opts.referredTo ?? '',
    reflected_in_nice: opts.reflectedInNice == null ? (rnd() < 0.6 ? 1 : 0) : opts.reflectedInNice ? 1 : 0,
    created_at: `${dateDaysAgo(daysAgo)} ${String(randInt(9, 17)).padStart(2, '0')}:${String(randInt(0, 59)).padStart(2, '0')}:00`,
    folder_id: opts.folderId ?? null
  });
  return id;
}

// 학생별 기본 기록 2~4건 (상태 점수는 점차 호전되는 경향)
for (let idx = 0; idx < students.length; idx++) {
  const count = randInt(2, 4);
  let base = randInt(1, 3);
  for (let i = 0; i < count; i++) {
    const daysAgo = Math.max(2, 110 - i * randInt(15, 30));
    base = Math.min(5, base + (rnd() < 0.6 ? 1 : 0));
    addRecord(idx + 1, pick(Object.keys(CONTENT_BY_TYPE)), daysAgo, {
      stateScore: base,
      folderId: idx % 7 === 0 ? 2 : null
    });
  }
}

// 관계 기록 (교우관계 노드·엣지 데모)
for (const [fromNo, toNo, score, daysAgo] of RELATION_ENTRIES) {
  const recordId = addRecord(fromNo, '교우관계', daysAgo, {
    content: `${STUDENT_NAMES[toNo - 1]} 학생과의 관계 상담`,
    stateScore: score,
    folderId: score != null && score <= 2 ? 1 : null,
    reflectedInNice: 0
  });
  recordRelations.push({
    id: recordRelations.length + 1,
    record_id: recordId,
    related_type: '학생',
    related_student_id: toNo,
    related_label: null,
    relation_score: score,
    note: score == null ? '점수 미기록' : null
  });
}

// 위기감지 데모: 4번 학생 최근 14일 내 3건
for (let i = 0; i < 3; i++) {
  addRecord(4, '교우관계', i * 3, {
    content: '반복 상담 필요 - 지속 관찰 중',
    reflectedInNice: 0,
    folderId: 1
  });
}

// 조치사항 데모 (dueIn 양수=미래 마감, 음수=지난 마감)
for (const [idx, text, dueIn, done] of ACTION_SEED) {
  recordActions.push({
    id: recordActions.length + 1,
    record_id: null,
    student_id: idx + 1,
    text,
    done,
    due_date: dueIn == null ? null : dateDaysAgo(-dueIn),
    created_at: `${dateDaysAgo(Math.abs(dueIn ?? 1) + 1)} ${String(randInt(9, 17)).padStart(2, '0')}:00:00`,
    done_date: done ? dateDaysAgo(randInt(1, 4)) : null,
    done_note: done ? '처리 완료' : null,
    repeat_days: null
  });
}

// 예약 데모 2건 (오늘 이후)
appointments.push({
  id: 1,
  student_id: 1,
  appt_date: futureDateWithinDays(2),
  start_time: '09:00',
  end_time: '09:30',
  note: '교우관계 후속 상담',
  record_id: null,
  created_at: TODAY_STAMP
});
appointments.push({
  id: 2,
  student_id: 4,
  appt_date: futureDateWithinDays(3),
  start_time: '13:00',
  end_time: '13:40',
  note: '위기 학생 정기 상담',
  record_id: null,
  created_at: TODAY_STAMP
});

const payload = {
  students,
  consult_types: TYPES,
  quick_templates: TEMPLATES.map(([type_id, text], i) => ({ id: i + 1, type_id, text })),
  consult_records: consultRecords,
  record_folders: recordFolders,
  record_actions: recordActions,
  record_relations: recordRelations,
  appointments,
  // settings는 앱의 JSON 가져오기가 무시하는 참고용 값(백업 형식 호환을 위해 포함)
  settings: [
    { key: 'crisis_threshold_days', value: '14' },
    { key: 'crisis_threshold_count', value: '3' }
  ],
  __meta: [
    {
      app: 'counseling-tracker',
      version: 1,
      kind: 'demo-sample',
      note: '가상 학생 예시 데이터 (1학년 2반 30명). 앱 [설정 > 데이터 > JSON 가져오기]로 불러올 수 있습니다.',
      basis_date: dateDaysAgo(0),
      exported_at: new Date().toISOString()
    }
  ]
};

// (파일 쓰기는 아래 검증을 통과한 뒤에만 수행한다)

// ---------- 자체 검증: 앱의 importAllJson 과 같은 방식으로 실제 DB에 넣어본다 ----------
const TABLE_ORDER = [
  'students',
  'consult_types',
  'quick_templates',
  'consult_records',
  'record_folders',
  'record_actions',
  'record_relations',
  'appointments'
];

const initSqlJs = require('sql.js');
const SQL = await initSqlJs({ locateFile: () => require.resolve('sql.js/dist/sql-wasm.wasm') });
const db = new SQL.Database();
db.run(DDL);

let imported = 0;
db.run('BEGIN TRANSACTION');
for (const table of TABLE_ORDER) {
  for (const row of payload[table]) {
    const cols = Object.keys(row);
    const stmt = `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
    db.run(stmt, cols.map((c) => (row[c] === undefined ? null : row[c])));
    imported++;
  }
}
db.run('COMMIT');

const scalar = (sql, params = []) => db.exec(sql, params)[0].values[0][0];
const errors = [];

// 1) 외래키 정합성
if (scalar('SELECT COUNT(*) FROM consult_records r LEFT JOIN students s ON s.id = r.student_id WHERE s.id IS NULL') > 0)
  errors.push('상담 기록에 존재하지 않는 학생 id 참조');
if (scalar('SELECT COUNT(*) FROM consult_records r LEFT JOIN consult_types t ON t.id = r.type_id WHERE t.id IS NULL') > 0)
  errors.push('상담 기록에 존재하지 않는 유형 id 참조');
if (scalar('SELECT COUNT(*) FROM consult_records WHERE folder_id IS NOT NULL AND folder_id NOT IN (SELECT id FROM record_folders)') > 0)
  errors.push('상담 기록에 존재하지 않는 폴더 참조');
if (scalar('SELECT COUNT(*) FROM record_relations WHERE related_student_id NOT IN (SELECT id FROM students)') > 0)
  errors.push('관계 기록에 존재하지 않는 학생 참조');
if (scalar('SELECT COUNT(*) FROM record_actions WHERE student_id NOT IN (SELECT id FROM students)') > 0)
  errors.push('조치사항에 존재하지 않는 학생 참조');
if (scalar('SELECT COUNT(*) FROM appointments WHERE student_id NOT IN (SELECT id FROM students)') > 0)
  errors.push('예약에 존재하지 않는 학생 참조');

// 2) 앱의 위기감지 쿼리와 동일 로직 (최근 14일 3건 이상)
const crisis = db.exec(
  `SELECT s.name, COUNT(*) c FROM consult_records r JOIN students s ON s.id = r.student_id
   WHERE r.record_date >= date('now', '-14 days') GROUP BY r.student_id HAVING c >= 3`
);
const crisisRows = crisis.length ? crisis[0].values : [];

// 3) 기대 건수 확인
const counts = Object.fromEntries(TABLE_ORDER.map((t) => [t, scalar(`SELECT COUNT(*) FROM ${t}`)]));
if (counts.students !== 30) errors.push(`학생 수 ${counts.students} (30 기대)`);
if (counts.record_relations !== RELATION_ENTRIES.length)
  errors.push(`관계 엣지 ${counts.record_relations} (${RELATION_ENTRIES.length} 기대)`);
if (counts.record_actions !== ACTION_SEED.length) errors.push(`조치사항 ${counts.record_actions}`);
if (counts.appointments !== 2) errors.push(`예약 ${counts.appointments}`);

// 4) 시연 화면 필수 요소
if (counts.consult_records < 60) errors.push(`상담 기록 ${counts.consult_records} (60건 이상 기대)`);
if (crisisRows.length < 1) errors.push('위기감지 알림 대상이 없음');
if (scalar(`SELECT COUNT(*) FROM consult_records WHERE state_score IS NOT NULL`) < 10)
  errors.push('상태 점수 데이터 부족(통계 그래프 확인 불가)');
const scoreSpread = scalar('SELECT COUNT(DISTINCT relation_score) FROM record_relations WHERE relation_score IS NOT NULL');
if (scoreSpread < 4) errors.push(`관계 점수 분포 ${scoreSpread}종 (4종 이상 기대)`);

console.log(`검증: ${imported}행 삽입`);
console.log('테이블별 건수:', JSON.stringify(counts, null, 0));
console.log('위기감지 대상:', JSON.stringify(crisisRows.map((r) => ({ name: r[0], count: r[1] }))));
if (errors.length) {
  console.error('검증 실패:\n- ' + errors.join('\n- '));
  process.exit(1);
}
fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2), 'utf-8');
console.log(`생성 완료: ${OUT_PATH}`);
console.log('검증 통과: 예시 데이터 JSON이 앱 가져오기 스키마와 일치합니다.');
