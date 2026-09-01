# 학생 상담기록 관리 프로그램 — VS Code 제작 가이드

> 기능 명세와 각 기능의 목적·로직은 `상담기록관리_프로그램_기획서.md` 5장 참고. 이 문서는 그 명세를 실제 코드로 옮기기 위한 실행 절차와 화면별 구현 지시사항.

---

## 1. 개발 환경 준비

- Node.js LTS(18 이상): `node -v`
- Git 저장소 초기화 (기능 단위 커밋 권장)
- VS Code 확장: ESLint, Prettier, SQLite Viewer, GitLens, Claude Code 확장

---

## 2. 프로젝트 초기화

```bash
npm create @quick-start/electron@latest counseling-tracker -- --template react-ts
cd counseling-tracker
npm install
npm install better-sqlite3 xlsx chart.js react-chartjs-2 exceljs react-router-dom
npm install -D electron-builder @types/better-sqlite3
```

---

## 3. 폴더 구조

```
counseling-tracker/
├── electron/
│   ├── main.ts                # 앱 생명주기, 알림(기능⑬), IPC 핸들러 등록
│   ├── preload.ts             # contextBridge로 API 노출
│   └── db/
│       ├── database.ts        # DB 연결, CRUD, 위기감지(①) 쿼리
│       ├── backup.ts          # 암호화 백업/복원 (기능⑨)
│       └── schema.sql
├── src/
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── RecordInput.tsx
│   │   ├── SearchView.tsx
│   │   ├── Statistics.tsx
│   │   ├── ReportExport.tsx
│   │   └── Settings.tsx
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   ├── MetricCard.tsx
│   │   ├── RecordTable.tsx
│   │   ├── CrisisBanner.tsx        # 기능①
│   │   ├── QuickTemplateButtons.tsx # 기능③
│   │   ├── StateScoreChart.tsx      # 기능⑥
│   │   ├── BriefingCard.tsx         # 기능⑫
│   │   ├── CalendarView.tsx         # 기능⑧
│   │   ├── HandoverSummary.tsx      # 기능⑤ (인쇄 전용)
│   │   └── PrintableRecord.tsx      # 기능⑭ (인쇄 전용)
│   ├── utils/
│   │   └── anonymize.ts             # 기능②
│   ├── hooks/
│   │   └── useRecords.ts
│   ├── App.tsx
│   └── main.tsx
├── build/
├── electron-builder.yml
└── package.json
```

---

## 4. 렌더러 ↔ 메인 프로세스 통신 (IPC 채널 전체 목록)

`preload.ts`에서 아래 채널을 `window.api`로 노출하고, `main.ts`에서 각각 `ipcMain.handle`로 구현합니다.

```ts
// electron/preload.ts
contextBridge.exposeInMainWorld('api', {
  // 학생
  importStudents: (filePath: string) => ipcRenderer.invoke('students:import', filePath),
  togglePin: (studentId: number) => ipcRenderer.invoke('students:togglePin', studentId),
  archiveCurrentYear: (yearLabel: string) => ipcRenderer.invoke('students:archiveYear', yearLabel),

  // 상담 기록
  getRecords: (filter: RecordFilter) => ipcRenderer.invoke('records:get', filter),
  addRecord: (record: NewRecord) => ipcRenderer.invoke('records:add', record),
  updateRecord: (id: number, patch: Partial<NewRecord>) => ipcRenderer.invoke('records:update', id, patch),
  deleteRecord: (id: number) => ipcRenderer.invoke('records:delete', id),

  // 통계/위기감지
  getMonthlyStats: () => ipcRenderer.invoke('stats:monthly'),
  getCrisisAlerts: () => ipcRenderer.invoke('stats:crisisAlerts'),   // 기능①

  // 유형/템플릿
  getConsultTypes: () => ipcRenderer.invoke('types:get'),
  getQuickTemplates: (typeId: number) => ipcRenderer.invoke('templates:get', typeId),

  // 보고서/백업
  exportReport: (range: DateRange) => ipcRenderer.invoke('report:export', range),
  exportAnonymized: (range: DateRange) => ipcRenderer.invoke('report:exportAnonymized', range), // 기능②
  createBackup: (password: string, savePath: string) => ipcRenderer.invoke('backup:create', password, savePath), // 기능⑨
  restoreBackup: (password: string, filePath: string) => ipcRenderer.invoke('backup:restore', password, filePath),

  // 설정
  getSetting: (key: string) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
});
```

