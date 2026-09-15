import { useEffect, useState } from 'react';
import { MinusIcon, CloseIcon, MaximizeIcon, RestoreIcon } from './icons';

// 프레임리스 창의 우상단 커스텀 윈도우 컨트롤 (최소화·최대화·닫기).
// 네이티브 타이틀바 라인을 없애고 콘텐츠를 꽉 채우기 위한 대체 UI.
export default function WindowControls() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    window.api.winIsMaximized?.().then(setMaximized).catch(() => {});
  }, []);

  async function toggleMax() {
    const m = await window.api.winToggleMaximize?.();
    if (typeof m === 'boolean') setMaximized(m);
  }

  return (
    <div className="win-controls">
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
}
