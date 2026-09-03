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
