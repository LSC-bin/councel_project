import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, ProfileFields, StudentFormFields, formatClassInfo, useProfileFieldState } from './studentShared';

export default function StudentsView() {
  const navigate = useNavigate();

  const [students, setStudents] = useState<StudentWithStats[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
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

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">학생 관리</h1>
        <p className="page-subtitle">학생 정보를 확인·수정하고, 학생별 전체 기록을 한눈에 봅니다.</p>
      </div>

      <div className="card" style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
        <input className="input" placeholder="이름 또는 번호 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
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
            navigate(`/students/${s.id}`);
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
                <th>기록 건수</th>
                <th>최근 기록</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/students/${s.id}`)}>
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
  );
}

function AddStudentForm({ onCancel, onAdded }: { onCancel: () => void; onAdded: (s: Student) => void }) {
  const [name, setName] = useState('');
  const [schoolYear, setSchoolYear] = useState('');
  const [grade, setGrade] = useState('');
  const [classNo, setClassNo] = useState('');
  const [number, setNumber] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const profile = useProfileFieldState();
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
        number: number ? Number(number) : null,
        guardian_name: profile.guardianName || null,
        guardian_phone: profile.guardianPhone || null,
        guardian2_name: profile.guardian2Name || null,
        guardian2_phone: profile.guardian2Phone || null,
        student_phone: profile.studentPhone || null,
        address: profile.address || null,
        health_note: profile.healthNote || null,
        memo: profile.memo || null
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
        <button className="btn-icon" title="취소" onClick={onCancel}>
          ✕
        </button>
      </div>
      <button
        type="button"
        className="btn"
        style={{ marginTop: 10, padding: '3px 8px', fontSize: 12.5 }}
        onClick={() => setShowProfile((v) => !v)}
      >
        {showProfile ? '▾ 보호자·연락처 정보 접기' : '▸ 보호자·연락처 정보 입력 (선택)'}
      </button>
      {showProfile && <ProfileFields {...profile} />}
    </div>
  );
}
