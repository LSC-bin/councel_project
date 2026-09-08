import { useEffect, useState } from 'react';
import { TrashIcon } from '../components/icons';

export default function Settings({ onSettingsChanged }: { onSettingsChanged?: () => void }) {
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
      if (result.error) {
        setMessage(result.error);
        return;
      }
      setMessage(`${result.imported}명의 학생을 가져왔습니다.${result.skipped > 0 ? ` (${result.skipped}행은 이름 없음/중복으로 건너뜀)` : ''}`);
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
            엑셀 파일(학년도 · 학년 · 반 · 번호 · 이름, 선택: 보호자 · 연락처 · 주소 · 특이사항 · 메모)을 업로드해 학생 명부를 일괄 등록하세요.
            이미 등록된 학생(이름·학년도·학년·반·번호 동일)은 자동으로 건너뜁니다. 학생 관리 화면에서도 같은 버튼을 쓸 수 있습니다.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" disabled={importing} onClick={handleImport}>
              {importing ? '가져오는 중…' : '명부 업로드'}
            </button>
            <button className="btn" onClick={() => window.api.downloadStudentTemplate()}>
              명부 양식 다운로드
            </button>
          </div>
          {message && <p style={{ color: 'var(--success)', fontSize: 13, marginTop: 10 }}>{message}</p>}
          <p style={{ color: 'var(--text-faint)', fontSize: 12.5, marginTop: 14, marginBottom: 0 }}>
            현재 등록된 학생: {students.length}명
          </p>
        </div>
      </div>

      <AppLockSettings onSettingsChanged={onSettingsChanged} />

      <RecordTypeSettings />

      <SchoolYearSettings />
    </div>
  );
}

