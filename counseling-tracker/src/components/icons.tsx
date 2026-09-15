// 이모지 대신 사용하는 단색 SVG 아이콘. currentColor를 써서 버튼 글자색(위험 버튼이면 빨강)을 그대로 따라간다.
export function EditIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11.3 2.3a1.6 1.6 0 0 1 2.4 2.4L5.4 13 2 14l1-3.4 8.3-8.3z" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.7 4.3h10.6" />
      <path d="M6.2 4.3V2.9c0-.5.4-.9.9-.9h1.8c.5 0 .9.4.9.9v1.4" />
      <path d="M4.3 4.3l.6 8.4c0 .6.5 1 1 1h4.2c.5 0 1-.4 1-1l.6-8.4" />
      <path d="M6.7 7v4" />
      <path d="M9.3 7v4" />
    </svg>
  );
}

export function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.8 3.2 5 8l4.8 4.8" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M8 3v10" />
      <path d="M3 8h10" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M4 4l8 8" />
      <path d="M12 4l-8 8" />
    </svg>
  );
}

export function CalendarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.2" y="3.2" width="11.6" height="10.6" rx="1" />
      <path d="M2.2 6.4h11.6" />
      <path d="M5.4 1.8v2.6" />
      <path d="M10.6 1.8v2.6" />
    </svg>
  );
}

export function PinIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2.2 9.9 6l4.1.6-3 2.9.7 4.1L8 11.7l-3.7 1.9.7-4.1-3-2.9L6.1 6z" />
    </svg>
  );
}

export function FolderIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.2 4.2c0-.6.4-1 1-1h3l1.4 1.6h5.2c.6 0 1 .4 1 1v6.9c0 .6-.4 1-1 1H3.2c-.6 0-1-.4-1-1z" />
    </svg>
  );
}

export function ChevronRightIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 3.5 11 8l-4.5 4.5" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5 6.5 12 13 4.5" />
    </svg>
  );
}

export function LockIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4.5" y="10.5" width="15" height="10" rx="1.5" />
      <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
      <circle cx="12" cy="15.5" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function DotsIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" stroke="none">
      <circle cx="8" cy="3" r="1.4" />
      <circle cx="8" cy="8" r="1.4" />
      <circle cx="8" cy="13" r="1.4" />
    </svg>
  );
}

export function FilterIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3.5h12" />
      <path d="M4.5 8h7" />
      <path d="M6.5 12.5h3" />
    </svg>
  );
}

export function ChevronLeftIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 3.5 5 8l4.5 4.5" />
    </svg>
  );
}

export function AlertIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2.5 14.5 13.5h-13z" />
      <path d="M8 6.5v3.2" />
      <circle cx="8" cy="11.8" r=".7" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SortIcon({ dir }: { dir: 'asc' | 'desc' }) {
  return (
    <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor" stroke="none" style={{ verticalAlign: 'middle', marginLeft: 3 }}>
      {dir === 'asc' ? <path d="M5 1.5 9 8H1z" /> : <path d="M5 8.5 1 2h8z" />}
    </svg>
  );
}

export function MinusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M3.5 8h9" />
    </svg>
  );
}

export function ResetIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 8a5 5 0 1 1-1.5-3.6" />
      <path d="M13 2v3h-3" />
    </svg>
  );
}

export function TrendUpIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" stroke="none" style={{ verticalAlign: '-1px', marginRight: 2 }}>
      <path d="M6 1.5 11 9.5H1z" />
    </svg>
  );
}

export function TrendDownIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" stroke="none" style={{ verticalAlign: '-1px', marginRight: 2 }}>
      <path d="M6 10.5 1 2.5h10z" />
    </svg>
  );
}

export function DocIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 1.8h6L12.5 5v9.2h-9z" />
      <path d="M9.5 1.8V5h3" />
      <path d="M5.5 8h5" />
      <path d="M5.5 10.5h5" />
    </svg>
  );
}

export function PrintIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 6V2.5h7V6" />
      <rect x="2.5" y="6" width="11" height="5" rx="1" />
      <path d="M4.5 9.5h7v4h-7z" />
    </svg>
  );
}

/* ---------- 사이드바 내비 아이콘 (14px, 단색) ---------- */

export function NavHomeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 7 8 2.5 13.5 7v6.5h-11z" />
      <path d="M6.5 13.5v-4h3v4" />
    </svg>
  );
}

export function NavPencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 13.5h11" />
      <path d="M10.8 2.9a1.5 1.5 0 0 1 2.3 2.3L6 12.3l-3 .8.8-3z" />
    </svg>
  );
}

export function NavSearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="7" r="4.4" />
      <path d="m10.3 10.3 3.2 3.2" />
    </svg>
  );
}

export function NavUsersIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="5.4" r="2.6" />
      <path d="M1.8 13.4c.5-2.3 2.2-3.6 4.2-3.6s3.7 1.3 4.2 3.6" />
      <path d="M11 3.2a2.5 2.5 0 0 1 0 4.8" />
      <path d="M12.2 9.9c1.2.5 1.9 1.6 2.1 3.1" />
    </svg>
  );
}

export function NavGraphIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="3" r="1.8" />
      <circle cx="3.2" cy="11.8" r="1.8" />
      <circle cx="12.8" cy="11.8" r="1.8" />
      <path d="M6.9 4.5 4.3 10.3" />
      <path d="M9.1 4.5l2.6 5.8" />
      <path d="M5 11.8h6" />
    </svg>
  );
}

export function NavChartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 2.5v11h11" />
      <path d="M5.5 10.5V7.5" />
      <path d="M8.5 10.5V4.5" />
      <path d="M11.5 10.5v-4" />
    </svg>
  );
}

export function NavArchiveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2.8" width="12" height="3" />
      <path d="M3.2 5.8v7.4h9.6V5.8" />
      <path d="M6.4 8.6h3.2" />
    </svg>
  );
}

export function NavGearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.8v1.8M8 12.4v1.8M14.2 8h-1.8M3.6 8H1.8M12.4 3.6l-1.3 1.3M4.9 11.1l-1.3 1.3M12.4 12.4l-1.3-1.3M4.9 4.9 3.6 3.6" />
    </svg>
  );
}
