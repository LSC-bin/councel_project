import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: '대시보드', end: true },
  { to: '/input', label: '기록 입력' },
  { to: '/search', label: '조회·검색' },
  { to: '/students', label: '학생 관리' },
  { to: '/statistics', label: '통계' },
  { to: '/report', label: '보고서·백업' },
  { to: '/settings', label: '설정' }
];

export default function TopNav() {
  return (
    <>
      <div className="top-banner">
        <span className="top-banner-title">상담기록관리</span>
        <span className="top-banner-sub">로컬 암호화 저장 · 외부 전송 없음</span>
      </div>
      <nav className="top-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => 'top-nav-link' + (isActive ? ' active' : '')}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
