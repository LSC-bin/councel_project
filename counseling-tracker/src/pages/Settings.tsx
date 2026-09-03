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
        <p className="page-subtitle">학생 명부, 기록 유형, 앱 환경을 관리합니다.</p>
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

      <RecordTypeSettings />

      <div className="section">
        <h2 className="section-title">학년도 전환</h2>
        <div className="card empty-state">
          <div className="empty-state-icon">⚙</div>
          <div>다음 단계에서 구현 예정입니다.</div>
        </div>
      </div>
    </div>
  );
}

function RecordTypeSettings() {
  const [types, setTypes] = useState<ConsultType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [templates, setTemplates] = useState<QuickTemplate[]>([]);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeColor, setNewTypeColor] = useState('#2383e2');
  const [newTemplateText, setNewTemplateText] = useState('');
  const [error, setError] = useState<string | null>(null);

  function refreshTypes() {
    window.api.getConsultTypes().then((t) => {
      setTypes(t);
      if (selectedTypeId == null && t.length > 0) setSelectedTypeId(t[0].id);
    });
  }

  useEffect(() => {
    refreshTypes();
  }, []);

  useEffect(() => {
    if (selectedTypeId == null) return;
    window.api.getQuickTemplates(selectedTypeId).then(setTemplates);
  }, [selectedTypeId]);

  async function handleAddType() {
    if (!newTypeName.trim()) return;
    const t = await window.api.addConsultType({ name: newTypeName.trim(), color: newTypeColor });
    setNewTypeName('');
    setTypes((cur) => [...cur, t]);
    setSelectedTypeId(t.id);
  }

  async function handleColorChange(id: number, color: string) {
    const t = await window.api.updateConsultType(id, { color });
    setTypes((cur) => cur.map((x) => (x.id === id ? t : x)));
  }

  async function handleRenameType(id: number, name: string) {
    if (!name.trim()) return;
    const t = await window.api.updateConsultType(id, { name: name.trim() });
    setTypes((cur) => cur.map((x) => (x.id === id ? t : x)));
  }

  async function handleDeleteType(id: number) {
    if (!confirm('이 기록 유형을 삭제할까요?')) return;
    setError(null);
    const result = await window.api.deleteConsultType(id);
    if (!result.ok) {
      setError(result.error ?? '삭제할 수 없습니다.');
      return;
    }
    setTypes((cur) => cur.filter((x) => x.id !== id));
    if (selectedTypeId === id) setSelectedTypeId(null);
  }

  async function handleAddTemplate() {
    if (!newTemplateText.trim() || selectedTypeId == null) return;
    const tpl = await window.api.addQuickTemplate({ type_id: selectedTypeId, text: newTemplateText.trim() });
    setTemplates((cur) => [...cur, tpl]);
    setNewTemplateText('');
  }

  async function handleDeleteTemplate(id: number) {
    await window.api.deleteQuickTemplate(id);
    setTemplates((cur) => cur.filter((t) => t.id !== id));
  }

  return (
    <div className="section">
      <h2 className="section-title">기록 유형 관리</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 12.5, marginTop: -6, marginBottom: 12 }}>
        상담뿐 아니라 출결·칭찬·학부모연락 등 학생과 관련된 어떤 기록이든 유형을 만들어 남길 수 있습니다.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: '1 1 320px', padding: 0 }}>
          {types.length === 0 ? (
            <div className="empty-state">유형이 없습니다.</div>
          ) : (
            <table className="record-table">
              <thead>
                <tr>
                  <th>색상</th>
                  <th>이름</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {types.map((t) => (
                  <tr key={t.id} style={selectedTypeId === t.id ? { background: 'var(--bg-hover)' } : undefined}>
                    <td>
                      <input
                        type="color"
                        value={t.color}
                        onChange={(e) => handleColorChange(t.id, e.target.value)}
                        style={{ width: 28, height: 22, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ cursor: 'pointer' }} onClick={() => setSelectedTypeId(t.id)}>
                      <input
                        className="input"
                        style={{ border: 'none', padding: '2px 4px', background: 'transparent' }}
                        defaultValue={t.name}
                        key={t.id + t.name}
                        onBlur={(e) => e.target.value !== t.name && handleRenameType(t.id, e.target.value)}
                      />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn-icon btn-icon-danger" title="삭제" onClick={() => handleDeleteType(t.id)}>
                        🗑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ display: 'flex', gap: 6, padding: 10, borderTop: '1px solid var(--border)' }}>
            <input
              type="color"
              value={newTypeColor}
              onChange={(e) => setNewTypeColor(e.target.value)}
              style={{ width: 32, height: 32, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
            />
            <input
              className="input"
              placeholder="새 유형 이름 (예: 출결, 칭찬)"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddType()}
            />
            <button className="btn btn-primary" style={{ whiteSpace: 'nowrap' }} disabled={!newTypeName.trim()} onClick={handleAddType}>
              추가
            </button>
          </div>
          {error && <p style={{ color: 'var(--danger)', fontSize: 12.5, padding: '0 10px 10px' }}>{error}</p>}
        </div>

        <div className="card" style={{ flex: '1 1 280px' }}>
          <div className="field-label">빠른 입력 템플릿 {selectedTypeId && `— ${types.find((t) => t.id === selectedTypeId)?.name ?? ''}`}</div>
          {selectedTypeId == null ? (
            <p style={{ color: 'var(--text-faint)', fontSize: 12.5 }}>왼쪽에서 유형을 먼저 선택하세요.</p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                {templates.length === 0 ? (
                  <p style={{ color: 'var(--text-faint)', fontSize: 12.5 }}>등록된 템플릿이 없습니다.</p>
                ) : (
                  templates.map((tpl) => (
                    <div key={tpl.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <span>{tpl.text}</span>
                      <button className="btn-icon btn-icon-danger" title="삭제" onClick={() => handleDeleteTemplate(tpl.id)}>
                        🗑
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  className="input"
                  placeholder="새 템플릿 문구"
                  value={newTemplateText}
                  onChange={(e) => setNewTemplateText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTemplate()}
                />
                <button className="btn btn-primary" disabled={!newTemplateText.trim()} onClick={handleAddTemplate}>
                  추가
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AppLockSettings() {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  // 비밀번호가 이미 설정된 경우, 현재 비밀번호를 먼저 확인해야 변경/해제 폼이 열린다.
  const [verified, setVerified] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);

  function refresh() {
    window.api.hasPassword().then((v) => {
      setHasPassword(v);
      setVerified(!v);
    });
  }

  useEffect(() => {
    refresh();
  }, []);

  function resetForm() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }

  async function handleVerifyCurrent() {
    setError(null);
    setChecking(true);
    try {
      const ok = await window.api.verifyPassword(currentPassword);
      if (!ok) {
        setError('현재 비밀번호가 올바르지 않습니다.');
        return;
      }
      setVerified(true);
    } finally {
      setChecking(false);
    }
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
        {hasPassword && !verified ? (
          <>
            <p style={{ color: 'var(--text-secondary)', marginTop: 0, fontSize: 13 }}>
              변경하거나 해제하려면 먼저 현재 비밀번호를 확인하세요.
            </p>
            <div className="field">
              <label className="field-label">현재 비밀번호</label>
              <input
                className="input"
                type="password"
                autoFocus
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyCurrent()}
              />
            </div>
            {error && <p style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 10 }}>{error}</p>}
            <button className="btn btn-primary" disabled={checking || !currentPassword} onClick={handleVerifyCurrent}>
              {checking ? '확인 중…' : '확인'}
            </button>
          </>
        ) : (
          <>
            <p style={{ color: 'var(--text-secondary)', marginTop: 0, fontSize: 13 }}>
              {hasPassword
                ? '새 비밀번호를 입력해 변경하거나, 앱 잠금을 해제할 수 있습니다.'
                : '비밀번호를 설정하면 다음 실행부터 앱 시작 시 잠금 화면이 표시됩니다.'}
            </p>
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
                  disabled={saving}
                  onClick={handleRemovePassword}
                >
                  잠금 해제
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
