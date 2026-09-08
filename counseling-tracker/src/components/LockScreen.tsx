import { useState } from 'react';
import { LockIcon } from './icons';

// dbLock=true면 단순 앱 잠금이 아니라 DB 자체가 비밀번호로 암호화된 상태다.
// 이 경우 비밀번호 검증 대신 unlock(DB 복호화)을 호출한다.
export default function LockScreen({ onUnlock, dbLock = false }: { onUnlock: () => void; dbLock?: boolean }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

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
        }
        return;
      }
      const ok = await window.api.verifyPassword(password);
      if (ok) {
        onUnlock();
      } else {
        setError('비밀번호가 올바르지 않습니다.');
        setPassword('');
      }
    } finally {
      setChecking(false);
    }
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)'
      }}
    >
      <form onSubmit={handleSubmit} className="card" style={{ width: 320, textAlign: 'center' }}>
        <div style={{ marginBottom: 8, color: 'var(--accent)' }}>
          <LockIcon />
        </div>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>상담기록관리</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 12.5, marginBottom: 16 }}>
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
      </form>
    </div>
  );
}
