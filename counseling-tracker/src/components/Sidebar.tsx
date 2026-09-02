import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: '대시보드', icon: '⌂', end: true },
  { to: '/input', label: '기록 입력', icon: '✎' },
  { to: '/search', label: '조회·검색', icon: '⌕' },
  { to: '/students', label: '학생 관리', icon: '☺' },
  { to: '/statistics', label: '통계', icon: '▤' },
  { to: '/report', label: '보고서·백업', icon: '⇩' },
  { to: '/settings', label: '설정', icon: '⚙' }
];

export default function Sidebar() {
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
            <span className="sidebar-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">v0.1.0 · 로컬 저장</div>
    </aside>
  );
}
