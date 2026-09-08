import { useEffect, useState } from 'react';

export default function ReportExport() {
  const [snapshots, setSnapshots] = useState<{ name: string; size: number; modified: string }[]>([]);
  const [snapshotMsg, setSnapshotMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  function refreshSnapshots() {
    window.api.listAutoSnapshots().then(setSnapshots);
  }

  useEffect(() => {
    refreshSnapshots();
  }, []);

  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [backupPath, setBackupPath] = useState<string | null>(null);
  const [backupMode, setBackupMode] = useState<'none' | 'create' | 'restore'>('none');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [restorePath, setRestorePath] = useState<string | null>(null);

  async function handleAnonymized() {
    setBusy('anon');
    setMessage(null);
    try {
      const r = await window.api.exportAnonymizedReport();
      if (!r.canceled && r.filePath) setMessage({ tone: 'ok', text: `익명화 통계 파일을 저장했습니다: ${r.filePath}` });
    } finally {
      setBusy(null);
    }
  }

  async function handleStartBackup() {
    setMessage(null);
    const r = await window.api.createBackupDialog();
    if (r.canceled || !r.filePath) return;
    setBackupPath(r.filePath);
    setBackupMode('create');
    setPw('');
    setPw2('');
  }

  async function handleConfirmBackup() {
    if (!backupPath) return;
    if (pw.length < 4) {
      setMessage({ tone: 'err', text: '백업 비밀번호는 4자 이상이어야 합니다.' });
      return;
    }
    if (pw !== pw2) {
      setMessage({ tone: 'err', text: '비밀번호가 일치하지 않습니다.' });
      return;
    }
    setBusy('backup');
    try {
      const r = await window.api.createBackupWithPassword(pw, backupPath);
      if (r.ok) {
        setMessage({ tone: 'ok', text: `암호화 백업을 저장했습니다: ${backupPath} — 비밀번호를 잊으면 복원할 수 없으니 안전하게 보관하세요.` });
        setBackupMode('none');
        setBackupPath(null);
      } else {
        setMessage({ tone: 'err', text: `백업 실패: ${r.error}` });
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleStartRestore() {
    setMessage(null);
    const r = await window.api.restoreBackupDialog();
    if (r.canceled || !r.filePath) return;
    setRestorePath(r.filePath);
    setBackupMode('restore');
    setPw('');
  }

  async function handleConfirmRestore() {
    if (!restorePath) return;
    if (!confirm('복원하면 현재 데이터가 백업 시점 데이터로 대체됩니다. 진행할까요?')) return;
    setBusy('restore');
    try {
      const r = await window.api.restoreBackupWithPassword(pw, restorePath);
      if (r.ok) {
        setMessage({ tone: 'ok', text: '복원 완료. 화면 데이터를 새로 불러오려면 앱을 다시 시작하세요.' });
        setBackupMode('none');
        setRestorePath(null);
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setMessage({ tone: 'err', text: r.error ?? '복원에 실패했습니다.' });
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">보고서·백업</h1>
        <p className="page-subtitle">익명화 통계 내보내기와 암호화 백업·복원을 관리합니다.</p>
      </div>

      {message && (
        <div className={'banner ' + (message.tone === 'ok' ? 'banner-info' : '')} style={{ cursor: 'default' }}>
          <span className="banner-icon">{message.tone === 'ok' ? '✓' : '!'}</span>
          <span>{message.text}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: '1 1 300px' }}>
          <div className="section-title">익명화 통계 내보내기</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12.5, marginTop: 0 }}>
            학생명을 A학생·B학생…으로 치환한 엑셀 통계를 생성합니다. 회의·보고용으로 개인정보를 드러내지 않고 공유할 수 있습니다.
          </p>
          <button className="btn btn-primary" disabled={busy === 'anon'} onClick={handleAnonymized}>
            {busy === 'anon' ? '생성 중…' : '엑셀 내보내기'}
          </button>
        </div>

        <div className="card" style={{ flex: '1 1 340px' }}>
          <div className="section-title">암호화 백업 / 복원</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12.5, marginTop: 0 }}>
            모든 상담 데이터를 비밀번호 기반 AES-256 암호화 파일(.backup)로 저장합니다. PC 교체나 인수인계 시 이 파일 하나면 전체 기록을 옮길 수 있습니다.
          </p>

          {backupMode === 'none' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={handleStartBackup}>
                백업 만들기
              </button>
              <button className="btn" onClick={handleStartRestore}>
                복원하기
              </button>
            </div>
          )}

          {backupMode === 'create' && (
            <div>
              <div className="field">
                <label className="field-label">백업 비밀번호 (4자 이상)</label>
                <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
              </div>
              <div className="field">
                <label className="field-label">비밀번호 확인</label>
                <input className="input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" disabled={busy === 'backup' || !pw} onClick={handleConfirmBackup}>
                  {busy === 'backup' ? '저장 중…' : '암호화 백업 저장'}
                </button>
                <button className="btn" onClick={() => setBackupMode('none')}>
                  취소
                </button>
              </div>
            </div>
          )}

          {backupMode === 'restore' && (
            <div>
              <div className="field">
                <label className="field-label">백업 비밀번호</label>
                <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }} disabled={busy === 'restore' || !pw} onClick={handleConfirmRestore}>
                  {busy === 'restore' ? '복원 중…' : '복원 실행'}
                </button>
                <button className="btn" onClick={() => setBackupMode('none')}>
                  취소
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 10 }}>
        <div className="section-title">자동 백업 스냅샷</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 12.5, marginTop: 0 }}>
          앱이 시작할 때와 30분마다 이 PC에 암호화 스냅샷을 자동 저장합니다(최근 7개 보관). 실수로 데이터를 지웠을 때 직전 상태로 되돌릴 수 있습니다.
        </p>
        {snapshotMsg && (
          <p style={{ fontSize: 12.5, color: snapshotMsg.tone === 'ok' ? 'var(--success)' : 'var(--danger)' }}>{snapshotMsg.text}</p>
        )}
        {snapshots.length === 0 ? (
          <p style={{ color: 'var(--text-faint)', fontSize: 12.5 }}>저장된 스냅샷이 없습니다.</p>
        ) : (
          <table className="record-table">
            <thead>
              <tr>
                <th>스냅샷</th>
                <th>저장 시각</th>
                <th>크기</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s) => (
                <tr key={s.name}>
                  <td>{s.name}</td>
                  <td>{new Date(s.modified).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</td>
                  <td>{(s.size / 1024).toFixed(0)} KB</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-sm"
                      onClick={async () => {
                        if (!confirm(`이 스냅샷(${s.name}) 상태로 되돌리면 이후 변경사항은 사라집니다. 진행할까요?`)) return;
                        const r = await window.api.restoreAutoSnapshot(s.name);
                        if (r.ok) {
                          setSnapshotMsg({ tone: 'ok', text: '복원 완료. 화면을 새로고침합니다.' });
                          setTimeout(() => window.location.reload(), 1200);
                        } else {
                          setSnapshotMsg({ tone: 'err', text: r.error ?? '복원에 실패했습니다.' });
                        }
                      }}
                    >
                      복원
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button
          className="btn"
          style={{ marginTop: 8 }}
          onClick={async () => {
            const r = await window.api.createAutoSnapshot();
            if (r.ok) {
              setSnapshotMsg({ tone: 'ok', text: '스냅샷을 지금 저장했습니다.' });
              refreshSnapshots();
            } else {
              setSnapshotMsg({ tone: 'err', text: r.error ?? '스냅샷 저장 실패' });
            }
          }}
        >
          지금 스냅샷 저장
        </button>
      </div>
    </div>
  );
}
