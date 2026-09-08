import { useEffect, useState } from 'react';
import { scoreColor } from './studentShared';
import { CloseIcon } from '../components/icons';
import Modal from '../components/Modal';

const RELATED_TYPES: RelatedType[] = ['학생', '보호자', '교사', '기타'];

// 상담/기록에서 "누구와의 갈등·관계인지"를 선택하는 공통 위젯.
// 학생끼리의 갈등이면 상대 학생을 검색해서 선택하고, 보호자·교사·기타면 자유 텍스트로 남긴다.
// 추가·수정은 모달 창에서 입력한다(인라인 폼 대신).
// 관계 점수는 항상 "이 기록의 학생(mainStudentName)이 상대를 어떻게 느끼는지"를 나타낸다 (그 반대가 아님).
export function RelationEditor({
  relations,
  setRelations,
  excludeStudentId,
  mainStudentName
}: {
  relations: RecordRelationInput[];
  setRelations: (r: RecordRelationInput[]) => void;
  excludeStudentId?: number | null;
  mainStudentName?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [type, setType] = useState<RelatedType>('학생');
  const [students, setStudents] = useState<Student[]>([]);
  const [query, setQuery] = useState('');
  const [pickedStudentId, setPickedStudentId] = useState<number | null>(null);
  const [label, setLabel] = useState('');
  const [score, setScore] = useState<number | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    if ((adding || relations.some((r) => r.related_type === '학생')) && students.length === 0) {
      window.api.getStudents().then(setStudents);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adding, relations, students.length]);

  const filtered = query && !pickedStudentId ? students.filter((s) => s.id !== excludeStudentId && s.name.includes(query)).slice(0, 6) : [];

  function resetForm() {
    setAdding(false);
    setEditIndex(null);
    setType('학생');
    setQuery('');
    setPickedStudentId(null);
    setLabel('');
    setScore(null);
    setNote('');
  }

  function startAdd() {
    resetForm();
    setAdding(true);
  }

  function startEdit(index: number) {
    const r = relations[index];
    setEditIndex(index);
    setType(r.related_type);
    setPickedStudentId(r.related_type === '학생' ? r.related_student_id ?? null : null);
    setQuery('');
    setLabel(r.related_type !== '학생' ? r.related_label ?? '' : '');
    setScore(r.relation_score ?? null);
    setNote(r.note ?? '');
    setAdding(true);
  }

  function handleSubmit() {
    let next: RecordRelationInput;
    if (type === '학생') {
      if (!pickedStudentId) return;
      next = { related_type: '학생', related_student_id: pickedStudentId, relation_score: score, note: note.trim() || null };
    } else {
      if (!label.trim()) return;
      next = { related_type: type, related_label: label.trim(), relation_score: score, note: note.trim() || null };
    }
    if (editIndex != null) {
      setRelations(relations.map((r, i) => (i === editIndex ? next : r)));
    } else {
      setRelations([...relations, next]);
    }
    resetForm();
  }

  function handleRemove(index: number) {
    setRelations(relations.filter((_, i) => i !== index));
    if (editIndex === index) resetForm();
  }

  function describe(r: RecordRelationInput) {
    if (r.related_type === '학생') {
      const student = students.find((s) => s.id === r.related_student_id);
      return student?.name ?? `학생 #${r.related_student_id}`;
    }
    return r.related_label ?? r.related_type;
  }

  const canSubmit = type === '학생' ? pickedStudentId != null : label.trim() !== '';

  return (
    <div>
      {relations.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {relations.map((r, i) => (
            <span key={i} className="badge" style={{ background: 'var(--bg-hover)', color: 'var(--text)' }}>
              <span style={{ cursor: 'pointer' }} title="클릭해서 수정" onClick={() => startEdit(i)}>
                {r.related_type} · {describe(r)}
                {r.relation_score != null && (
                  <span style={{ color: scoreColor(r.relation_score), fontWeight: 600 }}> · {r.relation_score}점</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(i)}
                title="삭제"
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: 0, marginLeft: 2 }}
              >
                <CloseIcon />
              </button>
            </span>
          ))}
        </div>
      )}

      <button type="button" className="btn" style={{ fontSize: 12.5 }} onClick={startAdd}>
        + 관련 대상 추가
      </button>

      {adding && (
        <Modal title={editIndex != null ? '관련 대상 수정' : '관련 대상 추가'} onClose={resetForm} maxWidth={440}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {RELATED_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                className="btn"
                disabled={editIndex != null}
                style={t === type ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' } : undefined}
                onClick={() => {
                  setType(t);
                  setPickedStudentId(null);
                  setQuery('');
                  setLabel('');
                }}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="field">
            {type === '학생' ? (
              <div style={{ position: 'relative' }}>
                <label className="field-label">상대 학생</label>
                <input
                  className="input"
                  placeholder="상대 학생 이름 검색"
                  value={pickedStudentId ? students.find((s) => s.id === pickedStudentId)?.name ?? '' : query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPickedStudentId(null);
                  }}
                  autoFocus
                />
                {filtered.length > 0 && (
                  <div className="card" style={{ position: 'absolute', zIndex: 10, marginTop: 4, padding: 4, width: '100%' }}>
                    {filtered.map((s) => (
                      <div
                        key={s.id}
                        className="dropdown-item"
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          setPickedStudentId(s.id);
                          setQuery('');
                        }}
                      >
                        {s.name}
                        {(s.grade != null || s.class_no != null || s.number != null) && (
                          <span style={{ color: 'var(--text-faint)' }}>
                            · {[s.grade != null ? `${s.grade}학년` : null, s.class_no != null ? `${s.class_no}반` : null, s.number != null ? `${s.number}번` : null].filter(Boolean).join(' ')}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="field-label">{type} 설명</label>
                <input className="input" placeholder={`예: 3반 담임교사`} value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
              </div>
            )}
          </div>

          <div className="field">
            <label className="field-label">
              {mainStudentName ?? '이 학생'}이(가) 상대를 어떻게 느끼는지 (1=갈등·나쁨 ~ 5=친밀·좋음, 선택)
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className="btn"
                  style={
                    score === n
                      ? { background: scoreColor(n), color: '#fff', borderColor: scoreColor(n), flex: 1, justifyContent: 'center' }
                      : { borderColor: scoreColor(n), color: scoreColor(n), flex: 1, justifyContent: 'center' }
                  }
                  onClick={() => setScore(score === n ? null : n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
              <span>갈등·나쁨</span>
              <span>친밀·좋음</span>
            </div>
          </div>

          <div className="field">
            <label className="field-label">비고</label>
            <input className="input" placeholder="관계 수준 등 자유롭게 기록" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 10, paddingTop: 10 }}>
            <button type="button" className="btn btn-primary" style={{ fontSize: 12.5 }} disabled={!canSubmit} onClick={handleSubmit}>
              {editIndex != null ? '수정 완료' : '추가'}
            </button>
            <button type="button" className="btn" style={{ fontSize: 12.5 }} onClick={resetForm}>
              취소
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
