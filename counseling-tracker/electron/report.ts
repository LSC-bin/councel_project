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

  for (const sheet of workbook.worksheets) {
    sheet.getRow(1).font = { bold: true };
  }

  await workbook.xlsx.writeFile(filePath);
}
