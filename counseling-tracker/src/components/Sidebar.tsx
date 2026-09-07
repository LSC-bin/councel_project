import { NavLink } from 'react-router-dom';

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
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">v0.2.0 · 로컬 암호화 저장</div>
    </aside>
  );
}