---

## 5. 화면별 구현 지시사항

### 5-1. Dashboard.tsx
1. 마운트 시 `Promise.all`로 `getMonthlyStats()`, `getCrisisAlerts()`, `getRecords({limit:10, order:'desc'})` 병렬 호출
2. `MetricCard` 3개를 grid로 배치(이번달 건수/후속조치 대기/등록 학생 수)
3. `getCrisisAlerts()` 결과가 있으면 `CrisisBanner` 렌더링, 클릭 시 `navigate('/search', {state:{studentId}})`
4. 즐겨찾기 학생(`students.pinned=1`)을 상단 가로 스크롤 아바타 목록으로 표시
5. 최근 기록은 `RecordTable`을 `compact` 모드로 재사용

### 5-2. RecordInput.tsx
1. 학생 검색: `<input>` onChange 시 `useDeferredValue`로 debounce, 로컬에 캐시해둔 학생 목록에서 `includes` 필터(별도 IPC 호출 불필요, 학생 수가 적으므로)
2. 유형 선택 변경 시 `getQuickTemplates(typeId)` 호출 → `QuickTemplateButtons`에 전달
3. `QuickTemplateButtons`의 버튼 클릭 핸들러는 textarea의 현재 커서 위치에 텍스트를 삽입(`selectionStart` 활용), 단순 append가 아니라 커서 위치 삽입으로 구현
4. 상태 점수 선택 시, 선택된 학생의 최근 기록 1건을 조회해 "직전 점수: N" 텍스트를 옆에 표시(시각적 대비용)
5. 후속조치 체크 시 `next_appointment` date picker를 조건부 렌더링(react state로 토글)
6. 저장 버튼 클릭 → 필수값(학생, 날짜, 유형) 검증 → `addRecord()` → 성공 토스트 → 폼 초기화

### 5-3. SearchView.tsx
1. 필터바 상태(`studentQuery`, `dateRange`, `selectedTypes`)를 하나의 `useReducer`로 관리
2. 필터 변경 시 `getRecords(filter)` 재호출(디바운스 300ms)
3. 결과 테이블 행 클릭 → 우측 슬라이드 패널에 상세 표시, 상세 패널 상단에 `BriefingCard`(기능⑫) 배치
4. 학생 선택 상태일 때 `StateScoreChart`(기능⑥)를 상세 패널 하단에 렌더링 — `react-chartjs-2`의 `Line`, x축은 `record_date`, y축은 `state_score`
5. 수정/삭제 버튼은 `updateRecord`/`deleteRecord` 호출 후 목록 재조회

### 5-4. Statistics.tsx
1. `getMonthlyStats()`로 받은 데이터를 `Bar`(월별)와 `Doughnut`(유형별) 두 차트로 렌더링
2. 학생별 랭킹은 별도 IPC(`stats:studentRanking`) 추가 필요 — `GROUP BY student_id ORDER BY COUNT(*) DESC LIMIT 10`
3. "익명화 내보내기" 버튼 → `exportAnonymized(range)` 호출. 실제 익명화 매핑 로직은 `src/utils/anonymize.ts`에서 순수 함수로 구현해 단위 테스트 가능하게 분리

```ts
// src/utils/anonymize.ts
export function buildAnonymMap(studentNames: string[]): Map<string, string> {
  const map = new Map<string, string>();
  studentNames.forEach((name, i) => {
    const label = i < 26 ? String.fromCharCode(65 + i) : `A${i - 25}`;
    map.set(name, `${label}학생`);
  });
  return map;
}
```

### 5-5. ReportExport.tsx
1. 기간 선택 후 "보고서 생성" → `exportReport(range)` (메인 프로세스에서 `exceljs`로 시트 3개 구성: 요약/유형별 통계/상세 목록)
2. 인수인계 요약카드: 학생 선택 → `HandoverSummary` 컴포넌트를 별도 인쇄 전용 라우트(`/print/handover/:studentId`)로 렌더링 후 `window.print()` 또는 Electron `printToPDF`
3. 표준 인쇄 서식(기능⑭)도 동일한 패턴 — `/print/record/:recordId` 라우트 + `@media print` CSS로 화면 UI 요소 숨김
4. 백업: 비밀번호 2회 입력(생성 시) → `createBackup(password, savePath)`, 복원은 파일 다이얼로그(`electron.dialog.showOpenDialog`) 후 `restoreBackup`

