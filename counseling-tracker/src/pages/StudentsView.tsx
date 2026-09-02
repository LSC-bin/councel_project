import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function StudentsView() {
  const [students, setStudents] = useState<StudentWithStats[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  function refresh() {
    setLoading(true);
    window.api
      .getStudentsWithStats()
      .then(setStudents)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    if (!query) return students;
    return students.filter((s) => s.name.includes(query) || (s.student_no ?? '').includes(query));
  }, [students, query]);

  const selected = filtered.find((s) => s.id === selectedId) ?? students.find((s) => s.id === selectedId) ?? null;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">학생 관리</h1>
        <p className="page-subtitle">학생 정보를 확인·수정하고, 학생별 상담 이력을 한눈에 봅니다.</p>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: selected ? '1 1 40%' : '1 1 100%' }}>
          <div className="card" style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
            <input
              className="input"
              placeholder="이름 또는 학번 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="btn btn-primary" style={{ whiteSpace: 'nowrap' }} onClick={() => setAdding(true)}>
              + 학생 추가
            </button>
          </div>

          {adding && (
            <AddStudentForm
              onCancel={() => setAdding(false)}
              onAdded={(s) => {
                setAdding(false);
                refresh();
                setSelectedId(s.id);
              }}
            />
          )}

          <div className="card" style={{ padding: 0 }}>
            {loading ? (
              <div className="empty-state">불러오는 중…</div>
            ) : filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">☺</div>
                <div>{students.length === 0 ? '등록된 학생이 없습니다.' : '검색 결과가 없습니다.'}</div>
              </div>
            ) : (
              <table className="record-table">
                <thead>
                  <tr>
                    <th>이름</th>
                    <th>학번</th>
                    <th>반</th>
                    <th>상담 건수</th>
                    <th>최근 상담</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedId(s.id)}>
                      <td>
                        {!!s.pinned && <span style={{ color: 'var(--accent)', marginRight: 4 }}>★</span>}
                        {s.name}
                      </td>
                      <td>{s.student_no ?? '-'}</td>
                      <td>{s.class_name ?? '-'}</td>
                      <td>{s.record_count}</td>
                      <td>{s.last_record_date ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {selected && (
          <StudentDetailPanel
            key={selected.id}
            student={selected}
            onClose={() => setSelectedId(null)}
            onChanged={refresh}
            onDeleted={() => {
              setSelectedId(null);
              refresh();
            }}
          />
        )}
      </div>
    </div>
  );
}

function AddStudentForm({ onCancel, onAdded }: { onCancel: () => void; onAdded: (s: Student) => void }) {
  const [name, setName] = useState('');
  const [studentNo, setStudentNo] = useState('');
  const [className, setClassName] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const student = await window.api.addStudent({
        name: name.trim(),
        student_no: studentNo || null,
        class_name: className || null
      });
      onAdded(student);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 140px' }}>
          <label className="field-label">이름 *</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div style={{ flex: '1 1 100px' }}>
          <label className="field-label">학번</label>
          <input className="input" value={studentNo} onChange={(e) => setStudentNo(e.target.value)} />
        </div>
        <div style={{ flex: '1 1 100px' }}>
          <label className="field-label">반</label>
          <input className="input" value={className} onChange={(e) => setClassName(e.target.value)} />
        </div>
        <button className="btn btn-primary" disabled={saving || !name.trim()} onClick={handleAdd}>
          추가
        </button>
        <button className="btn" onClick={onCancel}>
          취소
        </button>
      </div>
    </div>
  );
}

