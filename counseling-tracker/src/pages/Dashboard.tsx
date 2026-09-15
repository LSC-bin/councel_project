import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Calendar from '../components/Calendar';
import ActionList from '../components/ActionList';
import { useContextMenu } from '../components/ContextMenu';
import { AlertIcon, ChevronRightIcon, PlusIcon } from '../components/icons';

function initials(name: string) {
  return name.slice(0, 1);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const ctx = useContextMenu();
  const navState = location.state as { studentId?: number; studentName?: string } | null;

  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [alerts, setAlerts] = useState<CrisisAlert[]>([]);
  const [recent, setRecent] = useState<ConsultRecord[]>([]);
  const [pinned, setPinned] = useState<Student[]>([]);
  const [pendingActionCount, setPendingActionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionsKey, setActionsKey] = useState(0);

  // 학생 상세 등 다른 화면에서 "예약 잡기"로 넘어온 경우, 캘린더에 한 번만 전달한다.
  const [prefill, setPrefill] = useState(navState ?? null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      window.api.getMonthlyStats(),
      window.api.getCrisisAlerts(),
      window.api.getRecords({ limit: 8, order: 'desc' }),
      window.api.getPinnedStudents(),
      window.api.getActions({ pendingOnly: true })
    ])
      .then(([s, a, r, p, acts]) => {
        if (cancelled) return;
        setStats(s);
        setAlerts(a);
        setRecent(r);
        setPinned(p);
        setPendingActionCount(acts.length);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [actionsKey]);

  const maxTypeCount = stats?.byType.length ? Math.max(...stats.byType.map((t) => t.count)) : 0;

  const statCells = [
    { label: '이번 달 기록', value: stats?.thisMonthCount ?? 0 },
    { label: '후속조치 대기', value: stats?.followUpPending ?? 0, alert: (stats?.followUpPending ?? 0) > 0 },
    { label: '조치사항 대기', value: pendingActionCount, alert: pendingActionCount > 0 },
    { label: '등록 학생', value: stats?.studentCount ?? 0 },
    { label: '생기부 미반영', value: stats?.niceUnreflectedCount ?? 0, alert: (stats?.niceUnreflectedCount ?? 0) > 0 }
  ];

  return (
    <div>
      {alerts.length > 0 && (
        <div className="banner" onClick={() => navigate('/search', { state: { studentId: alerts[0].student_id } })}>
          <span className="banner-icon">
            <AlertIcon />
          </span>
          <span>
            {alerts.map((a) => a.name).join(', ')} 학생 — 최근 14일간 기록 급증. 클릭해서 확인하세요.
          </span>
        </div>
      )}

      <div className="section">
        <h2 className="section-title">현황</h2>
        <div className="card stat-list">
          {statCells.map((c) => (
            <div key={c.label} className={'stat-row' + (c.alert ? ' alert' : '')}>
              <span className="stat-label">{c.label}</span>
              <span className="stat-value">{loading ? '—' : c.value}</span>
            </div>
          ))}
        </div>
      </div>

      {!loading && pinned.length > 0 && (
        <div className="section">
          <h2 className="section-title">즐겨찾기 학생</h2>
          <div className="card pinned-list">
            {pinned.map((s) => (
              <button
                key={s.id}
                className="pinned-item"
                onClick={() => navigate(`/students/${s.id}`)}
                onContextMenu={(e) =>
                  ctx.open(e, [
                    { label: '학생 프로필 열기', onClick: () => navigate(`/students/${s.id}`) },
                    { label: '기록 추가', onClick: () => navigate('/input', { state: { studentId: s.id, studentName: s.name } }) },
                    {
                      label: '즐겨찾기 해제',
                      onClick: async () => {
                        await window.api.togglePin(s.id);
                        window.api.getPinnedStudents().then(setPinned);
                      }
                    }
                  ])
                }
              >
                <span className="pinned-avatar">{initials(s.name)}</span>
                <span>{s.name}</span>
                {s.grade != null && (
                  <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>
                    {s.grade}-{s.class_no}
                  </span>
                )}
                <span className="pinned-chevron">
                  <ChevronRightIcon />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!loading && (
        <div className="section">
          <h2 className="section-title">상담 이후 조치사항</h2>
          <div className="card">
            <ActionList showStudent compact pendingOnly onChanged={() => setActionsKey((k) => k + 1)} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className="section" style={{ flex: '3 1 560px', marginBottom: 12 }}>
          <h2 className="section-title">예약 캘린더</h2>
          <Calendar
            prefillStudentId={prefill?.studentId ?? null}
            prefillStudentName={prefill?.studentName ?? null}
            onPrefillConsumed={() => setPrefill(null)}
          />
        </div>

        <div style={{ flex: '2 1 340px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <h2 className="section-title" style={{ margin: 0 }}>
                최근 기록
              </h2>
              <button className="btn-icon" onClick={() => navigate('/search')} title="조회·검색으로 이동">
                <PlusIcon />
              </button>
            </div>
            <div className="card" style={{ padding: 0 }}>
              {loading ? (
                <div className="empty-state">불러오는 중…</div>
              ) : recent.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px 10px' }}>
                  <div>아직 등록된 기록이 없습니다.</div>
                  <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => navigate('/input')}>
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
                      <tr
                        key={r.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/search/${r.id}`)}
                        onContextMenu={(e) =>
                          ctx.open(e, [
                            { label: '기록 열기', onClick: () => navigate(`/search/${r.id}`) },
                            { label: '학생 프로필', onClick: () => navigate(`/students/${r.student_id}`) },
                            { label: '이 학생에 기록 추가', onClick: () => navigate('/input', { state: { studentId: r.student_id, studentName: r.student_name } }) }
                          ])
                        }
                      >
                        <td style={{ whiteSpace: 'nowrap' }}>{r.record_date.slice(5)}</td>
                        <td>{r.student_name}</td>
                        <td>
                          <span className="badge" style={{ background: `${r.type_color}18`, color: r.type_color }}>
                            {r.type_name}
                          </span>
                        </td>
                        <td>{r.content?.slice(0, 24)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div>
            <h2 className="section-title">유형별 분포</h2>
            <div className="card">
              {loading || !stats || stats.byType.length === 0 ? (
                <div className="empty-state" style={{ padding: '16px 10px' }}>
                  데이터 없음
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {stats.byType.map((t) => (
                    <div key={t.type_name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                        <span>{t.type_name}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{t.count}</span>
                      </div>
                      <div style={{ height: 5, background: 'var(--bg-hover)' }}>
                        <div
                          style={{
                            height: '100%',
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
      {ctx.element}
    </div>
  );
}