function SchoolYearSettings() {
  const [yearLabel, setYearLabel] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleArchive() {
    const label = yearLabel.trim();
    if (!label) {
      setMessage('아카이브할 학년도를 입력하세요 (예: 2025).');
      return;
    }
    if (
      !confirm(
        `현재 등록된 모든 활성 학생을 "${label}학년도"로 아카이브합니다. 기록은 보존되며 학생 목록에서는 숨겨집니다. 진행할까요?`
      )
    )
      return;
    setBusy(true);
    try {
      await window.api.archiveCurrentYear(label);
      setMessage(`${label}학년도 아카이브 완료. 새 명부는 상단 "명부 업로드"로 등록하세요.`);
      setYearLabel('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="section">
      <h2 className="section-title">학년도 전환</h2>
      <div className="card" style={{ maxWidth: 480 }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 12.5, marginTop: 0 }}>
          새 학년이 되면 현재 학생들을 지난 학년도로 아카이브하세요. 상담 기록·조치사항은 모두 보존되고, 학생 목록에서만 숨겨집니다.
        </p>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            className="input"
            placeholder="지난 학년도 (예: 2025)"
            value={yearLabel}
            onChange={(e) => setYearLabel(e.target.value)}
            style={{ maxWidth: 180 }}
          />
          <button className="btn btn-primary" disabled={busy || !yearLabel.trim()} onClick={handleArchive}>
            {busy ? '처리 중…' : '새 학년도 시작'}
          </button>
        </div>
        {message && <p style={{ color: 'var(--success)', fontSize: 12.5, marginTop: 8, marginBottom: 0 }}>{message}</p>}
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
                        <TrashIcon />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ display: 'flex', gap: 6, padding: 10 }}>
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
                        <TrashIcon />
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

const LOCK_TIMEOUT_KEY = 'lock_timeout_minutes';

function AppLockSettings({ onSettingsChanged }: { onSettingsChanged?: () => void }) {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [encryptionEnabled, setEncryptionEnabled] = useState(false);
  // 비밀번호가 이미 설정된 경우, 현재 비밀번호를 먼저 확인해야 변경/해제 폼이 열린다.
  const [verified, setVerified] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [lockTimeout, setLockTimeout] = useState('0');

  function refresh() {
    window.api.hasPassword().then((v) => {
      setHasPassword(v);
      setVerified(!v);
    });
    window.api.encryptionEnabled().then(setEncryptionEnabled);
    window.api.getSetting(LOCK_TIMEOUT_KEY).then((v) => setLockTimeout(v ?? '0'));
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
      onSettingsChanged?.();
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
      onSettingsChanged?.();
    } finally {
      setSaving(false);
    }
  }

  async function handleLockTimeoutChange(value: string) {
    setLockTimeout(value);
    await window.api.setSetting(LOCK_TIMEOUT_KEY, value);
    onSettingsChanged?.();
  }

  // 기록 암호화 켜기: 새 비밀번호가 곧 앱 진입 비밀번호가 된다.
  async function handleEnableEncryption() {
    setError(null);
    setMessage(null);
    if (newPassword !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    setSaving(true);
    try {
      const result = await window.api.enableEncryption(newPassword);
      if (!result.ok) {
        setError(result.error ?? '암호화를 켤 수 없습니다.');
        return;
      }
      setMessage('상담 기록 암호화가 켜졌습니다. 다음 실행부터 이 비밀번호로 기록을 엽니다.');
      resetForm();
      refresh();
      onSettingsChanged?.();
    } finally {
      setSaving(false);
    }
  }

  // 기록 암호화 끄기: 현재 비밀번호 확인 후 파일 키 방식으로 되돌린다.
  async function handleDisableEncryption() {
    setError(null);
    setMessage(null);
    if (!confirm('상담 기록 암호화를 해제할까요? 다음 실행부터 비밀번호 없이 기록이 열립니다. (백업 파일 암호화에는 별도 비밀번호를 계속 사용합니다)')) return;
    setSaving(true);
    try {
      const result = await window.api.disableEncryption(currentPassword);
      if (!result.ok) {
        setError(result.error ?? '해제에 실패했습니다.');
        return;
      }
      setMessage('상담 기록 암호화가 해제되었습니다.');
      resetForm();
      refresh();
      onSettingsChanged?.();
    } finally {
      setSaving(false);
    }
  }

  if (hasPassword === null) return null;

  // ---------- 기록 암호화(진입 비밀번호로 DB 암호화) ----------
  return (
    <div className="section">
      <h2 className="section-title">상담 기록 암호화</h2>
      <div className="card" style={{ maxWidth: 420 }}>
        {encryptionEnabled ? (
          <>
            <p style={{ color: 'var(--text-secondary)', marginTop: 0, fontSize: 13 }}>
              상담 기록이 비밀번호로 암호화되어 있습니다. 프로그램을 열 때마다 비밀번호를 입력해야 기록을 볼 수 있습니다.
              비밀번호를 잊으면 기록을 복구할 수 없으니 주의하세요.
            </p>
            {!verified ? (
              <>
                <div className="field">
                  <label className="field-label">현재 비밀번호</label>
                  <input
                    className="input"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
                {error && <p style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 10 }}>{error}</p>}
                {message && <p style={{ color: 'var(--success)', fontSize: 12.5, marginBottom: 10 }}>{message}</p>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" disabled={checking || !currentPassword} onClick={handleVerifyCurrent}>
                    {checking ? '확인 중…' : '비밀번호 확인'}
                  </button>
                  <button className="btn" style={{ color: 'var(--danger)' }} disabled={saving || !currentPassword} onClick={handleDisableEncryption}>
                    암호화 해제
                  </button>
                </div>
                <p style={{ color: 'var(--text-faint)', fontSize: 12, marginTop: 8, marginBottom: 0 }}>
                  암호화 해제는 현재 비밀번호 확인 후 진행됩니다. 비밀번호 변경은 아래 "앱 잠금"에서 하면 기록 암호화 비밀번호도 함께 바뀝니다.
                </p>
              </>
            ) : (
              <>
                {message && <p style={{ color: 'var(--success)', fontSize: 12.5, marginTop: 0 }}>{message}</p>}
                <p style={{ color: 'var(--text-faint)', fontSize: 12, marginBottom: 0 }}>
                  비밀번호가 확인되었습니다. 비밀번호를 변경하려면 아래 "앱 잠금" 섹션을 사용하세요 (기록 암호화 비밀번호도 함께 변경됩니다). 암호화를 해제하려면 앱을 다시 열고 이 화면에서 해제하세요.
                </p>
              </>
            )}
          </>
        ) : (
          <>
            <p style={{ color: 'var(--text-secondary)', marginTop: 0, fontSize: 13 }}>
              비밀번호를 설정하면 상담 기록 전체(DB 파일)가 그 비밀번호로 암호화됩니다.
              프로그램을 열 때마다 비밀번호를 입력해야 기록을 볼 수 있고, 파일만 복사해서는 내용을 알 수 없습니다.
            </p>
            <div className="field">
              <label className="field-label">진입 비밀번호 (4자 이상)</label>
              <input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">비밀번호 확인</label>
              <input className="input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            {error && <p style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 10 }}>{error}</p>}
            {message && <p style={{ color: 'var(--success)', fontSize: 12.5, marginBottom: 10 }}>{message}</p>}
            <button className="btn btn-primary" disabled={saving || !newPassword} onClick={handleEnableEncryption}>
              {saving ? '암호화 적용 중…' : '기록 암호화 켜기'}
            </button>
            <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 8, marginBottom: 0 }}>
              주의: 비밀번호를 잊으면 상담 기록을 복구할 수 없습니다. 반드시 기억할 수 있는 비밀번호를 사용하세요.
            </p>
          </>
        )}
      </div>

      <h2 className="section-title" style={{ marginTop: 14 }}>앱 잠금</h2>
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

        <div style={{ marginTop: 14, paddingTop: 12 }}>
          <label className="field-label">자동 잠금 (비밀번호 설정 시에만 동작)</label>
          <select className="select" value={lockTimeout} onChange={(e) => handleLockTimeoutChange(e.target.value)}>
            <option value="0">사용 안 함</option>
            <option value="5">5분 뒤 자동 잠금</option>
            <option value="10">10분 뒤 자동 잠금</option>
            <option value="30">30분 뒤 자동 잠금</option>
            <option value="60">1시간 뒤 자동 잠금</option>
          </select>
          <p style={{ color: 'var(--text-faint)', fontSize: 12, margin: '6px 0 0' }}>
            조작이 없으면 설정한 시간 뒤에 잠금 화면이 표시됩니다. 사이드바 "지금 잠금" 버튼으로 즉시 잠글 수도 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
