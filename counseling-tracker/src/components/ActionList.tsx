import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrashIcon, PlusIcon, EditIcon } from './icons';
import Modal from './Modal';

const REPEAT_OPTIONS = [
  { value: 0, label: '반복 없음' },
  { value: 7, label: '매주 (7일)' },
  { value: 14, label: '2주마다 (14일)' },
  { value: 30, label: '매월 (30일)' }
];

// 상담 이후 조치사항 위젯.
// recordId 또는 studentId 기준의 조치 목록을 보여주고, 추가/완료토글/마감일/반복/이행메모/삭제를 지원한다.
// 완료 시 완료일이 자동 기록되고, 반복 조치면 다음 기한으로 같은 조치가 자동 재생성된다.
export default function ActionList({
  recordId,
  studentId,
  showStudent = false,
  compact = false,
  pendingOnly = false,
  onChanged
}: {
  recordId?: number;
  studentId?: number;
  showStudent?: boolean;
  compact?: boolean;
  pendingOnly?: boolean;
  onChanged?: () => void;
}) {
  const navigate = useNavigate();
  const [actions, setActions] = useState<RecordAction[]>([]);
  const [text, setText] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [repeatDays, setRepeatDays] = useState(0);
  const [adding, setAdding] = useState(false);
  // 완료 메모 입력 모달
  const [completing, setCompleting] = useState<RecordAction | null>(null);
  const [doneNote, setDoneNote] = useState('');
  // 조치 수정 모달
  const [editingAction, setEditingAction] = useState<RecordAction | null>(null);
  const [editText, setEditText] = useState('');
  const [editDue, setEditDue] = useState('');
  const [editRepeat, setEditRepeat] = useState(0);

  function refresh() {
    window.api.getActions({ recordId, studentId, pendingOnly }).then(setActions);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId, studentId]);

  async function handleAdd() {
    if (!text.trim()) return;
    const result = await window.api.addAction({
      record_id: recordId ?? null,
      student_id: studentId ?? null,
      text: text.trim(),
      due_date: dueDate || null,
      repeat_days: repeatDays > 0 ? repeatDays : null
    });
    if (result.ok) {
      setText('');
      setDueDate('');
      setRepeatDays(0);
      setAdding(false);
      refresh();
      onChanged?.();
    }
  }

  async function toggleDone(a: RecordAction) {
    if (a.done) {
      // 완료 취소
      await window.api.updateAction(a.id, { done: false });
      refresh();
      onChanged?.();
    } else {
      // 완료 처리: 이행 메모를 남길 수 있게 모달 열기
      setCompleting(a);
      setDoneNote('');
    }
  }

  async function confirmComplete() {
    if (!completing) return;
    await window.api.updateAction(completing.id, { done: true, done_note: doneNote.trim() || null });
    setCompleting(null);
    refresh();
    onChanged?.();
  }

  function openEdit(a: RecordAction) {
    setEditingAction(a);
    setEditText(a.text);
    setEditDue(a.due_date ?? '');
    setEditRepeat(a.repeat_days ?? 0);
  }

  async function saveEdit() {
    if (!editingAction || !editText.trim()) return;
    await window.api.updateAction(editingAction.id, {
      text: editText.trim(),
      due_date: editDue || null,
      repeat_days: editRepeat > 0 ? editRepeat : null
    });
    setEditingAction(null);
    refresh();
    onChanged?.();
  }

  async function handleDelete(a: RecordAction) {
    if (!confirm('이 조치사항을 삭제할까요?')) return;
    await window.api.deleteAction(a.id);
    refresh();
    onChanged?.();
  }

  const pendingCount = actions.filter((a) => !a.done).length;

  return (
    <div>
      {!compact && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span className="field-label" style={{ marginBottom: 0 }}>
            조치사항 {pendingCount > 0 && <span style={{ color: 'var(--danger)' }}>({pendingCount}건 대기)</span>}
          </span>
          <button className="btn btn-sm" onClick={() => setAdding(true)}>
            <PlusIcon /> 조치 추가
          </button>
        </div>
      )}

      {adding && (
        <div className="card" style={{ background: 'var(--bg-panel)', marginBottom: 6, marginTop: compact ? 4 : 0 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              className="input"
              placeholder="상담 이후 할 일 (예: 보호자 전화 상담, Wee클래스 연계 확인)"
              value={text}
              autoFocus
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <input
              className="input"
              type="date"
              style={{ width: 140, flexShrink: 0 }}
              title="마감일(선택)"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            <select
              className="select"
              style={{ width: 130, flexShrink: 0 }}
              title="반복 주기(선택): 완료하면 다음 기한으로 자동 재생성"
              value={repeatDays}
              onChange={(e) => setRepeatDays(Number(e.target.value))}
            >
              {REPEAT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button className="btn btn-primary btn-sm" disabled={!text.trim()} onClick={handleAdd}>
              추가
            </button>
            <button
              className="btn btn-sm"
              onClick={() => {
                setAdding(false);
                setText('');
                setDueDate('');
                setRepeatDays(0);
              }}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {actions.length === 0 && !adding ? (
        <p style={{ color: 'var(--text-faint)', fontSize: 12, margin: '4px 0 0' }}>
          {pendingOnly ? '대기 중인 조치사항이 없습니다.' : '등록된 조치사항이 없습니다.'}
        </p>
      ) : (
        <div style={{ borderRadius: 2 }}>
          {actions.map((a) => {
            const overdue = !a.done && a.due_date && a.due_date < new Date().toISOString().slice(0, 10);
            return (
              <div key={a.id} className={'action-item' + (a.done ? ' done' : '')}>
                <input
                  type="checkbox"
                  checked={!!a.done}
                  onChange={() => toggleDone(a)}
                  title={a.done ? '미완료로 되돌리기' : '완료 처리 (이행 메모 남기기)'}
                  style={{ marginTop: 3 }}
                />
                <div className="action-text">
                  <div>
                    {a.text}
                    {a.repeat_days != null && a.repeat_days > 0 && (
                      <span style={{ color: 'var(--accent)', fontSize: 11, marginLeft: 6 }}>
                        반복 {a.repeat_days}일
                      </span>
                    )}
                  </div>
                  {(showStudent || a.due_date || a.done_date || a.record_id != null) && (
                    <div className="action-meta">
                      {showStudent && a.student_name && <span>{a.student_name}</span>}
                      {a.due_date && (
                        <span className={overdue ? 'action-due-warn' : undefined}>
                          마감 {a.due_date}
                          {overdue ? ' (지남)' : ''}
                        </span>
                      )}
                      {a.done_date && <span style={{ color: 'var(--success)' }}>완료 {a.done_date}</span>}
                      {a.record_date && <span>상담일 {a.record_date}</span>}
                      {a.record_id != null && (
                        <button
                          type="button"
                          className="badge-link"
                          style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent)', cursor: 'pointer', fontSize: 'inherit' }}
                          title="이 조치가 나온 상담 기록 열기"
                          onClick={() => navigate(`/search/${a.record_id}`)}
                        >
                          기록 열기
                        </button>
                      )}
                    </div>
                  )}
                  {a.done_note && (
                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>이행 메모: {a.done_note}</div>
                  )}
                </div>
                <button className="btn-icon" title="수정" onClick={() => openEdit(a)}>
                  <EditIcon />
                </button>
                <button className="btn-icon btn-icon-danger" title="삭제" onClick={() => handleDelete(a)}>
                  <TrashIcon />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {completing && (
        <Modal title="조치 완료 처리" onClose={() => setCompleting(null)} maxWidth={380}>
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 0 }}>{completing.text}</p>
          <div className="field">
            <label className="field-label">이행 메모 (선택 — 어떻게 이행했는지 남겨두면 기록 추적이 쉽습니다)</label>
            <textarea
              className="input"
              rows={3}
              value={doneNote}
              autoFocus
              onChange={(e) => setDoneNote(e.target.value)}
              placeholder="예: 보호자 전화 통화 완료, 향후 주 1회 관찰 약속"
            />
          </div>
          {completing.repeat_days != null && completing.repeat_days > 0 && (
            <p style={{ fontSize: 12, color: 'var(--accent)', marginTop: 0 }}>
              반복 조치입니다 — 완료하면 {completing.repeat_days}일 뒤 기한으로 같은 조치가 다시 생성됩니다.
            </p>
          )}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button className="btn btn-sm" onClick={() => setCompleting(null)}>
              취소
            </button>
            <button className="btn btn-primary btn-sm" onClick={confirmComplete}>
              완료 처리
            </button>
          </div>
        </Modal>
      )}

      {editingAction && (
        <Modal title="조치 수정" onClose={() => setEditingAction(null)} maxWidth={380}>
          <div className="field">
            <label className="field-label">내용</label>
            <input className="input" value={editText} autoFocus onChange={(e) => setEditText(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label">마감일</label>
            <input className="input" type="date" value={editDue} onChange={(e) => setEditDue(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label">반복 주기</label>
            <select className="select" value={editRepeat} onChange={(e) => setEditRepeat(Number(e.target.value))}>
              {REPEAT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button className="btn btn-sm" onClick={() => setEditingAction(null)}>
              취소
            </button>
            <button className="btn btn-primary btn-sm" disabled={!editText.trim()} onClick={saveEdit}>
              저장
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
