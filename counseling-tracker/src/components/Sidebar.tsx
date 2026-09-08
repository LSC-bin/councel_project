import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LockIcon } from './icons';

const NAV_ITEMS = [
  { to: '/', label: '대시보드', end: true },
  { to: '/input', label: '기록 입력' },
  { to: '/search', label: '조회·검색' },
  { to: '/students', label: '학생 관리' },
  { to: '/relations', label: '관계 그래프' },
  { to: '/statistics', label: '통계' },
  { to: '/report', label: '보고서·백업' },
  { to: '/settings', label: '설정' }
];

export default function Sidebar({ onLockNow }: { onLockNow?: () => void }) {
  // 대기 조치 기한 배지: 지남/오늘 마감 건수를 상시 표시 (60초마다 갱신)
  const [pending, setPending] = useState<PendingActionsSummary | null>(null);

  useEffect(() => {
    let alive = true;
    function load() {
      window.api.getPendingActionsSummary().then((s) => {
        if (alive) setPending(s);
      });
    }
    load();
    const timer = window.setInterval(load, 60 * 1000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const urgent = (pending?.overdue ?? 0) + (pending?.today ?? 0);

  return (
    <aside className="sidebar">
      <div className="sidebar-title">상담기록관리</div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      {urgent > 0 && (
        <div style={{ padding: '4px 10px 8px' }}>
          <NavLink to="/" className="sidebar-badge-link" title="마감이 지났거나 오늘 마감인 조치가 있습니다">
            <span className={'sidebar-badge' + ((pending?.overdue ?? 0) > 0 ? ' urgent' : '')}>
              조치 {urgent}건 {pending && pending.overdue > 0 ? `(지남 ${pending.overdue})` : '(오늘 마감)'}
            </span>
          </NavLink>
        </div>
      )}
      {onLockNow && (
        <div style={{ padding: '6px' }}>
          <button type="button" className="sidebar-lock-btn" onClick={onLockNow} title="지금 바로 앱을 잠급니다">
            <LockIcon />
            <span>지금 잠금</span>
          </button>
        </div>
      )}
      <div className="sidebar-footer">v0.5.0 · 로컬 암호화 저장</div>
    </aside>
  );
}
