import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from './icons';

interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
}

export default function Modal({ title, onClose, children, maxWidth = 420 }: Props) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="btn-icon" title="닫기" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}
