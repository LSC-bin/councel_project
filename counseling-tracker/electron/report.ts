import ExcelJS from 'exceljs';
import { buildAnonymMap } from '../src/utils/anonymize';
import * as db from './db/database';

export async function buildAnonymizedReport(filePath: string) {
  const stats = db.getMonthlyStats();
  const ranking = db.getStudentRanking(9999) as { student_id: number; name: string; count: number }[];
  const anonymMap = buildAnonymMap(ranking.map((r) => r.name));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = '상담기록관리';
  workbook.created = new Date();

  const rankingSheet = workbook.addWorksheet('학생별 순위(익명화)');
  rankingSheet.columns = [
    { header: '순위', key: 'rank', width: 8 },
    { header: '익명 학생명', key: 'name', width: 16 },
    { header: '총 상담 건수', key: 'count', width: 14 }
  ];
  ranking.forEach((r, i) => {
    rankingSheet.addRow({ rank: i + 1, name: anonymMap.get(r.name) ?? `?학생`, count: r.count });
  });

  const typeSheet = workbook.addWorksheet('유형별 분포');
  typeSheet.columns = [
    { header: '상담 유형', key: 'type', width: 16 },
    { header: '건수', key: 'count', width: 10 }
  ];
  (stats.byType as { type_name: string; count: number }[]).forEach((t) => {
    typeSheet.addRow({ type: t.type_name, count: t.count });
  });

  const monthlySheet = workbook.addWorksheet('월별 추이');
  monthlySheet.columns = [
    { header: '월', key: 'month', width: 12 },
    { header: '건수', key: 'count', width: 10 }
  ];
  (stats.monthly as { month: string; count: number }[]).forEach((m) => {
    monthlySheet.addRow({ month: m.month, count: m.count });
  });

  const classSheet = workbook.addWorksheet('반별 요약');
  classSheet.columns = [
    { header: '학년', key: 'grade', width: 8 },
    { header: '반', key: 'class_no', width: 8 },
    { header: '기록 건수', key: 'record_count', width: 12 },
    { header: '상담 학생 수', key: 'student_count', width: 14 },
    { header: '최다 유형', key: 'top_type', width: 18 }
  ];
  (db.getClassSummary() as { grade: number; class_no: number; record_count: number; student_count: number; top_type: string }[]).forEach(
    (c) => {
      classSheet.addRow({ grade: c.grade, class_no: c.class_no, record_count: c.record_count, student_count: c.student_count, top_type: c.top_type });
    }
  );

  for (const sheet of workbook.worksheets) {
    sheet.getRow(1).font = { bold: true };
  }

  await workbook.xlsx.writeFile(filePath);
}

// ---------- 상담 실적 보고서 (학교 보고·나이스 첨부 양식) ----------
// 월별 실적 / 유형별 / 학년·반별 / 기록 상세 4개 시트. 개인정보가 포함된 내부 보고용이다.
export async function buildNiceStyleReport(filePath: string, opts: { startDate?: string; endDate?: string }) {
  const records = db.getRecords({
    startDate: opts.startDate || undefined,
    endDate: opts.endDate || undefined,
    sortBy: 'date',
    order: 'asc'
  }) as Record<string, any>[];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = '상담기록관리';
  workbook.created = new Date();

  // 1) 월별 실적
  const monthly = new Map<string, { count: number; students: Set<number>; followPending: number; followDone: number }>();
  for (const r of records) {
    const m = String(r.record_date).slice(0, 7);
    const e = monthly.get(m) ?? { count: 0, students: new Set(), followPending: 0, followDone: 0 };
    e.count += 1;
    e.students.add(r.student_id);
    if (r.follow_up_needed && !r.follow_up_done) e.followPending += 1;
    if (r.follow_up_needed && r.follow_up_done) e.followDone += 1;
    monthly.set(m, e);
  }
  const s1 = workbook.addWorksheet('월별 실적');
  s1.columns = [
    { header: '월', key: 'month', width: 12 },
    { header: '상담 건수', key: 'count', width: 10 },
    { header: '상담 학생 수', key: 'students', width: 12 },
    { header: '후속조치 대기', key: 'pending', width: 14 },
    { header: '후속조치 완료', key: 'done', width: 14 }
  ];
  [...monthly.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([m, e]) => {
    s1.addRow({ month: m, count: e.count, students: e.students.size, pending: e.followPending, done: e.followDone });
  });

  // 2) 유형별 실적
  const byType = new Map<string, number>();
  for (const r of records) byType.set(r.type_name ?? '미지정', (byType.get(r.type_name ?? '미지정') ?? 0) + 1);
  const s2 = workbook.addWorksheet('유형별 실적');
  s2.columns = [
    { header: '상담 유형', key: 'type', width: 16 },
    { header: '건수', key: 'count', width: 10 },
    { header: '비율(%)', key: 'pct', width: 10 }
  ];
  [...byType.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([t, c]) => s2.addRow({ type: t, count: c, pct: records.length ? Math.round((c / records.length) * 1000) / 10 : 0 }));

  // 3) 학년·반별 실적
  const byClass = new Map<string, { grade: number; classNo: number; count: number; students: Set<number> }>();
  for (const r of records) {
    const key = `${r.student_grade ?? '-'}-${r.student_class_no ?? '-'}`;
    const e = byClass.get(key) ?? { grade: r.student_grade ?? 0, classNo: r.student_class_no ?? 0, count: 0, students: new Set() };
    e.count += 1;
    e.students.add(r.student_id);
    byClass.set(key, e);
  }
  const s3 = workbook.addWorksheet('학년반별 실적');
  s3.columns = [
    { header: '학년', key: 'grade', width: 8 },
    { header: '반', key: 'class', width: 8 },
    { header: '상담 건수', key: 'count', width: 10 },
    { header: '상담 학생 수', key: 'students', width: 12 }
  ];
  [...byClass.values()]
    .sort((a, b) => a.grade - b.grade || a.classNo - b.classNo)
    .forEach((e) => s3.addRow({ grade: e.grade || '-', class: e.classNo || '-', count: e.count, students: e.students.size }));

  // 4) 기록 상세
  const s4 = workbook.addWorksheet('기록 상세');
  s4.columns = [
    { header: '상담일', key: 'date', width: 12 },
    { header: '학년', key: 'grade', width: 7 },
    { header: '반', key: 'class', width: 6 },
    { header: '번호', key: 'num', width: 6 },
    { header: '학생명', key: 'name', width: 10 },
    { header: '유형', key: 'type', width: 12 },
    { header: '상태 점수', key: 'score', width: 9 },
    { header: '후속조치', key: 'follow', width: 10 },
    { header: '유관기관 연계', key: 'ref', width: 16 },
    { header: '생기부 반영', key: 'nice', width: 10 },
    { header: '상담 내용', key: 'content', width: 60 }
  ];
  for (const r of records) {
    s4.addRow({
      date: r.record_date,
      grade: r.student_grade ?? '-',
      class: r.student_class_no ?? '-',
      num: r.student_number ?? '-',
      name: r.student_name,
      type: r.type_name ?? '-',
      score: r.state_score ?? '-',
      follow: !r.follow_up_needed ? '-' : r.follow_up_done ? '완료' : '대기',
      ref: r.referred_to || '-',
      nice: r.reflected_in_nice ? '완료' : '미반영',
      content: r.content ?? ''
    });
  }

  for (const sheet of workbook.worksheets) {
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
  }

  await workbook.xlsx.writeFile(filePath);
  return { count: records.length };
}

