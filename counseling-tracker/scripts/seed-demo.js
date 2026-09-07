// 시연/개발용 예시 데이터 생성 스크립트.
// 실제 학생이 아닌 가상 이름만 사용합니다 (대회 제출 규정 준수).
// 실행: npm run seed:demo  (electron 런타임으로 실행되어 app.getPath('userData')를 정확히 찾음)
//
// DB는 AES-256-GCM으로 암호화되어 저장되므로(electron/db/crypto.ts와 동일 형식),
// 이 스크립트도 db.key로 복호화 → 수정 → 재암호화 과정을 거친다.
const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const initSqlJs = require('sql.js');

const pkg = require('../package.json');
app.setName(pkg.productName || pkg.name);

const MAGIC = Buffer.from('CSELDB1\n', 'ascii');

// 1학년 2반 30명 (가상 이름)
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
const DEFAULT_CONTENT = ['개별 상담 진행'];
const REFERRAL_OPTIONS = ['Wee클래스', '학폭담당', '보건교사', '학부모', '기타'];

// 관계 데모: [기록 주체 번호(1-based), 상대 번호, 점수(1~5 또는 null), 며칠 전]
// 점수 분포를 1~5 전체에 걸쳐 넣어 엣지 색(빨강→초록)이 다양하게 보이도록 한다.
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

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}
function dateDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function futureDateWithinDays(daysForward) {
  const d = new Date();
  d.setDate(d.getDate() + randInt(1, daysForward));
  return d.toISOString().slice(0, 10);
}

