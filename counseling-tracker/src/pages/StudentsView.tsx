import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

function formatClassInfo(s: { grade: number | null; class_no: number | null; number: number | null }) {
  if (s.grade == null && s.class_no == null && s.number == null) return '-';
  const parts = [
    s.grade != null ? `${s.grade}학년` : null,
    s.class_no != null ? `${s.class_no}반` : null,
    s.number != null ? `${s.number}번` : null
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : '-';
}

function Avatar({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <span
      className="pinned-avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.5), flexShrink: 0 }}
    >
      {name.slice(0, 1)}
    </span>
  );
}

export default function StudentsView() {
  const location = useLocation();
  const navState = location.state as { studentId?: number } | null;

  const [students, setStudents] = useState<StudentWithStats[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(navState?.studentId ?? null);
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
    return students.filter((s) => s.name.includes(query) || String(s.number ?? '').includes(query));
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
              placeholder="이름 또는 번호 검색"
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
                    <th>학년도</th>
                    <th>학년/반/번호</th>
                    <th>상담 건수</th>
                    <th>최근 상담</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedId(s.id)}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <Avatar name={s.name} size={20} />
                          {s.name}
                          {!!s.pinned && <span style={{ color: 'var(--accent)' }}>★</span>}
                        </div>
                      </td>
                      <td>{s.school_year ?? '-'}</td>
                      <td>{formatClassInfo(s)}</td>
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

function StudentFormFields({
  schoolYear,
  setSchoolYear,
  grade,
  setGrade,
  classNo,
  setClassNo,
  number,
  setNumber
}: {
  schoolYear: string;
  setSchoolYear: (v: string) => void;
  grade: string;
  setGrade: (v: string) => void;
  classNo: string;
  setClassNo: (v: string) => void;
  number: string;
  setNumber: (v: string) => void;
}) {
  return (
    <>
      <div style={{ flex: '1 1 90px' }}>
        <label className="field-label">학년도</label>
        <input className="input" placeholder="2026" value={schoolYear} onChange={(e) => setSchoolYear(e.target.value)} />
      </div>
      <div style={{ flex: '1 1 70px' }}>
        <label className="field-label">학년</label>
        <input className="input" type="number" min={1} value={grade} onChange={(e) => setGrade(e.target.value)} />
      </div>
      <div style={{ flex: '1 1 70px' }}>
        <label className="field-label">반</label>
        <input className="input" type="number" min={1} value={classNo} onChange={(e) => setClassNo(e.target.value)} />
      </div>
      <div style={{ flex: '1 1 70px' }}>
        <label className="field-label">번호</label>
        <input className="input" type="number" min={1} value={number} onChange={(e) => setNumber(e.target.value)} />
      </div>
    </>
  );
}

function AddStudentForm({ onCancel, onAdded }: { onCancel: () => void; onAdded: (s: Student) => void }) {
  const [name, setName] = useState('');
  const [schoolYear, setSchoolYear] = useState('');
  const [grade, setGrade] = useState('');
  const [classNo, setClassNo] = useState('');
  const [number, setNumber] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const student = await window.api.addStudent({
        name: name.trim(),
        school_year: schoolYear || null,
        grade: grade ? Number(grade) : null,
        class_no: classNo ? Number(classNo) : null,
        number: number ? Number(number) : null
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
        <StudentFormFields
          schoolYear={schoolYear}
          setSchoolYear={setSchoolYear}
          grade={grade}
          setGrade={setGrade}
          classNo={classNo}
          setClassNo={setClassNo}
          number={number}
          setNumber={setNumber}
        />
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
  const [schoolYear, setSchoolYear] = useState(student.school_year ?? '');
  const [grade, setGrade] = useState(student.grade != null ? String(student.grade) : '');
  const [classNo, setClassNo] = useState(student.class_no != null ? String(student.class_no) : '');
  const [number, setNumber] = useState(student.number != null ? String(student.number) : '');
  const [saving, setSaving] = useState(false);

  const [summary, setSummary] = useState<StudentSummary | null>(null);
  const [records, setRecords] = useState<ConsultRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    setName(student.name);
    setSchoolYear(student.school_year ?? '');
    setGrade(student.grade != null ? String(student.grade) : '');
    setClassNo(student.class_no != null ? String(student.class_no) : '');
    setNumber(student.number != null ? String(student.number) : '');
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
        school_year: schoolYear || null,
        grade: grade ? Number(grade) : null,
        class_no: classNo ? Number(classNo) : null,
        number: number ? Number(number) : null
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
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Avatar name={student.name} size={38} />
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
              {student.school_year ? `${student.school_year}학년도` : '학년도 미지정'} · {formatClassInfo(student)}
            </div>
          </div>
        </div>
        <button className="btn" onClick={onClose}>
          닫기
        </button>
      </div>

      {summary?.nextAppointment && (
        <div className="banner" style={{ borderColor: 'var(--accent)', background: 'var(--accent-bg)', cursor: 'default' }}>
          <span className="banner-icon">📅</span>
          <span>다음 상담 예정일: {summary.nextAppointment}</span>
        </div>
      )}

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
            <StudentFormFields
              schoolYear={schoolYear}
              setSchoolYear={setSchoolYear}
              grade={grade}
              setGrade={setGrade}
              classNo={classNo}
              setClassNo={setClassNo}
              number={number}
              setNumber={setNumber}
            />
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
        <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: 16 }}>
          <MiniMetric label="총 상담 건수" value={summary.totalCount} />
          <MiniMetric label="후속조치 대기" value={summary.followUpPending} />
          <MiniMetric label="생기부 미반영" value={summary.niceUnreflectedCount} />
          <MiniMetric label="최근 상담일" value={summary.lastRecordDate ?? '-'} />
        </div>
      )}

      {records.some((r) => r.state_score != null) && (
        <div className="card" style={{ marginBottom: 16 }}>
          <ScoreTrend records={records} />
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
                <th>점수</th>
                <th>후속조치</th>
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
                  <td>{r.state_score ?? '-'}</td>
                  <td>
                    <FollowUpStatus r={r} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// 상태 점수(1~5) 추이를 보여주는 작은 SVG 스파크라인. 외부 차트 라이브러리 없이 가볍게 구현.
function ScoreTrend({ records }: { records: ConsultRecord[] }) {
  const points = records
    .filter((r) => r.state_score != null)
    .slice()
    .sort((a, b) => a.record_date.localeCompare(b.record_date));

  if (points.length === 0) return null;

  const width = 100;
  const height = 32;
  const scoreToY = (score: number) => height - ((score - 1) / 4) * height;
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  const coords = points.map((p, i) => [points.length > 1 ? i * step : width / 2, scoreToY(p.state_score as number)]);
  const path = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const latest = points[points.length - 1].state_score;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span className="field-label" style={{ marginBottom: 0 }}>
          상태 점수 추이
        </span>
        <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>최근 {latest}점</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        {coords.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2.2} fill="var(--accent)" />
        ))}
      </svg>
    </div>
  );
}

function FollowUpStatus({ r }: { r: ConsultRecord }) {
  if (!r.follow_up_needed) return <span style={{ color: 'var(--text-faint)' }}>-</span>;
  return (
    <span style={{ color: r.follow_up_done ? 'var(--success)' : 'var(--danger)' }}>
      {r.follow_up_done ? '완료' : '대기'}
    </span>
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