function StudentDetailPanel({
  student,
  onClose,
  onChanged,
  onDeleted
}: {
  student: StudentWithStats;
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(student.name);
  const [studentNo, setStudentNo] = useState(student.student_no ?? '');
  const [className, setClassName] = useState(student.class_name ?? '');
  const [saving, setSaving] = useState(false);

  const [summary, setSummary] = useState<StudentSummary | null>(null);
  const [records, setRecords] = useState<ConsultRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    setName(student.name);
    setStudentNo(student.student_no ?? '');
    setClassName(student.class_name ?? '');
    setEditing(false);
    setLoadingHistory(true);
    Promise.all([window.api.getStudentSummary(student.id), window.api.getRecords({ studentId: student.id, order: 'desc' })])
      .then(([s, r]) => {
        setSummary(s);
        setRecords(r);
      })
      .finally(() => setLoadingHistory(false));
  }, [student.id]);

  async function handleTogglePin() {
    await window.api.togglePin(student.id);
    onChanged();
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await window.api.updateStudent(student.id, {
        name: name.trim(),
        student_no: studentNo || null,
        class_name: className || null
      });
      setEditing(false);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`${student.name} 학생을 삭제할까요? 이 학생의 상담 기록도 모두 함께 삭제되며 되돌릴 수 없습니다.`)) return;
    await window.api.deleteStudent(student.id);
    onDeleted();
  }

  return (
    <div className="card" style={{ flex: '1 1 55%', position: 'sticky', top: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>
            {student.name}
            <button
              className="btn"
              style={{ marginLeft: 8, padding: '2px 8px', color: student.pinned ? 'var(--accent)' : undefined }}
              onClick={handleTogglePin}
              title="즐겨찾기"
            >
              {student.pinned ? '★ 고정됨' : '☆ 고정'}
            </button>
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 12.5, marginTop: 2 }}>
            {student.student_no ?? '학번 없음'} · {student.class_name ?? '반 미지정'}
          </div>
        </div>
        <button className="btn" onClick={onClose}>
          닫기
        </button>
      </div>

      {!editing ? (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button className="btn btn-primary" onClick={() => navigate('/input', { state: { studentId: student.id, studentName: student.name } })}>
            상담 기록 추가
          </button>
          <button className="btn" onClick={() => setEditing(true)}>
            정보 수정
          </button>
          <button className="btn" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={handleDelete}>
            삭제
          </button>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 140px' }}>
              <label className="field-label">이름</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div style={{ flex: '1 1 100px' }}>
              <label className="field-label">학번</label>
              <input className="input" value={studentNo} onChange={(e) => setStudentNo(e.target.value)} />
            </div>
            <div style={{ flex: '1 1 100px' }}>
              <label className="field-label">반</label>
              <input className="input" value={className} onChange={(e) => setClassName(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn btn-primary" disabled={saving || !name.trim()} onClick={handleSave}>
              저장
            </button>
            <button className="btn" onClick={() => setEditing(false)}>
              취소
            </button>
          </div>
        </div>
      )}

      {summary && (
        <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 16 }}>
          <MiniMetric label="총 상담 건수" value={summary.totalCount} />
          <MiniMetric label="후속조치 대기" value={summary.followUpPending} />
          <MiniMetric label="최근 상담일" value={summary.lastRecordDate ?? '-'} />
        </div>
      )}

      <div className="section-title">상담 이력</div>
      {loadingHistory ? (
        <div className="empty-state">불러오는 중…</div>
      ) : records.length === 0 ? (
        <div className="empty-state" style={{ padding: '24px 10px' }}>
          아직 상담 기록이 없습니다.
        </div>
      ) : (
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          <table className="record-table">
            <thead>
              <tr>
                <th>날짜</th>
                <th>유형</th>
                <th>내용</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{r.record_date}</td>
                  <td>
                    <span className="badge" style={{ background: `${r.type_color}22`, color: r.type_color }}>
                      <span className="badge-dot" style={{ background: r.type_color }} />
                      {r.type_name}
                    </span>
                  </td>
                  <td>{r.content?.slice(0, 30)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric-card" style={{ padding: '10px 12px' }}>
      <div className="metric-label" style={{ marginBottom: 3 }}>
        {label}
      </div>
      <div className="metric-value" style={{ fontSize: 18 }}>
        {value}
      </div>
    </div>
  );
}