app.whenReady().then(async () => {
  const SQL = await initSqlJs({ locateFile: () => require.resolve('sql.js/dist/sql-wasm.wasm') });
  const userDataPath = app.getPath('userData');
  const encPath = path.join(userDataPath, 'counseling.db.enc');
  const keyPath = path.join(userDataPath, 'db.key');
  if (!fs.existsSync(encPath) || !fs.existsSync(keyPath)) {
    console.error('암호화 DB가 없습니다. 앱을 한 번 이상 실행한 뒤 다시 시도하세요:', encPath);
    app.exit(1);
    return;
  }

  const key = fs.readFileSync(keyPath);
  const blob = fs.readFileSync(encPath);
  const iv = blob.subarray(8, 20);
  const tag = blob.subarray(20, 36);
  const ct = blob.subarray(36);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ct), decipher.final()]);

  const db = new SQL.Database(plain);

  // 기존 데모 데이터만 정리(유형·템플릿·설정·비밀번호는 유지)
  db.run('DELETE FROM record_relations');
  db.run('DELETE FROM record_actions');
  db.run('DELETE FROM consult_records');
  db.run('DELETE FROM record_folders');
  db.run('DELETE FROM appointments');
  db.run('DELETE FROM students');

  const typeRows = db.exec('SELECT id, name FROM consult_types');
  const types = typeRows.length ? typeRows[0].values.map((v) => ({ id: v[0], name: v[1] })) : [];
  if (types.length === 0) {
    console.error('기록 유형이 없습니다. 앱을 먼저 실행해 기본 유형을 생성한 뒤 다시 시도하세요.');
    app.exit(1);
    return;
  }
  const typeByName = (name) => types.find((t) => t.name === name) ?? types[0];
  const lastId = () => db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];

  // 폴더 2종
  db.run('INSERT INTO record_folders (name) VALUES (?)', ['위기학생 관리']);
  const folderCrisis = lastId();
  db.run('INSERT INTO record_folders (name) VALUES (?)', ['학급 적응 지원']);
  const folderAdapt = lastId();

  // 학생 30명 — 전부 2026학년도 1학년 2반, 번호 1~30
  const studentIds = [];
  STUDENT_NAMES.forEach((name, i) => {
    const pinned = i < 3 ? 1 : 0;
    db.run(
      'INSERT INTO students (name, school_year, grade, class_no, number, pinned, active) VALUES (?, ?, 1, 2, ?, ?, 1)',
      [name, '2026', i + 1, pinned]
    );
    studentIds.push(lastId());
  });

  let totalRecords = 0;
  function addRecord(studentIdx, typeName, daysAgo, opts = {}) {
    const type = typeByName(typeName);
    const contentPool = CONTENT_BY_TYPE[typeName] ?? DEFAULT_CONTENT;
    db.run(
      `INSERT INTO consult_records
        (student_id, type_id, record_date, content, state_score, follow_up_needed, follow_up_done, referred_to, reflected_in_nice, folder_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        studentIds[studentIdx],
        type.id,
        dateDaysAgo(daysAgo),
        opts.content ?? pick(contentPool),
        opts.stateScore ?? (Math.random() < 0.75 ? randInt(1, 5) : null),
        opts.followUpNeeded ? 1 : 0,
        opts.followUpDone ? 1 : 0,
        opts.referredTo ?? '',
        opts.reflectedInNice == null ? (Math.random() < 0.6 ? 1 : 0) : opts.reflectedInNice ? 1 : 0,
        opts.folderId ?? null
      ]
    );
    totalRecords++;
    return lastId();
  }

  // 학생별 기본 기록 2~4건 (상태 점수는 점차 호전되는 경향으로)
  studentIds.forEach((_, idx) => {
    const count = randInt(2, 4);
    let base = randInt(1, 3);
    for (let i = 0; i < count; i++) {
      const daysAgo = 110 - i * randInt(15, 30);
      base = Math.min(5, base + (Math.random() < 0.6 ? 1 : 0));
      addRecord(idx, pick(Object.keys(CONTENT_BY_TYPE)), Math.max(2, daysAgo), {
        stateScore: base,
        folderId: idx % 7 === 0 ? folderAdapt : null
      });
    }
  });

  // 관계 기록: 항목마다 주체 학생의 교우관계 기록 + record_relations 행
  for (const [fromNo, toNo, score, daysAgo] of RELATION_ENTRIES) {
    const fromIdx = fromNo - 1;
    const toIdx = toNo - 1;
    const recordId = addRecord(fromIdx, '교우관계', daysAgo, {
      content: `${STUDENT_NAMES[toIdx]} 학생과의 관계 상담`,
      stateScore: score,
      folderId: score != null && score <= 2 ? folderCrisis : null,
      reflectedInNice: false
    });
    db.run(
      'INSERT INTO record_relations (record_id, related_type, related_student_id, relation_score, note) VALUES (?, ?, ?, ?, ?)',
      [recordId, '학생', studentIds[toIdx], score, score == null ? '점수 미기록' : null]
    );
  }

  // 위기감지 데모: 4번 학생 최근 14일 내 3건
  for (let i = 0; i < 3; i++) {
    addRecord(3, '교우관계', i * 3, { content: '반복 상담 필요 - 지속 관찰 중', reflectedInNice: 0, folderId: folderCrisis });
  }

  // 조치사항 데모
  const actionSeed = [
    [0, '보호자 전화 상담 진행', 3, 0],
    [1, 'Wee클래스 연계 결과 확인', -2, 0], // 마감 지남
    [4, '짝 변경 후 적응 관찰', 7, 0],
    [7, '칭찬 스티커 부여', null, 1],
    [11, '보호자 면담 일정 조율', 5, 0],
    [19, '방과후 프로그램 신청 안내', null, 1]
  ];
  for (const [idx, text, dueIn, done] of actionSeed) {
    db.run(
      'INSERT INTO record_actions (record_id, student_id, text, done, due_date) VALUES (NULL, ?, ?, ?, ?)',
      [
        studentIds[idx],
        text,
        done,
        dueIn == null ? null : dateDaysAgo(-dueIn) // 양수=미래 마감, 음수=지난 마감
      ]
    );
  }

  // 예약 데모 2건
  db.run('INSERT INTO appointments (student_id, appt_date, start_time, end_time, note) VALUES (?, ?, ?, ?, ?)', [
    studentIds[0],
    dateDaysAgo(-1),
    '09:00',
    '09:30',
    '교우관계 후속 상담'
  ]);
  db.run('INSERT INTO appointments (student_id, appt_date, start_time, end_time, note) VALUES (?, ?, ?, ?, ?)', [
    studentIds[3],
    dateDaysAgo(-2),
    '13:00',
    '13:40',
    '위기 학생 정기 상담'
  ]);

  // 재암호화 후 원자적 쓰기
  const out = Buffer.from(db.export());
  const iv2 = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv2);
  const ct2 = Buffer.concat([cipher.update(out), cipher.final()]);
  const blob2 = Buffer.concat([MAGIC, iv2, cipher.getAuthTag(), ct2]);
  const tmp = `${encPath}.tmp`;
  fs.writeFileSync(tmp, blob2);
  fs.renameSync(tmp, encPath);

  console.log(
    `완료: 학생 ${studentIds.length}명(1학년 2반), 상담 기록 ${totalRecords}건, 관계 엣지 ${RELATION_ENTRIES.length}항목, 폴더 2개, 조치사항 ${actionSeed.length}건`
  );
  app.exit(0);
});
