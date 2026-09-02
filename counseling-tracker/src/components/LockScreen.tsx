import { useState } from 'react';

export default function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true);
    setError(null);
    try {
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
        <div style={{ fontSize: 28, marginBottom: 8 }}>🔒</div>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>상담기록관리</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 12.5, marginBottom: 16 }}>
          잠긴 앱입니다. 비밀번호를 입력하세요.
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
