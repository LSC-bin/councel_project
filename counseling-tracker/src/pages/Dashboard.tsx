import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MetricCard from '../components/MetricCard';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [alerts, setAlerts] = useState<CrisisAlert[]>([]);
  const [recent, setRecent] = useState<ConsultRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([window.api.getMonthlyStats(), window.api.getCrisisAlerts(), window.api.getRecords({ limit: 10, order: 'desc' })])
      .then(([s, a, r]) => {
        if (cancelled) return;
        setStats(s);
        setAlerts(a);
        setRecent(r);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">대시보드</h1>
        <p className="page-subtitle">오늘의 상담 현황을 한눈에 확인하세요.</p>
      </div>

      {alerts.length > 0 && (
        <div className="banner" onClick={() => navigate('/search', { state: { studentId: alerts[0].student_id } })}>
          <span className="banner-icon">⚠</span>
          <span>
            {alerts.map((a) => a.name).join(', ')} 학생 — 최근 14일간 상담 급증. 클릭해서 확인하세요.
          </span>
        </div>
      )}

      <div className="metric-grid">
        <MetricCard label="이번 달 상담 건수" value={loading ? '—' : stats?.thisMonthCount ?? 0} />
        <MetricCard label="후속조치 대기" value={loading ? '—' : stats?.followUpPending ?? 0} />
        <MetricCard label="등록 학생 수" value={loading ? '—' : stats?.studentCount ?? 0} />
      </div>

      <div className="section">
        <h2 className="section-title">최근 상담 기록</h2>
        <div className="card">
          {loading ? (
            <div className="empty-state">불러오는 중…</div>
          ) : recent.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">✎</div>
              <div>아직 등록된 상담 기록이 없습니다.</div>
              <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={() => navigate('/input')}>
                첫 상담 기록 입력하기
              </button>
            </div>
          ) : (
            <table className="record-table">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>학생</th>
                  <th>유형</th>
                  <th>내용</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td>{r.record_date}</td>
                    <td>{r.student_name}</td>
                    <td>
                      <span className="badge" style={{ background: `${r.type_color}22`, color: r.type_color }}>
                        <span className="badge-dot" style={{ background: r.type_color }} />
                        {r.type_name}
                      </span>
                    </td>
                    <td>{r.content?.slice(0, 40)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
