import { useEffect, useState } from 'react';

const RELATED_TYPES: RelatedType[] = ['학생', '보호자', '교사', '기타'];

// 상담/기록에서 "누구와의 갈등·관계인지"를 선택하는 공통 위젯.
// 학생끼리의 갈등이면 상대 학생을 검색해서 선택하고, 보호자·교사·기타면 자유 텍스트로 남긴다.
export function RelationEditor({
  relations,
  setRelations,
  excludeStudentId
}: {
  relations: RecordRelationInput[];
  setRelations: (r: RecordRelationInput[]) => void;
  excludeStudentId?: number | null;
}) {
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState<RelatedType>('학생');
  const [students, setStudents] = useState<Student[]>([]);
  const [query, setQuery] = useState('');
  const [pickedStudentId, setPickedStudentId] = useState<number | null>(null);
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (adding && type === '학생' && students.length === 0) {
      window.api.getStudents().then(setStudents);
    }
  }, [adding, type, students.length]);

  const filtered = query && !pickedStudentId ? students.filter((s) => s.id !== excludeStudentId && s.name.includes(query)).slice(0, 6) : [];

  function resetForm() {
    setAdding(false);
    setType('학생');
    setQuery('');
    setPickedStudentId(null);
    setLabel('');
  }

  function handleAdd() {
    if (type === '학생') {
      if (!pickedStudentId) return;
      const student = students.find((s) => s.id === pickedStudentId);
      if (!student) return;
      setRelations([...relations, { related_type: '학생', related_student_id: pickedStudentId }]);
    } else {
      if (!label.trim()) return;
      setRelations([...relations, { related_type: type, related_label: label.trim() }]);
    }
    resetForm();
  }

  function handleRemove(index: number) {
    setRelations(relations.filter((_, i) => i !== index));
  }

  function describe(r: RecordRelationInput) {
    if (r.related_type === '학생') {
      const student = students.find((s) => s.id === r.related_student_id);
      return student?.name ?? `학생 #${r.related_student_id}`;
    }
    return r.related_label ?? r.related_type;
  }

  // 라벨 표시용으로 학생 목록을 미리 불러와둔다(칩에 이름을 보여주기 위함).
  useEffect(() => {
    if (relations.some((r) => r.related_type === '학생') && students.length === 0) {
      window.api.getStudents().then(setStudents);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relations]);

  return (
    <div>
      {relations.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {relations.map((r, i) => (
            <span key={i} className="badge" style={{ background: 'var(--bg-hover)', color: 'var(--text)' }}>
              {r.related_type} · {describe(r)}
              <button
                type="button"
                onClick={() => handleRemove(i)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: 0, marginLeft: 2, fontSize: 13 }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {!adding ? (
        <button type="button" className="btn" style={{ fontSize: 12.5 }} onClick={() => setAdding(true)}>
          + 관련 대상 추가
        </button>
      ) : (
        <div className="card" style={{ background: 'var(--bg-hover)', marginTop: 4 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {RELATED_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                className="btn"
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

          {type === '학생' ? (
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                placeholder="상대 학생 이름 검색"
                value={pickedStudentId ? students.find((s) => s.id === pickedStudentId)?.name ?? '' : query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPickedStudentId(null);
                }}
              />
              {filtered.length > 0 && (
                <div className="card" style={{ position: 'absolute', zIndex: 10, marginTop: 4, padding: 4, width: '100%' }}>
                  {filtered.map((s) => (
                    <div
                      key={s.id}
                      className="sidebar-link"
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setPickedStudentId(s.id);
                        setQuery('');
                      }}
                    >
                      {s.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <input className="input" placeholder={`${type} 설명 (예: 3반 담임교사)`} value={label} onChange={(e) => setLabel(e.target.value)} />
          )}

          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button type="button" className="btn btn-primary" style={{ fontSize: 12.5 }} onClick={handleAdd}>
              추가
            </button>
            <button type="button" className="btn-icon" title="취소" onClick={resetForm}>
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
