import { useEffect, useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Title,
  Filler
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Tooltip, Legend, Title, Filler);

const PERIOD_OPTIONS = [
  { value: 0, label: '전체 기간' },
  { value: 30, label: '최근 30일' },
  { value: 90, label: '최근 90일' },
  { value: 180, label: '최근 6개월' },
  { value: 365, label: '최근 1년' }
];

export default function Statistics() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [ranking, setRanking] = useState<{ student_id: number; name: string; grade: number | null; class_no: number | null; number: number | null; count: number }[]>([]);
  const [heatmap, setHeatmap] = useState<ClassHeatmapCell[]>([]);
  const [trend, setTrend] = useState<TypeTrendRow[]>([]);
  const [period, setPeriod] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      window.api.getMonthlyStats(),
      window.api.getStudentRanking(10, period || undefined),
      window.api.getClassHeatmap(period || undefined),
      window.api.getTypeTrend(6)
    ])
      .then(([s, r, h, t]) => {
        setStats(s);
        setRanking(r);
        setHeatmap(h);
        setTrend(t);
      })
      .finally(() => setLoading(false));
  }, [period]);

  async function handleExport() {
    setExporting(true);
    setToast(null);
    try {
      const result = await window.api.exportAnonymizedReport();
      if (result.canceled) return;
      setToast(`저장되었습니다: ${result.filePath}`);
    } finally {
      setExporting(false);
      setTimeout(() => setToast(null), 4000);
    }
  }

  // ---------- 학년×반 히트맵 데이터 ----------
  const heat = useMemo(() => {
    const grades = Array.from(new Set(heatmap.map((c) => c.grade))).sort((a, b) => a - b);
    const classes = Array.from(new Set(heatmap.map((c) => c.class_no))).sort((a, b) => a - b);
    const countOf = new Map<string, number>();
    for (const c of heatmap) countOf.set(`${c.grade}-${c.class_no}`, c.count);
    const max = Math.max(1, ...heatmap.map((c) => c.count));
    return { grades, classes, countOf, max };
  }, [heatmap]);

  function heatColor(count: number) {
    if (count === 0) return 'var(--bg-panel)';
    // 0~max 비례로 파란색 농도
    const t = count / heat.max;
    const light = 92 - t * 52; // 92% → 40%
    return `hsl(212, 55%, ${light}%)`;
  }

  // ---------- 유형별 월 추이 데이터 ----------
  const trendData = useMemo(() => {
    const months = Array.from(new Set(trend.map((t) => t.month))).sort();
    const types = new Map<number, { name: string; color: string }>();
    for (const t of trend) types.set(t.type_id, { name: t.type_name, color: t.type_color });
    const datasets = Array.from(types.entries())
      .map(([id, meta]) => ({
        label: meta.name,
        data: months.map((m) => trend.find((t) => t.type_id === id && t.month === m)?.count ?? 0),
        borderColor: meta.color,
        backgroundColor: `${meta.color}22`,
        tension: 0.25,
        pointRadius: 2.5
      }))
      .sort((a, b) => b.data.reduce((s, v) => s + v, 0) - a.data.reduce((s, v) => s + v, 0))
      .slice(0, 6); // 가독성을 위해 상위 6개 유형만
    return { months, datasets };
  }, [trend]);

  const isEmpty = !loading && (!stats || stats.monthly.length === 0);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">통계</h1>
        <p className="page-subtitle">월별·유형별 기록 추이, 반별 분포를 확인합니다.</p>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <label className="field-label" style={{ marginBottom: 0 }}>
            기간
          </label>
          <select className="select" style={{ width: 130 }} value={period} onChange={(e) => setPeriod(Number(e.target.value))}>
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="card empty-state">불러오는 중…</div>
      ) : isEmpty ? (
        <div className="card empty-state">
          <div className="empty-state-icon">▤</div>
          <div>아직 통계를 낼 기록이 없습니다.</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <div className="card" style={{ flex: '2 1 420px' }}>
              <h2 className="section-title">월별 기록 건수</h2>
              <Bar
                data={{
                  labels: [...stats!.monthly].reverse().map((m) => m.month),
                  datasets: [
                    {
                      label: '기록 건수',
                      data: [...stats!.monthly].reverse().map((m) => m.count),
                      backgroundColor: '#2383e2'
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  plugins: { legend: { display: false } },
                  scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
                }}
              />
            </div>

            <div className="card" style={{ flex: '1 1 280px' }}>
              <h2 className="section-title">유형별 분포</h2>
              {stats!.byType.length === 0 ? (
                <div className="empty-state" style={{ padding: '30px 10px' }}>
                  데이터 없음
                </div>
              ) : (
                <Doughnut
                  data={{
                    labels: stats!.byType.map((t) => t.type_name),
                    datasets: [
                      {
                        data: stats!.byType.map((t) => t.count),
                        backgroundColor: stats!.byType.map((t) => t.type_color)
                      }
                    ]
                  }}
                  options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }}
                />
              )}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <h2 className="section-title">유형별 월 추이 (최근 6개월 · 상위 6개 유형)</h2>
            {trendData.datasets.length === 0 ? (
              <div className="empty-state" style={{ padding: '20px 10px' }}>
                최근 6개월 기록이 없습니다.
              </div>
            ) : (
              <Line
                data={{ labels: trendData.months, datasets: trendData.datasets }}
                options={{
                  responsive: true,
                  plugins: { legend: { position: 'bottom' } },
                  scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
                }}
              />
            )}
            <p style={{ fontSize: 11.5, color: 'var(--text-faint)', margin: '6px 0 0' }}>
              특정 유형(예: 학교폭력)이 늘어나는 추세를 월 단위로 파악할 수 있습니다.
            </p>
          </div>

          {heat.grades.length > 0 && (
            <div className="card" style={{ marginBottom: 12 }}>
              <h2 className="section-title">학년 × 반별 기록 분포 (히트맵)</h2>
              <div style={{ overflowX: 'auto' }}>
                <table className="record-table" style={{ width: 'auto' }}>
                  <thead>
                    <tr>
                      <th></th>
                      {heat.classes.map((c) => (
                        <th key={c} style={{ textAlign: 'center', minWidth: 52 }}>
                          {c}반
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heat.grades.map((g) => (
                      <tr key={g}>
                        <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{g}학년</td>
                        {heat.classes.map((c) => {
                          const count = heat.countOf.get(`${g}-${c}`) ?? 0;
                          return (
                            <td
                              key={c}
                              style={{
                                textAlign: 'center',
                                background: heatColor(count),
                                color: count / heat.max > 0.6 ? '#fff' : 'var(--text)',
                                fontWeight: count > 0 ? 700 : 400
                              }}
                              title={`${g}학년 ${c}반: ${count}건`}
                            >
                              {count > 0 ? count : '·'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--text-faint)', margin: '6px 0 0' }}>
                색이 진할수록 기록이 많은 반입니다. 상담이 특정 반에 몰리는지 한눈에 확인할 수 있습니다.
              </p>
            </div>
          )}

          <div className="section">
            <h2 className="section-title">
              학생별 기록 횟수 랭킹 (상위 10명 · {PERIOD_OPTIONS.find((o) => o.value === period)?.label})
            </h2>
            <div className="card" style={{ padding: 0 }}>
              {ranking.length === 0 ? (
                <div className="empty-state">해당 기간에 기록이 없습니다.</div>
              ) : (
                <table className="record-table">
                  <thead>
                    <tr>
                      <th style={{ width: 60 }}>순위</th>
                      <th>학생</th>
                      <th>학년/반/번호</th>
                      <th>기록 건수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((r, i) => (
                      <tr
                        key={r.student_id}
                        style={{ cursor: 'pointer' }}
                        title="클릭: 학생 프로필"
                        onClick={() => navigate(`/students/${r.student_id}`)}
                      >
                        <td>{i + 1}</td>
                        <td>{r.name}</td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                          {[r.grade != null ? `${r.grade}학년` : null, r.class_no != null ? `${r.class_no}반` : null, r.number != null ? `${r.number}번` : null]
                            .filter(Boolean)
                            .join(' ') || '-'}
                        </td>
                        <td>{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="section">
            <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>익명화 통계 내보내기</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12.5, marginTop: 2 }}>
                  학생명을 A학생, B학생…으로 치환한 엑셀 파일을 생성합니다. 학생별 순위·유형별 분포·월별 추이·반별 요약 시트가 포함됩니다. 원본 DB는 변경되지 않습니다.
                </div>
              </div>
              <button className="btn btn-primary" disabled={exporting} onClick={handleExport}>
                {exporting ? '내보내는 중…' : '엑셀로 내보내기'}
              </button>
            </div>
            {toast && <p style={{ color: 'var(--success)', fontSize: 12.5, marginTop: 8 }}>{toast}</p>}
          </div>
        </>
      )}
    </div>
  );
}
