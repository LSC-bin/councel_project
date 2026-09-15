import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FolderIcon, PlusIcon, ChevronRightIcon, DotsIcon, SortIcon } from '../components/icons';
import { useContextMenu } from '../components/ContextMenu';
import Modal from '../components/Modal';
import StudentFilter, { EMPTY_STUDENT_FILTER, type StudentFilterValue } from '../components/StudentFilter';

// 폴더 필터 값: 'all' = 전체, 'none' = 미분류, 숫자 = 폴더 id
type FolderFilter = 'all' | 'none' | number;
type SortKey = 'date' | 'name' | 'number';

export default function SearchView() {
  const location = useLocation();
  const navigate = useNavigate();
  const ctx = useContextMenu();
  const navState = location.state as { studentId?: number; folderId?: number; studentQuery?: string } | null;

  const [types, setTypes] = useState<ConsultType[]>([]);
  const [folders, setFolders] = useState<RecordFolder[]>([]);
  const [folderFilter, setFolderFilter] = useState<FolderFilter>(navState?.folderId ?? 'all');
  const [folderModal, setFolderModal] = useState<{ parentId: number | null } | null>(null);
  const [modalFolderName, setModalFolderName] = useState('');
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameCancelled = useRef(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const [studentFilter, setStudentFilter] = useState<StudentFilterValue>({
    query: navState?.studentQuery ?? '',
    grade: '',
    classNo: ''
  });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [typeIds, setTypeIds] = useState<number[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [records, setRecords] = useState<ConsultRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [movingRecord, setMovingRecord] = useState<ConsultRecord | null>(null);
  const [dragRecordId, setDragRecordId] = useState<number | null>(null);
  const [dragFolderId, setDragFolderId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | 'none' | 'root' | null>(null);

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
      if (s) setStudentFilter((f) => ({ ...f, query: s.name }));
    });
  }, [navState?.studentId]);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      window.api
        .getRecords({
          studentQuery: studentFilter.query || undefined,
          grade: studentFilter.grade === '' ? undefined : Number(studentFilter.grade),
          classNo: studentFilter.classNo === '' ? undefined : Number(studentFilter.classNo),
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          typeIds: typeIds.length > 0 ? typeIds : undefined,
          folderId: folderFilter === 'all' ? undefined : folderFilter === 'none' ? null : folderFilter,
          sortBy: sortKey,
          order: sortDir
        })
        .then(setRecords)
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [studentFilter, startDate, endDate, typeIds, folderFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'date' ? 'desc' : 'asc');
    }
  }

  async function handleAddFolder(name: string, parentId: number | null): Promise<boolean> {
    if (!name.trim()) return false;
    setFolderError(null);
    const result = await window.api.addFolder(name, parentId);
    if (!result.ok) {
      setFolderError(result.error ?? '폴더를 만들 수 없습니다.');
      return false;
    }
    if (parentId != null) setExpanded((cur) => new Set(cur).add(parentId));
    refreshFolders();
    return true;
  }

  function openFolderModal(parentId: number | null) {
    setModalFolderName('');
    setFolderError(null);
    setFolderModal({ parentId });
  }

  // 인라인 이름 변경: 행 안의 입력창에서 Enter/포커스 잃음 = 확정, Esc = 취소
  function startRename(f: RecordFolder) {
    renameCancelled.current = false;
    setRenamingId(f.id);
    setRenameValue(f.name);
  }

  async function commitRename(f: RecordFolder) {
    if (renameCancelled.current) {
      renameCancelled.current = false;
      setRenamingId(null);
      return;
    }
    const name = renameValue.trim();
    setRenamingId(null);
    if (!name || name === f.name) return;
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

  async function handleMoveFolder(id: number, targetParentId: number | null, beforeFolderId: number | null) {
    const result = await window.api.moveFolder(id, targetParentId, beforeFolderId);
    if (!result.ok) alert(result.error ?? '옮길 수 없습니다.');
    refreshFolders();
  }

  async function handleDropRecordOnFolder(recordId: number, folderId: number | null) {
    await window.api.updateRecord(recordId, { folder_id: folderId });
    setDragRecordId(null);
    setDropTarget(null);
    setRecords((cur) => cur.map((r) => (r.id === recordId ? { ...r, folder_id: folderId } : r)));
    refreshFolders();
  }

  // 폴더 트리 구성
  const folderTree = useMemo(() => {
    const childrenOf = (parentId: number | null): RecordFolder[] =>
      folders
        .filter((f) => (f.parent_id ?? null) === parentId)
        .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999) || a.name.localeCompare(b.name));
    return childrenOf;
  }, [folders]);

  // 폴더 id → 자기 자신 + 하위 폴더 전체의 기록 수 합계
  const subtreeCount = (folderId: number): number => {
    let total = 0;
    const stack = [folderId];
    while (stack.length > 0) {
      const id = stack.pop()!;
      const f = folders.find((x) => x.id === id);
      if (f) total += f.record_count;
      for (const c of folders.filter((x) => (x.parent_id ?? null) === id)) stack.push(c.id);
    }
    return total;
  };

  function openFolder(f: RecordFolder) {
    setFolderFilter(f.id);
    // 클릭한 폴더를 트리에 펼쳐 하위 폴더가 바로 보이게 한다.
    setExpanded((cur) => new Set(cur).add(f.id));
  }

  function renderFolderRow(f: RecordFolder, depth: number): React.ReactNode {
    const kids = folderTree(f.id);
    const isOpen = expanded.has(f.id);
    return (
      <div key={f.id}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: folderFilter === f.id ? 'var(--accent-bg)' : undefined,
            outline: dropTarget === f.id ? '2px solid var(--accent)' : undefined,
            outlineOffset: -2
          }}
          draggable
          onDragStart={(e) => {
            e.stopPropagation();
            setDragFolderId(f.id);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragEnd={() => {
            setDragFolderId(null);
            setDropTarget(null);
          }}
          onDragOver={(e) => {
            if (dragFolderId == null && dragRecordId == null) return;
            e.preventDefault();
            e.stopPropagation();
            setDropTarget(f.id);
          }}
          onDragLeave={() => setDropTarget((t) => (t === f.id ? null : t))}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (dragRecordId != null) {
              handleDropRecordOnFolder(dragRecordId, f.id);
            } else if (dragFolderId != null && dragFolderId !== f.id) {
              // 폴더를 폴더 위에 놓으면 하위로 이동(맨 뒤)
              handleMoveFolder(dragFolderId, f.id, null);
              setExpanded((cur) => new Set(cur).add(f.id));
            }
            setDragFolderId(null);
            setDropTarget(null);
          }}
          onContextMenu={(e) => ctx.open(e, folderMenuItems(f))}
        >
          <button
            type="button"
            className="btn-icon"
            style={{ width: 18, height: 18, marginLeft: 4 + depth * 14, flexShrink: 0 }}
            title={isOpen ? '접기' : '펼치기'}
            onClick={() =>
              setExpanded((cur) => {
                const next = new Set(cur);
                if (next.has(f.id)) next.delete(f.id);
                else next.add(f.id);
                return next;
              })
            }
          >
            <span style={{ transform: isOpen ? 'rotate(90deg)' : undefined, display: 'inline-flex', transition: 'transform 0.1s' }}>
              <ChevronRightIcon />
            </span>
          </button>
          {renamingId === f.id ? (
            <input
              className="input folder-rename-input"
              style={{ flex: 1, marginLeft: 4, padding: '2px 6px', fontSize: 12.5 }}
              value={renameValue}
              autoFocus
              onChange={(e) => setRenameValue(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename(f);
                else if (e.key === 'Escape') {
                  renameCancelled.current = true;
                  setRenamingId(null);
                }
              }}
              onBlur={() => commitRename(f)}
            />
          ) : (
            <button
              type="button"
              className="folder-item"
              style={{ flex: 1, paddingLeft: 4 }}
              title="클릭: 이 폴더와 하위 폴더의 기록을 모두 봅니다 · 더블클릭: 이름 변경"
              onClick={() => openFolder(f)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                startRename(f);
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
              <span className="folder-count">{subtreeCount(f.id)}</span>
            </button>
          )}
          {/* 점3개 메뉴: 폴더 관리(추가·이름 변경·삭제) */}
          <button
            type="button"
            className="btn-icon"
            style={{ width: 22, height: 22, flexShrink: 0 }}
            title="폴더 메뉴"
            onClick={(e) => ctx.open(e, folderMenuItems(f))}
          >
            <DotsIcon />
          </button>
        </div>
        {isOpen && kids.map((k) => renderFolderRow(k, depth + 1))}
      </div>
    );
  }

  function folderMenuItems(f: RecordFolder): import('../components/ContextMenu').ContextMenuItem[] {
    return [
      { label: '이 폴더 열기', onClick: () => openFolder(f) },
      {
        label: '하위 폴더 만들기',
        onClick: () => openFolderModal(f.id)
      },
      { label: '이름 변경', onClick: () => startRename(f) },
      { label: '폴더 삭제', danger: true, separatorBefore: true, onClick: () => handleDeleteFolder(f) }
    ];
  }

  const rootFolders = folderTree(null);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">조회·검색</h1>
        <p className="page-subtitle">
          폴더·학생·기간·유형으로 기록을 검색하고 정리합니다. 기록 행을 폴더로 끌어다 놓으면 이동됩니다.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* 좌: 폴더 패널 */}
        <div className="card" style={{ flex: '0 0 220px', padding: '8px 6px' }}>
          <div className="section-title" style={{ padding: '0 8px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
            <FolderIcon /> 상담 폴더
            <button
              className="btn-icon"
              title="최상위 폴더 만들기"
              style={{ marginLeft: 'auto', width: 20, height: 20 }}
              onClick={() => openFolderModal(null)}
            >
              <PlusIcon />
            </button>
          </div>
          <div
            className="folder-list"
            onDragOver={(e) => {
              // 폴더를 트리 바깥(목록 여백)에 놓으면 최상위로 이동
              if (dragFolderId == null) return;
              e.preventDefault();
              setDropTarget((t) => (t === 'root' ? t : 'root'));
            }}
            onDrop={(e) => {
              if (dragFolderId == null) return;
              e.preventDefault();
              handleMoveFolder(dragFolderId, null, null);
              setDragFolderId(null);
              setDropTarget(null);
            }}
            style={{ outline: dropTarget === 'root' ? '2px dashed var(--accent)' : undefined, outlineOffset: -2 }}
          >
            <button
              type="button"
              className={'folder-item' + (folderFilter === 'all' ? ' active' : '')}
              onClick={() => setFolderFilter('all')}
              onDragOver={(e) => {
                if (dragRecordId == null) return;
                e.preventDefault();
                setDropTarget('none');
              }}
              onDrop={(e) => {
                if (dragRecordId == null) return;
                e.preventDefault();
                handleDropRecordOnFolder(dragRecordId, null);
              }}
            >
              전체 기록
            </button>
            <button
              type="button"
              className={'folder-item' + (folderFilter === 'none' ? ' active' : '')}
              style={{ outline: dropTarget === 'none' ? '2px solid var(--accent)' : undefined, outlineOffset: -2 }}
              onClick={() => setFolderFilter('none')}
              onDragOver={(e) => {
                if (dragRecordId == null) return;
                e.preventDefault();
                setDropTarget('none');
              }}
              onDragLeave={() => setDropTarget((t) => (t === 'none' ? null : t))}
              onDrop={(e) => {
                if (dragRecordId == null) return;
                e.preventDefault();
                handleDropRecordOnFolder(dragRecordId, null);
              }}
            >
              미분류
            </button>
            {rootFolders.map((f) => renderFolderRow(f, 0))}
          </div>
          {folderError && <p style={{ color: 'var(--danger)', fontSize: 11.5, padding: '4px 8px 0', margin: 0 }}>{folderError}</p>}
          <p style={{ color: 'var(--text-faint)', fontSize: 11, padding: '6px 8px 0', margin: 0 }}>
            폴더를 폴더 위로 끌면 하위로, 목록 여백으로 끌면 최상위로 이동합니다. 더블클릭 또는 점3개 메뉴로 이름을 바꿉니다.
          </p>
        </div>

        {/* 우: 필터 + 결과 */}
        <div style={{ flex: '1 1 480px', minWidth: 0 }}>
          <div className="card" style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 260px', minWidth: 220 }}>
                <label className="field-label">학생 찾기</label>
                <StudentFilter
                  value={studentFilter}
                  onChange={setStudentFilter}
                  types={types}
                  typeIds={typeIds}
                  onTypeIdsChange={setTypeIds}
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
              <span style={{ fontSize: 11.5, color: 'var(--text-faint)', marginLeft: 'auto' }}>
                결과 {records.length}건 · 열 머리글 클릭으로 정렬
              </span>
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
                    <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('date')} title="클릭: 날짜 정렬 전환">
                      날짜 {sortKey === 'date' && <SortIcon dir={sortDir} />}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('name')} title="클릭: 이름 정렬 전환">
                      학생 {sortKey === 'name' && <SortIcon dir={sortDir} />}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('number')} title="클릭: 학년·반·번호 정렬 전환">
                      학년/반/번호 {sortKey === 'number' && <SortIcon dir={sortDir} />}
                    </th>
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
                      style={{ cursor: 'pointer', opacity: dragRecordId === r.id ? 0.4 : 1 }}
                      draggable
                      onDragStart={(e) => {
                        setDragRecordId(r.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => {
                        setDragRecordId(null);
                        setDropTarget(null);
                      }}
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
                              await window.api.updateRecord(r.id, { follow_up_needed: true, follow_up_done: pending });
                              setRecords((cur) =>
                                cur.map((x) => (x.id === r.id ? { ...x, follow_up_needed: 1, follow_up_done: pending ? 1 : 0 } : x))
                              );
                            }
                          },
                          {
                            label: '기록 삭제',
                            danger: true,
                            separatorBefore: true,
                            onClick: async () => {
                              if (!confirm(`${r.record_date} ${r.student_name} 기록을 삭제할까요? 되돌릴 수 없습니다.`)) return;
                              await window.api.deleteRecord(r.id);
                              setRecords((cur) => cur.filter((x) => x.id !== r.id));
                            }
                          }
                        ])
                      }
                    >
                      <td style={{ whiteSpace: 'nowrap' }}>{r.record_date}</td>
                      <td>{r.student_name}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                        {r.student_grade != null || r.student_class_no != null || r.student_number != null
                          ? [
                              r.student_grade != null ? `${r.student_grade}학년` : null,
                              r.student_class_no != null ? `${r.student_class_no}반` : null,
                              r.student_number != null ? `${r.student_number}번` : null
                            ]
                              .filter(Boolean)
                              .join(' ')
                          : '-'}
                      </td>
                      <td>
                        <span className="badge" style={{ background: `${r.type_color}18`, color: r.type_color }}>
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

      {folderModal && (
        <Modal
          title={folderModal.parentId != null ? `하위 폴더 만들기 — ${folders.find((x) => x.id === folderModal.parentId)?.name ?? ''}` : '최상위 폴더 만들기'}
          onClose={() => setFolderModal(null)}
          maxWidth={340}
        >
          <div className="field" style={{ marginBottom: 10 }}>
            <label className="field-label">폴더 이름</label>
            <input
              className="input"
              autoFocus
              placeholder="예: 위기학생 관리"
              value={modalFolderName}
              onChange={(e) => setModalFolderName(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key !== 'Enter') return;
                const ok = await handleAddFolder(modalFolderName, folderModal.parentId);
                if (ok) setFolderModal(null);
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-sm" onClick={() => setFolderModal(null)}>
              취소
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!modalFolderName.trim()}
              onClick={async () => {
                const ok = await handleAddFolder(modalFolderName, folderModal.parentId);
                if (ok) setFolderModal(null);
              }}
            >
              만들기
            </button>
          </div>
        </Modal>
      )}

      {movingRecord && (
        <Modal title="기록 폴더 이동" onClose={() => setMovingRecord(null)} maxWidth={360}>
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 0 }}>
            {movingRecord.record_date} · {movingRecord.student_name} 기록을 이동할 폴더를 선택하세요.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
            <button
              type="button"
              className="folder-item"
              onClick={async () => {
                await window.api.updateRecord(movingRecord.id, { folder_id: null });
                setMovingRecord(null);
                refreshFolders();
                setRecords((cur) => cur.map((x) => (x.id === movingRecord.id ? { ...x, folder_id: null, folder_name: null } : x)));
              }}
            >
              미분류
            </button>
            {(() => {
              const rows: React.ReactNode[] = [];
              const walk = (parentId: number | null, depth: number) => {
                for (const f of folders
                  .filter((x) => (x.parent_id ?? null) === parentId)
                  .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999) || a.name.localeCompare(b.name))) {
                  rows.push(
                    <button
                      key={f.id}
                      type="button"
                      className="folder-item"
                      style={{ paddingLeft: 8 + depth * 14 }}
                      onClick={async () => {
                        await window.api.updateRecord(movingRecord.id, { folder_id: f.id });
                        setMovingRecord(null);
                        refreshFolders();
                        setRecords((cur) => cur.map((x) => (x.id === movingRecord.id ? { ...x, folder_id: f.id, folder_name: f.name } : x)));
                      }}
                    >
                      {f.name}
                    </button>
                  );
                  walk(f.id, depth + 1);
                }
              };
              walk(null, 0);
              return rows;
            })()}
          </div>
        </Modal>
      )}
      {ctx.element}
    </div>
  );
}
