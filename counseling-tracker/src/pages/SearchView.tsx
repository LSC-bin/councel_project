import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TrashIcon, EditIcon, FolderIcon, PlusIcon } from '../components/icons';
import { useContextMenu } from '../components/ContextMenu';
import Modal from '../components/Modal';

// 폴더 필터 값: 'all' = 전체, 'none' = 미분류, 숫자 = 폴더 id
type FolderFilter = 'all' | 'none' | number;

export default function SearchView() {
  const location = useLocation();
  const navigate = useNavigate();
  const ctx = useContextMenu();
  const navState = location.state as { studentId?: number; folderId?: number; studentQuery?: string } | null;

  const [types, setTypes] = useState<ConsultType[]>([]);
  const [folders, setFolders] = useState<RecordFolder[]>([]);
  const [folderFilter, setFolderFilter] = useState<FolderFilter>(navState?.folderId ?? 'all');
  const [newFolderName, setNewFolderName] = useState('');
  const [folderError, setFolderError] = useState<string | null>(null);

  const [studentQuery, setStudentQuery] = useState(navState?.studentQuery ?? '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [typeIds, setTypeIds] = useState<number[]>([]);

  const [records, setRecords] = useState<ConsultRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [movingRecord, setMovingRecord] = useState<ConsultRecord | null>(null);

  function refreshRecords() {
    window.api
      .getRecords({
        studentQuery: studentQuery || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        typeIds: typeIds.length > 0 ? typeIds : undefined,
        folderId: folderFilter === 'all' ? undefined : folderFilter === 'none' ? null : folderFilter,
        order: 'desc'
      })
      .then(setRecords)
      .finally(() => setLoading(false));
  }

  async function handleDeleteRecord(r: ConsultRecord) {
    if (!confirm(`${r.record_date} ${r.student_name} 기록을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    await window.api.deleteRecord(r.id);
    setRecords((cur) => cur.filter((x) => x.id !== r.id));
  }

  function refreshFolders() {
    window.api.getFolders().then(setFolders);
  }

  useEffect(() => {
    window.api.getConsultTypes().then(setTypes);
    refreshFolders();
  }, []);

  // 대시보드 등에서 특정 학생/폴더로 이동해온 경우 필터를 채운다.
  useEffect(() => {
    if (!navState?.studentId) return;
    window.api.getStudents(false).then((students) => {
      const s = students.find((st) => st.id === navState.studentId);
      if (s) setStudentQuery(s.name);
    });
  }, [navState?.studentId]);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      window.api
        .getRecords({
          studentQuery: studentQuery || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          typeIds: typeIds.length > 0 ? typeIds : undefined,
          folderId: folderFilter === 'all' ? undefined : folderFilter === 'none' ? null : folderFilter,
          order: 'desc'
        })
        .then(setRecords)
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [studentQuery, startDate, endDate, typeIds, folderFilter]);

  function toggleType(id: number) {
    setTypeIds((cur) => (cur.includes(id) ? cur.filter((t) => t !== id) : [...cur, id]));
  }

  async function handleAddFolder() {
    if (!newFolderName.trim()) return;
    setFolderError(null);
    const result = await window.api.addFolder(newFolderName);
    if (!result.ok) {
      setFolderError(result.error ?? '폴더를 만들 수 없습니다.');
      return;
    }
    setNewFolderName('');
    refreshFolders();
  }

  async function handleRenameFolder(f: RecordFolder) {
    const name = prompt('새 폴더 이름', f.name);
    if (name == null || name.trim() === '' || name === f.name) return;
    const result = await window.api.renameFolder(f.id, name);
    if (!result.ok) {
      alert(result.error ?? '이름을 바꿀 수 없습니다.');
      return;
    }
    refreshFolders();
  }

  async function handleDeleteFolder(f: RecordFolder) {
    if (!confirm(`폴더 "${f.name}"을(를) 삭제할까요? 안의 기록 ${f.record_count}건은 미분류로 되돌아갑니다.`)) return;
    await window.api.deleteFolder(f.id);
    if (folderFilter === f.id) setFolderFilter('all');
    refreshFolders();
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">조회·검색</h1>
        <p className="page-subtitle">폴더·학생·기간·유형으로 기록을 검색하고 정리합니다.</p>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* 좌: 폴더 패널 */}
        <div className="card" style={{ flex: '0 0 200px', padding: '8px 6px' }}>
          <div className="section-title" style={{ padding: '0 8px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
            <FolderIcon /> 상담 폴더
          </div>
          <div className="folder-list">
            <button
              type="button"
              className={'folder-item' + (folderFilter === 'all' ? ' active' : '')}
              onClick={() => setFolderFilter('all')}
            >
              전체 기록
            </button>
            <button
              type="button"
              className={'folder-item' + (folderFilter === 'none' ? ' active' : '')}
              onClick={() => setFolderFilter('none')}
            >
              미분류
            </button>
            {folders.map((f) => (
              <div
                key={f.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: folderFilter === f.id ? 'var(--accent-bg)' : undefined,
                  borderLeft: folderFilter === f.id ? '3px solid var(--accent)' : '3px solid transparent'
                }}
                onContextMenu={(e) =>
                  ctx.open(e, [
                    { label: '이 폴더 열기', onClick: () => setFolderFilter(f.id) },
                    { label: '이름 변경', onClick: () => handleRenameFolder(f) },
                    { label: '폴더 삭제', danger: true, separatorBefore: true, onClick: () => handleDeleteFolder(f) }
                  ])
                }
              >
                <button
                  type="button"
                  className="folder-item"
                  style={{ borderLeft: 'none', flex: 1 }}
                  onClick={() => setFolderFilter(f.id)}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  <span className="folder-count">{f.record_count}</span>
                </button>
                <button className="btn-icon" title="이름 변경" style={{ width: 20, height: 20 }} onClick={() => handleRenameFolder(f)}>
                  <EditIcon />
                </button>
                <button className="btn-icon btn-icon-danger" title="삭제" style={{ width: 20, height: 20 }} onClick={() => handleDeleteFolder(f)}>
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, padding: '8px 8px 2px' }}>
            <input
              className="input"
              placeholder="새 폴더 이름"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddFolder()}
            />
            <button className="btn btn-primary btn-sm" disabled={!newFolderName.trim()} onClick={handleAddFolder} title="폴더 추가">
              <PlusIcon />
            </button>
          </div>
          {folderError && <p style={{ color: 'var(--danger)', fontSize: 11.5, padding: '4px 8px 0', margin: 0 }}>{folderError}</p>}
        </div>

        {/* 우: 필터 + 결과 */}
        <div style={{ flex: '1 1 480px', minWidth: 0 }}>
          <div className="card" style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
              <div style={{ minWidth: 150 }}>
                <label className="field-label">학생명</label>
                <input
                  className="input"
                  placeholder="학생 이름"
                  value={studentQuery}
                  onChange={(e) => setStudentQuery(e.target.value)}
                />
              </div>
              <div>
                <label className="field-label">시작일</label>
                <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="field-label">종료일</label>
                <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label className="field-label">유형</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {types.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={'btn btn-sm' + (typeIds.includes(t.id) ? ' btn-primary' : '')}
                      onClick={() => toggleType(t.id)}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            {loading ? (
              <div className="empty-state">불러오는 중…</div>
            ) : records.length === 0 ? (
              <div className="empty-state">
                <div>조건에 맞는 기록이 없습니다.</div>
              </div>
            ) : (
              <table className="record-table">
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>학생</th>
                    <th>유형</th>
                    <th>내용</th>
                    <th>폴더</th>
                    <th>후속조치</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr
                      key={r.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/search/${r.id}`)}
                      onContextMenu={(e) =>
                        ctx.open(e, [
                          { label: '기록 열기', onClick: () => navigate(`/search/${r.id}`) },
                          { label: '학생 프로필', onClick: () => navigate(`/students/${r.student_id}`) },
                          { label: '폴더 이동…', onClick: () => setMovingRecord(r) },
                          {
                            label: r.follow_up_needed && !r.follow_up_done ? '후속조치 완료 처리' : '후속조치 필요 표시',
                            onClick: async () => {
                              const pending = !!(r.follow_up_needed && !r.follow_up_done);
                              // 대기 중이면 → 완료 처리 / 아니면 → 후속조치 필요(대기)로 표시
                              await window.api.updateRecord(r.id, { follow_up_needed: true, follow_up_done: pending });
                              refreshRecords();
                            }
                          },
                          { label: '기록 삭제', danger: true, separatorBefore: true, onClick: () => handleDeleteRecord(r) }
                        ])
                      }
                    >
                      <td style={{ whiteSpace: 'nowrap' }}>{r.record_date}</td>
                      <td>{r.student_name}</td>
                      <td>
                        <span className="badge" style={{ background: `${r.type_color}18`, color: r.type_color, border: `1px solid ${r.type_color}44` }}>
                          {r.type_name}
                        </span>
                      </td>
                      <td>{r.content?.slice(0, 30)}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{r.folder_name ?? '미분류'}</td>
                      <td>
                        {r.follow_up_needed ? (
                          <span style={{ color: r.follow_up_done ? 'var(--success)' : 'var(--danger)' }}>
                            {r.follow_up_done ? '완료' : '대기'}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-faint)' }}>-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {movingRecord && (
        <Modal title="기록 폴더 이동" onClose={() => setMovingRecord(null)} maxWidth={360}>
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 0 }}>
            {movingRecord.record_date} · {movingRecord.student_name} 기록을 이동할 폴더를 선택하세요.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button
              type="button"
              className="folder-item"
              style={{ border: '1px solid var(--border)' }}
              onClick={async () => {
                await window.api.updateRecord(movingRecord.id, { folder_id: null });
                setMovingRecord(null);
                refreshRecords();
              }}
            >
              미분류
            </button>
            {folders.map((f) => (
              <button
                key={f.id}
                type="button"
                className="folder-item"
                style={{ border: '1px solid var(--border)' }}
                onClick={async () => {
                  await window.api.updateRecord(movingRecord.id, { folder_id: f.id });
                  setMovingRecord(null);
                  refreshRecords();
                }}
              >
                {f.name}
              </button>
            ))}
          </div>
        </Modal>
      )}
      {ctx.element}
    </div>
  );
}
