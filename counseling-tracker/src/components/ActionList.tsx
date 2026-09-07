import { useEffect, useState } from 'react';
import { TrashIcon, PlusIcon, CloseIcon, CheckIcon, EditIcon } from './icons';

// 상담 이후 조치사항 위젯.
// recordId 또는 studentId 기준의 조치 목록을 보여주고, 추가/완료토글/마감일/삭제를 지원한다.
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
  const [actions, setActions] = useState<RecordAction[]>([]);
  const [text, setText] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [adding, setAdding] = useState(false);

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
      due_date: dueDate || null
    });
    if (result.ok) {
      setText('');
      setDueDate('');
      setAdding(false);
      refresh();
      onChanged?.();
    }
  }

  async function toggleDone(a: RecordAction) {
    await window.api.updateAction(a.id, { done: !a.done });
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
        <div style={{ border: actions.length > 0 ? '1px solid var(--border)' : 'none', borderRadius: 2 }}>
          {actions.map((a) => {
            const overdue = !a.done && a.due_date && a.due_date < new Date().toISOString().slice(0, 10);
            return (
              <div key={a.id} className={'action-item' + (a.done ? ' done' : '')}>
                <input
                  type="checkbox"
                  checked={!!a.done}
                  onChange={() => toggleDone(a)}
                  title={a.done ? '미완료로 되돌리기' : '완료 처리'}
                  style={{ marginTop: 3 }}
                />
                <div className="action-text">
                  <div>{a.text}</div>
                  {(showStudent || a.due_date) && (
                    <div className="action-meta">
                      {showStudent && a.student_name && <span>{a.student_name}</span>}
                      {a.due_date && <span className={overdue ? 'action-due-warn' : undefined}>마감 {a.due_date}{overdue ? ' (지남)' : ''}</span>}
                      {a.record_date && <span>상담일 {a.record_date}</span>}
                    </div>
                  )}
                </div>
                <button className="btn-icon btn-icon-danger" title="삭제" onClick={() => handleDelete(a)}>
                  <TrashIcon />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
