import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MetricCard from '../components/MetricCard';
import Calendar from '../components/Calendar';

function initials(name: string) {
  return name.slice(0, 1);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state as { studentId?: number; studentName?: string } | null;

  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [alerts, setAlerts] = useState<CrisisAlert[]>([]);
  const [recent, setRecent] = useState<ConsultRecord[]>([]);
  const [pinned, setPinned] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  // 학생 상세 등 다른 화면에서 "예약 잡기"로 넘어온 경우, 캘린더에 한 번만 전달한다.
  const [prefill, setPrefill] = useState(navState ?? null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      window.api.getMonthlyStats(),
      window.api.getCrisisAlerts(),
      window.api.getRecords({ limit: 8, order: 'desc' }),
      window.api.getPinnedStudents()
    ])
      .then(([s, a, r, p]) => {
        if (cancelled) return;
        setStats(s);
        setAlerts(a);
        setRecent(r);
        setPinned(p);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const maxTypeCount = stats?.byType.length ? Math.max(...stats.byType.map((t) => t.count)) : 0;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">대시보드</h1>
        <p className="page-subtitle">오늘의 학생 현황을 한눈에 확인하세요.</p>
      </div>

      {alerts.length > 0 && (
        <div className="banner" onClick={() => navigate('/search', { state: { studentId: alerts[0].student_id } })}>
          <span className="banner-icon">⚠</span>
          <span>
            {alerts.map((a) => a.name).join(', ')} 학생 — 최근 14일간 기록 급증. 클릭해서 확인하세요.
          </span>
        </div>
      )}

      {!loading && pinned.length > 0 && (
        <div className="pinned-row">
          {pinned.map((s) => (
            <button key={s.id} className="pinned-chip" onClick={() => navigate(`/students/${s.id}`)}>
              <span className="pinned-avatar">{initials(s.name)}</span>
              <span>{s.name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="metric-grid">
        <MetricCard label="이번 달 기록 건수" value={loading ? '—' : stats?.thisMonthCount ?? 0} />
        <MetricCard label="후속조치 대기" value={loading ? '—' : stats?.followUpPending ?? 0} />
        <MetricCard label="등록 학생 수" value={loading ? '—' : stats?.studentCount ?? 0} />
        <MetricCard label="생기부 미반영" value={loading ? '—' : stats?.niceUnreflectedCount ?? 0} />
      </div>

      <div className="section">
        <h2 className="section-title">예약 캘린더</h2>
        <Calendar
          prefillStudentId={prefill?.studentId ?? null}
          prefillStudentName={prefill?.studentName ?? null}
          onPrefillConsumed={() => setPrefill(null)}
        />
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div className="section" style={{ flex: '2 1 420px', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <h2 className="section-title" style={{ margin: 0 }}>
              최근 기록
            </h2>
            <button className="btn-icon" onClick={() => navigate('/search')} title="조회·검색으로 이동">
              +
            </button>
          </div>
          <div className="card">
            {loading ? (
              <div className="empty-state">불러오는 중…</div>
            ) : recent.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">✎</div>
                <div>아직 등록된 기록이 없습니다.</div>
                <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={() => navigate('/input')}>
                  첫 기록 입력하기
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

        <div style={{ flex: '1 1 260px' }}>
          <div className="section" style={{ marginBottom: 0 }}>
            <h2 className="section-title">유형별 분포</h2>
            <div className="card">
              {loading || !stats || stats.byType.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px 10px' }}>
                  데이터 없음
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {stats.byType.map((t) => (
                    <div key={t.type_name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}>
                        <span>{t.type_name}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{t.count}</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-hover)' }}>
                        <div
                          style={{
                            height: '100%',
                            borderRadius: 3,
                            width: `${maxTypeCount ? (t.count / maxTypeCount) * 100 : 0}%`,
                            background: t.type_color
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