// ---------- 기록 1건 인쇄용 HTML (A4) ----------
function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildRecordPrintHtml(
  record: Record<string, any>,
  relations: Record<string, any>[],
  actions: Record<string, any>[]
): string {
  const rows = (label: string, value: string) => `<tr><th>${label}</th><td>${value}</td></tr>`;
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>학생 상담 기록</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; font-size: 11pt; color: #1f2a37; margin: 0; }
  h1 { font-size: 16pt; text-align: center; margin: 0 0 4mm; letter-spacing: 1px; }
  .sub { text-align: center; font-size: 9pt; color: #5b6b7c; margin-bottom: 6mm; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4mm; }
  th, td { border: 1px solid #8a97a5; padding: 2mm 3mm; font-size: 10pt; text-align: left; vertical-align: top; }
  th { background: #eef2f7; width: 26mm; font-weight: 700; white-space: nowrap; }
  .content { min-height: 60mm; white-space: pre-wrap; line-height: 1.7; }
  h2 { font-size: 11pt; margin: 5mm 0 2mm; border-bottom: 1.5px solid #1f2a37; padding-bottom: 1mm; }
  .footer { margin-top: 8mm; font-size: 8.5pt; color: #5b6b7c; display: flex; justify-content: space-between; }
  ul { margin: 0; padding-left: 5mm; }
  li { margin-bottom: 1mm; }
</style>
</head>
<body>
  <h1>학 생 상 담 기 록</h1>
  <div class="sub">본 기록은 개인정보보호법에 따라 보호되며 열람·보관에 유의하여야 합니다.</div>
  <table>
    ${rows('학생명', `${esc(record.student_name)}${record.student_grade != null ? ` (${esc(record.student_grade)}학년 ${esc(record.student_class_no)}반 ${esc(record.student_number)}번)` : ''}`)}
    ${rows('상담일', esc(record.record_date))}
    ${rows('상담 유형', esc(record.type_name))}
    ${rows('상태 점수', record.state_score != null ? `${esc(record.state_score)}점 (1=어려움 ~ 5=좋음)` : '-')}
    ${rows('후속조치', !record.follow_up_needed ? '불필요' : record.follow_up_done ? '완료' : '대기')}
    ${rows('유관기관 연계', esc(record.referred_to) || '-')}
    ${rows('생기부 반영', record.reflected_in_nice ? '완료' : '미반영')}
    ${rows('상담 폴더', esc(record.folder_name) || '미분류')}
  </table>
  <h2>상담 내용</h2>
  <table><tr><td class="content">${esc(record.content) || '(내용 없음)'}</td></tr></table>
  ${
    relations.length > 0
      ? `<h2>관련 대상</h2><table>${relations
          .map((r) =>
            rows(
              esc(r.related_type),
              `${esc(r.related_student_name ?? r.related_label)}${r.relation_score != null ? ` · 관계 점수 ${esc(r.relation_score)}점` : ''}${r.note ? ` · ${esc(r.note)}` : ''}`
            )
          )
          .join('')}</table>`
      : ''
  }
  ${
    actions.length > 0
      ? `<h2>조치사항</h2><ul>${actions
          .map(
            (a) =>
              `<li>${a.done ? '[완료]' : '[대기]'} ${esc(a.text)}${a.due_date ? ` (마감 ${esc(a.due_date)}${a.done ? '' : ''})` : ''}${a.done_date ? ` · 완료 ${esc(a.done_date)}` : ''}</li>`
          )
          .join('')}</ul>`
      : ''
  }
  <div class="footer">
    <span>작성 ${esc(String(record.created_at ?? '').slice(0, 16).replace('T', ' '))}</span>
    <span>출력 ${new Date().toLocaleString('ko-KR')} · 상담기록관리</span>
  </div>
</body>
</html>`;
}
