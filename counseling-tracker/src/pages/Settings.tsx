import { useEffect, useState } from 'react';

export default function Settings() {
  const [students, setStudents] = useState<Student[]>([]);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function refresh() {
    window.api.getStudents().then(setStudents);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleImport() {
    setImporting(true);
    setMessage(null);
    try {
      const result = await window.api.importStudents();
      if (result.canceled) return;
      setMessage(`${result.imported}명의 학생을 가져왔습니다.`);
      refresh();
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">설정</h1>
        <p className="page-subtitle">학생 명부, 상담 유형, 앱 환경을 관리합니다.</p>
      </div>

      <div className="section">
        <h2 className="section-title">학생 명부</h2>
        <div className="card">
          <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>
            엑셀 파일(학년도 · 학년 · 반 · 번호 · 이름)을 업로드해 학생 명부를 등록하세요.
          </p>
          <button className="btn btn-primary" disabled={importing} onClick={handleImport}>
            {importing ? '가져오는 중…' : '명부 업로드'}
          </button>
          {message && <p style={{ color: 'var(--success)', fontSize: 13, marginTop: 10 }}>{message}</p>}
          <p style={{ color: 'var(--text-faint)', fontSize: 12.5, marginTop: 14, marginBottom: 0 }}>
            현재 등록된 학생: {students.length}명
          </p>
        </div>
      </div>

      <AppLockSettings />

      <div className="section">
        <h2 className="section-title">상담 유형 · 빠른 입력 템플릿 · 학년도 전환</h2>
        <div className="card empty-state">
          <div className="empty-state-icon">⚙</div>
          <div>다음 단계에서 구현 예정입니다.</div>
        </div>
      </div>
    </div>
  );
}

function AppLockSettings() {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function refresh() {
    window.api.hasPassword().then(setHasPassword);
  }

  useEffect(() => {
    refresh();
  }, []);

  function resetForm() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }

  async function handleSetPassword() {
    setError(null);
    setMessage(null);
    if (newPassword !== confirmPassword) {
      setError('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    setSaving(true);
    try {
      const result = await window.api.setPassword({
        currentPassword: hasPassword ? currentPassword : undefined,
        newPassword
      });
      if (!result.ok) {
        setError(result.error ?? '변경에 실패했습니다.');
        return;
      }
      setMessage(hasPassword ? '비밀번호가 변경되었습니다.' : '앱 잠금이 설정되었습니다.');
      resetForm();
      refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleRemovePassword() {
    setError(null);
    setMessage(null);
    if (!confirm('앱 잠금을 해제할까요? 다음 실행부터 비밀번호 없이 열립니다.')) return;
    setSaving(true);
    try {
      const result = await window.api.removePassword(currentPassword);
      if (!result.ok) {
        setError(result.error ?? '해제에 실패했습니다.');
        return;
      }
      setMessage('앱 잠금이 해제되었습니다.');
      resetForm();
      refresh();
    } finally {
      setSaving(false);
    }
  }

  if (hasPassword === null) return null;

  return (
    <div className="section">
      <h2 className="section-title">앱 잠금</h2>
      <div className="card" style={{ maxWidth: 420 }}>
        <p style={{ color: 'var(--text-secondary)', marginTop: 0, fontSize: 13 }}>
          {hasPassword
            ? '앱 실행 시 비밀번호를 요구합니다. 아래에서 변경하거나 해제할 수 있습니다.'
            : '비밀번호를 설정하면 다음 실행부터 앱 시작 시 잠금 화면이 표시됩니다.'}
        </p>

        {hasPassword && (
          <div className="field">
            <label className="field-label">현재 비밀번호</label>
            <input
              className="input"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
        )}
        <div className="field">
          <label className="field-label">{hasPassword ? '새 비밀번호' : '설정할 비밀번호'}</label>
          <input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">비밀번호 확인</label>
          <input
            className="input"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        {error && <p style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 10 }}>{error}</p>}
        {message && <p style={{ color: 'var(--success)', fontSize: 12.5, marginBottom: 10 }}>{message}</p>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" disabled={saving || !newPassword} onClick={handleSetPassword}>
            {hasPassword ? '비밀번호 변경' : '잠금 설정'}
          </button>
          {hasPassword && (
            <button
              className="btn"
              style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
              disabled={saving || !currentPassword}
              onClick={handleRemovePassword}
            >
              잠금 해제
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
