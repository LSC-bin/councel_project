import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Title
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend, Title);

export default function Statistics() {
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [ranking, setRanking] = useState<{ student_id: number; name: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([window.api.getMonthlyStats(), window.api.getStudentRanking(10)])
      .then(([s, r]) => {
        setStats(s);
        setRanking(r);
      })
      .finally(() => setLoading(false));
  }, []);

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

  const isEmpty = !loading && (!stats || stats.monthly.length === 0);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">통계</h1>
        <p className="page-subtitle">월별·유형별 기록 추이를 확인합니다.</p>
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
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
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

          <div className="section">
            <h2 className="section-title">학생별 기록 횟수 랭킹 (상위 10명)</h2>
            <div className="card" style={{ padding: 0 }}>
              {ranking.length === 0 ? (
                <div className="empty-state">데이터 없음</div>
              ) : (
                <table className="record-table">
                  <thead>
                    <tr>
                      <th style={{ width: 60 }}>순위</th>
                      <th>학생</th>
                      <th>기록 건수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((r, i) => (
                      <tr key={r.student_id}>
                        <td>{i + 1}</td>
                        <td>{r.name}</td>
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
                  학생명을 A학생, B학생…으로 치환한 엑셀 파일을 생성합니다. 원본 DB는 변경되지 않습니다.
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
