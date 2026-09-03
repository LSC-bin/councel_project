import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Avatar,
  FollowUpStatus,
  InfoRow,
  MiniMetric,
  ProfileFields,
  ScoreTrend,
  StudentFormFields,
  formatClassInfo,
  useProfileFieldState
} from './studentShared';

export default function StudentDetail() {
  const { id } = useParams<{ id: string }>();
  const studentId = Number(id);
  const navigate = useNavigate();

  const [student, setStudent] = useState<Student | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [schoolYear, setSchoolYear] = useState('');
  const [grade, setGrade] = useState('');
  const [classNo, setClassNo] = useState('');
  const [number, setNumber] = useState('');
  const profile = useProfileFieldState();
  const [saving, setSaving] = useState(false);

  const [summary, setSummary] = useState<StudentSummary | null>(null);
  const [records, setRecords] = useState<ConsultRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [relationSummary, setRelationSummary] = useState<StudentRelationSummary | null>(null);

  function loadStudent() {
    window.api.getStudentById(studentId).then((s) => {
      if (!s) {
        setNotFound(true);
        return;
      }
      setStudent(s);
      setName(s.name);
      setSchoolYear(s.school_year ?? '');
      setGrade(s.grade != null ? String(s.grade) : '');
      setClassNo(s.class_no != null ? String(s.class_no) : '');
      setNumber(s.number != null ? String(s.number) : '');
      profile.setGuardianName(s.guardian_name ?? '');
      profile.setGuardianPhone(s.guardian_phone ?? '');
      profile.setStudentPhone(s.student_phone ?? '');
      profile.setAddress(s.address ?? '');
      profile.setHealthNote(s.health_note ?? '');
      profile.setMemo(s.memo ?? '');
    });
  }

  function loadHistory() {
    setLoadingHistory(true);
    Promise.all([window.api.getStudentSummary(studentId), window.api.getRecords({ studentId, order: 'desc' })])
      .then(([s, r]) => {
        setSummary(s);
        setRecords(r);
      })
      .finally(() => setLoadingHistory(false));
    window.api.getStudentRelationSummary(studentId).then(setRelationSummary);
  }

  useEffect(() => {
    if (!studentId || Number.isNaN(studentId)) {
      setNotFound(true);
      return;
    }
    setNotFound(false);
    setEditing(false);
    loadStudent();
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  async function handleTogglePin() {
    await window.api.togglePin(studentId);
    loadStudent();
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await window.api.updateStudent(studentId, {
        name: name.trim(),
        school_year: schoolYear || null,
        grade: grade ? Number(grade) : null,
        class_no: classNo ? Number(classNo) : null,
        number: number ? Number(number) : null,
        guardian_name: profile.guardianName || null,
        guardian_phone: profile.guardianPhone || null,
        student_phone: profile.studentPhone || null,
        address: profile.address || null,
        health_note: profile.healthNote || null,
        memo: profile.memo || null
      });
      setEditing(false);
      loadStudent();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!student) return;
    if (!confirm(`${student.name} 학생을 삭제할까요? 이 학생의 기록도 모두 함께 삭제되며 되돌릴 수 없습니다.`)) return;
    await window.api.deleteStudent(studentId);
    navigate('/students');
  }

  if (notFound) {
    return (
      <div>
        <button className="btn" style={{ marginBottom: 12 }} onClick={() => navigate('/students')}>
          ← 목록으로
        </button>
        <div className="card empty-state">학생을 찾을 수 없습니다.</div>
      </div>
    );
  }

  if (!student) {
    return <div className="empty-state">불러오는 중…</div>;
  }

  return (
    <div>
      <button className="btn" style={{ marginBottom: 12 }} onClick={() => navigate('/students')}>
        ← 목록으로
      </button>

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Avatar name={student.name} size={44} />
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {student.name}
              <button
                className="btn"
                style={{ padding: '2px 8px', fontSize: 13, color: student.pinned ? 'var(--accent)' : undefined }}
                onClick={handleTogglePin}
                title="즐겨찾기"
              >
                {student.pinned ? '★ 고정됨' : '☆ 고정'}
              </button>
            </h1>
            <p className="page-subtitle">
              {student.school_year ? `${student.school_year}학년도` : '학년도 미지정'} · {formatClassInfo(student)}
            </p>
          </div>
        </div>
      </div>

      {summary?.nextAppointment && (
        <div className="banner" style={{ borderColor: 'var(--accent)', background: 'var(--accent-bg)', cursor: 'default' }}>
          <span className="banner-icon">📅</span>
          <span>다음 상담 예정일: {summary.nextAppointment}</span>
        </div>
      )}

      {!editing ? (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button className="btn btn-primary" onClick={() => navigate('/input', { state: { studentId: student.id, studentName: student.name } })}>
            기록 추가
          </button>
          <button className="btn" onClick={() => navigate('/', { state: { studentId: student.id, studentName: student.name } })}>
            📅 예약 잡기
          </button>
          <button className="btn" onClick={() => setEditing(true)}>
            정보 수정
          </button>
          <button className="btn" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={handleDelete}>
            삭제
          </button>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 12, maxWidth: 640 }}>
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
          <ProfileFields {...profile} />
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

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <div className="info-grid">
              <InfoRow label="학년도" value={student.school_year} />
              <InfoRow label="학년/반/번호" value={formatClassInfo(student) === '-' ? null : formatClassInfo(student)} />
              <InfoRow label="보호자" value={[student.guardian_name, student.guardian_phone].filter(Boolean).join(' · ') || null} />
              <InfoRow label="학생 연락처" value={student.student_phone} />
              <InfoRow label="주소" value={student.address} />
              <InfoRow label="특이사항" value={student.health_note} tone="danger" />
              <InfoRow label="메모" value={student.memo} />
            </div>
          </div>

          {relationSummary && (relationSummary.students.length > 0 || relationSummary.others.length > 0) && (
            <div className="card">
              <div className="field-label">관계 현황</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {relationSummary.students.map((s) => (
                  <button
                    key={s.studentId}
                    type="button"
                    className="badge"
                    style={{ background: 'var(--bg-hover)', color: 'var(--text)', border: 'none', cursor: 'pointer' }}
                    onClick={() => navigate(`/students/${s.studentId}`)}
                  >
                    {s.name} {s.count}회
                  </button>
                ))}
                {relationSummary.others.map((o) => (
                  <span key={o.type} className="badge" style={{ background: 'var(--bg-hover)', color: 'var(--text)' }}>
                    {o.type} {o.count}회
                  </span>
                ))}
              </div>
            </div>
          )}

          {summary && (
            <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: 0 }}>
              <MiniMetric label="총 기록 건수" value={summary.totalCount} />
              <MiniMetric label="후속조치 대기" value={summary.followUpPending} />
              <MiniMetric label="생기부 미반영" value={summary.niceUnreflectedCount} />
              <MiniMetric label="최근 기록일" value={summary.lastRecordDate ?? '-'} />
            </div>
          )}

          {records.some((r) => r.state_score != null) && (
            <div className="card">
              <ScoreTrend records={records} />
            </div>
          )}
        </div>

        <div style={{ flex: '2 1 420px' }}>
          <div className="section-title">전체 기록</div>
          <div className="card" style={{ padding: 0 }}>
            {loadingHistory ? (
              <div className="empty-state">불러오는 중…</div>
            ) : records.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 10px' }}>
                아직 기록이 없습니다.
              </div>
            ) : (
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
                      <td>{r.content?.slice(0, 40)}</td>
                      <td>{r.state_score ?? '-'}</td>
                      <td>
                        <FollowUpStatus r={r} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
