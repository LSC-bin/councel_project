import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LockIcon,
  NavHomeIcon,
  NavPencilIcon,
  NavSearchIcon,
  NavUsersIcon,
  NavGraphIcon,
  NavChartIcon,
  NavArchiveIcon,
  NavGearIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from './icons';

const NAV_ITEMS = [
  { to: '/', label: '대시보드', icon: NavHomeIcon, end: true },
  { to: '/input', label: '기록 입력', icon: NavPencilIcon },
  { to: '/search', label: '조회·검색', icon: NavSearchIcon },
  { to: '/students', label: '학생 관리', icon: NavUsersIcon },
  { to: '/relations', label: '관계 그래프', icon: NavGraphIcon },
  { to: '/statistics', label: '통계', icon: NavChartIcon },
  { to: '/report', label: '보고서·백업', icon: NavArchiveIcon }
];

const COLLAPSE_KEY = 'sidebar_collapsed';

export default function Sidebar({ onLockNow }: { onLockNow?: () => void }) {
  // 대기 조치 기한 배지: 지남/오늘 마감 건수를 상시 표시 (60초마다 갱신)
  const [pending, setPending] = useState<PendingActionsSummary | null>(null);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1');

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

  function toggleCollapsed() {
    setCollapsed((cur) => {
      localStorage.setItem(COLLAPSE_KEY, cur ? '0' : '1');
      return !cur;
    });
  }

  const urgent = (pending?.overdue ?? 0) + (pending?.today ?? 0);

  return (
    <aside className={'sidebar' + (collapsed ? ' collapsed' : '')}>
      <div className="sidebar-title">
        {!collapsed && <span className="sidebar-title-text">상담기록관리</span>}
        <button
          type="button"
          className="sidebar-toggle"
          onClick={toggleCollapsed}
          title={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
        >
          {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </button>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={item.label}
            className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}
          >
            <item.icon />
            <span className="nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      {urgent > 0 && (
        <div className="sidebar-badge-wrap">
          <NavLink
            to="/"
            className="sidebar-badge-link"
            title={`마감이 지났거나 오늘 마감인 조치가 ${urgent}건 있습니다`}
          >
            <span className={'sidebar-badge' + ((pending?.overdue ?? 0) > 0 ? ' urgent' : '')}>
              <span className="badge-full">
                조치 {urgent}건 {pending && pending.overdue > 0 ? `(지남 ${pending.overdue})` : '(오늘 마감)'}
              </span>
              <span className="badge-mini">{urgent}</span>
            </span>
          </NavLink>
        </div>
      )}
      <div className="sidebar-footer">
        <NavLink
          to="/settings"
          title="설정"
          className={({ isActive }) => 'sidebar-link sidebar-settings' + (isActive ? ' active' : '')}
        >
          <NavGearIcon />
          <span className="nav-label">설정</span>
        </NavLink>
        {onLockNow && (
          <button type="button" className="sidebar-lock-btn" onClick={onLockNow} title="지금 바로 앱을 잠급니다">
            <LockIcon />
          </button>
        )}
        {!collapsed && <div className="sidebar-version">v0.5.1 · 로컬 암호화 저장</div>}
      </div>
    </aside>
  );
}
