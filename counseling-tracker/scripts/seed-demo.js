// 시연/개발용 예시 데이터 생성 스크립트.
// 실제 학생이 아닌 가상 이름만 사용합니다 (대회 제출 규정 준수).
// 실행: npm run seed:demo  (electron 런타임으로 실행되어 app.getPath('userData')를 정확히 찾음)
const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const initSqlJs = require('sql.js');

// electron scripts/seed-demo.js 로 직접 실행하면 package.json의 productName을 못 읽어
// userData 경로가 'Electron'으로 잡히므로, 실제 앱과 동일한 이름을 명시적으로 지정한다.
const pkg = require('../package.json');
app.setName(pkg.productName || pkg.name);

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

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}
function randomDateWithinDays(daysBack) {
  const d = new Date();
  d.setDate(d.getDate() - randInt(0, daysBack));
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
  const dbPath = path.join(userDataPath, 'counseling.sqlite');
  if (!fs.existsSync(dbPath)) {
    console.error('DB 파일이 없습니다. 앱을 한 번 이상 실행한 뒤 다시 시도하세요:', dbPath);
    app.exit(1);
    return;
  }

  const db = new SQL.Database(fs.readFileSync(dbPath));

  // 기존 학생/기록만 정리(기록 유형·템플릿·설정·비밀번호는 유지)
  db.run('DELETE FROM consult_records');
  db.run('DELETE FROM students');

  const typeRows = db.exec('SELECT id, name FROM consult_types');
  const types = typeRows.length ? typeRows[0].values.map((v) => ({ id: v[0], name: v[1] })) : [];
  if (types.length === 0) {
    console.error('기록 유형이 없습니다. 앱을 먼저 실행해 기본 유형을 생성한 뒤 다시 시도하세요.');
    app.exit(1);
    return;
  }

  const studentIds = [];
  STUDENT_NAMES.forEach((name, i) => {
    const grade = Math.floor(i / 10) + 1; // 1~3학년, 10명씩
    const classNo = randInt(1, 4);
    const number = (i % 10) + 1;
    const pinned = i < 3 ? 1 : 0; // 앞 3명은 즐겨찾기 데모용
    db.run(
      'INSERT INTO students (name, school_year, grade, class_no, number, pinned, active) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [name, '2026', grade, classNo, number, pinned]
    );
    const idRow = db.exec('SELECT last_insert_rowid() as id');
    studentIds.push(idRow[0].values[0][0]);
  });

  let totalRecords = 0;
  studentIds.forEach((studentId) => {
    const recordCount = randInt(1, 7); // 평균 약 4회
    for (let i = 0; i < recordCount; i++) {
      const type = pick(types);
      const contentPool = CONTENT_BY_TYPE[type.name] ?? DEFAULT_CONTENT;
      const content = pick(contentPool);
      const stateScore = Math.random() < 0.7 ? randInt(1, 5) : null;
      const followUpNeeded = Math.random() < 0.3 ? 1 : 0;
      const followUpDone = followUpNeeded && Math.random() < 0.5 ? 1 : 0;
      const nextAppointment = Math.random() < 0.15 ? futureDateWithinDays(14) : null;
      const referredTo = Math.random() < 0.15 ? pick(REFERRAL_OPTIONS) : '';
      const reflectedInNice = Math.random() < 0.6 ? 1 : 0;
      const recordDate = randomDateWithinDays(120);

      db.run(
        `INSERT INTO consult_records
          (student_id, type_id, record_date, content, state_score, follow_up_needed, follow_up_done, next_appointment, referred_to, reflected_in_nice)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [studentId, type.id, recordDate, content, stateScore, followUpNeeded, followUpDone, nextAppointment, referredTo, reflectedInNice]
      );
      totalRecords++;
    }
  });

  // 위기감지 데모용: 한 명은 최근 14일 내 3건 이상으로 몰아서 배너가 뜨도록 보정
  const crisisStudent = studentIds[3];
  const crisisType = types[0];
  for (let i = 0; i < 3; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i * 3);
    db.run(
      `INSERT INTO consult_records (student_id, type_id, record_date, content, reflected_in_nice) VALUES (?, ?, ?, ?, 0)`,
      [crisisStudent, crisisType.id, d.toISOString().slice(0, 10), '반복 상담 필요 - 지속 관찰 중']
    );
    totalRecords++;
  }

  fs.writeFileSync(dbPath, Buffer.from(db.export()));
  console.log(`완료: 학생 ${studentIds.length}명, 상담 기록 ${totalRecords}건 (평균 ${(totalRecords / studentIds.length).toFixed(1)}회/인) 생성`);
  app.exit(0);
});
