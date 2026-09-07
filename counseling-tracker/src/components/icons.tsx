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
