import { useRef, useState } from 'react';
import { LockIcon } from './icons';
import WindowControls from './WindowControls';

// dbLock=true면 단순 앱 잠금이 아니라 DB 자체가 비밀번호로 암호화된 상태다.
// 이 경우 비밀번호 검증 대신 unlock(DB 복호화)을 호출한다.
export default function LockScreen({ onUnlock, dbLock = false }: { onUnlock: () => void; dbLock?: boolean }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // macOS 로그인 윈도우처럼 실패 시 카드를 흔든다
  function shake() {
    const el = cardRef.current;
    if (!el) return;
    el.classList.remove('lock-shake');
    void el.offsetWidth; // 애니메이션 재시작
    el.classList.add('lock-shake');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true);
    setError(null);
    try {
      if (dbLock) {
        const result = await window.api.unlock(password);
        if (result.ok) {
          onUnlock();
        } else {
          setError(result.error ?? '비밀번호가 올바르지 않습니다.');
          setPassword('');
          shake();
        }
        return;
      }
      const ok = await window.api.verifyPassword(password);
      if (ok) {
        onUnlock();
      } else {
        setError('비밀번호가 올바르지 않습니다.');
        setPassword('');
        shake();
      }
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="lock-screen">
      <WindowControls />
      <form onSubmit={handleSubmit}>
        <div className="lock-card" ref={cardRef}>
          <div className="lock-avatar">
            <LockIcon />
          </div>
          <div className="lock-title">상담기록관리</div>
          <p className="lock-sub">
            {dbLock ? '상담 기록이 비밀번호로 암호화되어 있습니다. 비밀번호를 입력하세요.' : '잠긴 앱입니다. 비밀번호를 입력하세요.'}
          </p>
          <input
            className="input"
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            style={{ marginBottom: 10, textAlign: 'center' }}
          />
          {error && <p style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 10 }}>{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={checking || !password} style={{ width: '100%', justifyContent: 'center' }}>
            {checking ? '확인 중…' : '잠금 해제'}
          </button>
        </div>
      </form>
    </div>
  );
}
