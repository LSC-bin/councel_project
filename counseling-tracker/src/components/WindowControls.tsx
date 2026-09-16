import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { MinusIcon, CloseIcon, MaximizeIcon, RestoreIcon } from './icons';

// 프레임리스 창의 윈도우 컨트롤 (최소화·최대화·닫기).
// 페이지 헤더(드래그 영역) 안으로 포털링해서 렌더링한다 — 드래그 영역과
// 겹치는 형제 요소로 두면 실제 OS에서 클릭이 드래그 영역에 흡수될 수 있기 때문.
// 헤더가 없는 화면(잠금 등)에서는 호출된 자리에 그대로 그려진다.
export default function WindowControls() {
  const location = useLocation();
  const [maximized, setMaximized] = useState(false);
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    window.api.winIsMaximized?.().then(setMaximized).catch(() => {});
  }, []);

  // 라우트가 바뀐 후 헤더가 마운트되면 그곳으로 이동
  useEffect(() => {
    setHost(null);
    const raf = requestAnimationFrame(() => {
      setHost(document.querySelector<HTMLElement>('.page-header'));
    });
    return () => cancelAnimationFrame(raf);
  }, [location.pathname]);

  async function toggleMax() {
    const m = await window.api.winToggleMaximize?.();
    if (typeof m === 'boolean') setMaximized(m);
  }

  const inner = (
    <div className={'win-controls' + (host ? ' in-header' : '')}>
      <button type="button" className="win-btn" title="최소화" onClick={() => window.api.winMinimize?.()}>
        <MinusIcon />
      </button>
      <button type="button" className="win-btn" title={maximized ? '이전 크기로' : '최대화'} onClick={toggleMax}>
        {maximized ? <RestoreIcon /> : <MaximizeIcon />}
      </button>
      <button type="button" className="win-btn win-close" title="닫기" onClick={() => window.api.winClose?.()}>
        <CloseIcon />
      </button>
    </div>
  );

  if (host) return createPortal(inner, host);
  return inner;
}