### 5-6. Settings.tsx
1. 상담 유형 CRUD 테이블 (색상은 `<input type="color">`)
2. 빠른 입력 템플릿 CRUD (유형별 그룹)
3. 앱 비밀번호 변경 (기존 비밀번호 확인 후 변경)
4. 생기부 마감일 date picker → `setSetting('nice_deadline_date', value)`
5. "새 학년도 시작" 버튼 → 확인 모달(되돌릴 수 없음을 명시) → `archiveCurrentYear(yearLabel)` → 완료 후 명부 업로드 화면으로 `navigate`

---

## 6. 메인 프로세스 핵심 구현 메모

### 6-1. 위기 감지 쿼리 (기능①)
```sql
SELECT student_id, COUNT(*) as cnt
FROM consult_records
WHERE record_date >= date('now', '-14 days')
GROUP BY student_id
HAVING cnt >= 3;
```
앱 시작 시, 그리고 `records:add` 성공 직후에 이 쿼리를 재실행해 결과를 렌더러에 push(간단하게는 렌더러가 대시보드 마운트 시마다 재조회해도 충분).

### 6-2. 데스크탑 알림 (기능⑬)
```ts
// electron/main.ts
function checkReminders() {
  const dueFollowUps = db.getOverdueFollowUps(); // 7일 경과 & 미완료
  const upcoming = db.getUpcomingAppointments();  // 오늘/내일
  [...dueFollowUps, ...upcoming].forEach(item => {
    new Notification({ title: '상담기록관리', body: item.message }).show();
  });
}
app.whenReady().then(() => {
  checkReminders();
  setInterval(checkReminders, 1000 * 60 * 60); // 1시간마다
});
```

### 6-3. 암호화 백업 (기능⑨)
```ts
// electron/db/backup.ts
import { scryptSync, randomBytes, createCipheriv, createDecipheriv } from 'crypto';

export function createBackup(password: string, dbFilePath: string, savePath: string) {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const dbBuffer = fs.readFileSync(dbFilePath);
  const encrypted = Buffer.concat([cipher.update(dbBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // salt + iv + authTag + encrypted 순서로 하나의 파일에 이어붙여 저장
  fs.writeFileSync(savePath, Buffer.concat([salt, iv, authTag, encrypted]));
}
```
복원은 동일한 순서로 salt/iv/authTag를 분리해 `createDecipheriv`로 역과정 수행.

---

## 7. 빌드 및 배포 설정

```yaml
# electron-builder.yml
appId: com.example.counseling-tracker
productName: 상담기록관리
win:
  target: portable
  icon: build/icon.ico
files:
  - dist/**/*
  - electron/**/*
```

```bash
npm run build
```

`dist/` 하위에 단일 `.exe`가 생성되며, 이 파일이 대회 제출용 실행파일이 됩니다.

---

## 8. 구현 순서 요약 (착수 체크리스트)

1. 스캐폴딩 실행 확인 (`npm run dev`)
2. `schema.sql` 적용 + `database.ts` 연결 확인
3. IPC 채널 전체(4장 목록) 스텁 구현 → 하나씩 실제 로직 채우기
4. Sidebar + 라우팅으로 화면 뼈대 구성
5. 엑셀 명부 업로드 (`students:import`)
6. RecordInput 구현 (기능③ 포함)
7. SearchView 구현 (기능⑥⑦⑧⑫ 포함)
8. Statistics 구현 (기능②)
9. ReportExport 구현 (기능⑤⑨⑭)
10. Settings 구현 (기능④⑪)
11. main.ts에 알림(기능⑬), 위기감지(기능①) 로직 연결
12. 앱 잠금(비밀번호) 마지막에 추가
13. `electron-builder`로 portable exe 빌드 및 타 PC 구동 테스트

---

## 9. 개발 진행 팁

- 커밋 단위를 기능 하나당 1개로 쪼개면 프로그램 설명서 작성 및 확장성 점수에 유리
- `.gitignore`에 `node_modules/`, `dist/`, 실제 테스트용 `*.db` 파일 반드시 제외
- 개발 중에도 가상 이름(홍길동, 김철수 등)만 사용 — 실수로 실제 데이터가 스크린샷/커밋에 남는 것 방지
