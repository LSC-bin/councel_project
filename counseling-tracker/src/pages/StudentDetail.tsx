import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Avatar,
  DigestRecent,
  FollowUpStatus,
  InfoRow,
  MiniMetric,
  ProfileFields,
  RelationScoreChart,
  ScoreLineChart,
  StudentFormFields,
  formatClassInfo,
  useProfileFieldState
} from './studentShared';
import { EditIcon, TrashIcon, BackIcon, PinIcon, CalendarIcon } from '../components/icons';
import ActionList from '../components/ActionList';
import Modal from '../components/Modal';

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
  const [digest, setDigest] = useState<StudentDigest | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [relationSummary, setRelationSummary] = useState<StudentRelationSummary | null>(null);
  const [actionsKey, setActionsKey] = useState(0);

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
      profile.setGuardian2Name(s.guardian2_name ?? '');
      profile.setGuardian2Phone(s.guardian2_phone ?? '');
      profile.setStudentPhone(s.student_phone ?? '');
      profile.setAddress(s.address ?? '');
      profile.setHealthNote(s.health_note ?? '');
      profile.setMemo(s.memo ?? '');
    });
  }

  function loadHistory() {
    setLoadingHistory(true);
    Promise.all([
      window.api.getStudentSummary(studentId),
      window.api.getRecords({ studentId, order: 'desc' }),
      window.api.getStudentDigest(studentId)
    ])
      .then(([s, r, d]) => {
        setSummary(s);
        setRecords(r);
        setDigest(d);
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
        guardian2_name: profile.guardian2Name || null,
        guardian2_phone: profile.guardian2Phone || null,
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
        <div className="page-header">
          <button className="back-btn" onClick={() => navigate('/students')} title="학생 관리로 돌아가기">
            <BackIcon />
          </button>
        </div>
        <div className="card empty-state">학생을 찾을 수 없습니다.</div>
      </div>
    );
  }

  if (!student) {
    return <div className="empty-state">불러오는 중…</div>;
  }

  return (
    <div>
      <div className="page-header" style={{ alignItems: 'center' }}>
        <button className="back-btn" onClick={() => navigate('/students')} title="학생 관리로 돌아가기">
          <BackIcon />
        </button>
        <Avatar name={student.name} size={34} />
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {student.name}
            <button
              className="btn btn-sm"
              style={{ color: student.pinned ? 'var(--accent)' : undefined }}
              onClick={handleTogglePin}
              title={student.pinned ? '즐겨찾기 해제' : '즐겨찾기 고정'}
            >
              <PinIcon filled={!!student.pinned} />
            </button>
          </h1>
          <p className="page-subtitle">
            {student.school_year ? `${student.school_year}학년도` : '학년도 미지정'} · {formatClassInfo(student)}
          </p>
        </div>
      </div>

      {summary?.nextAppointment && (
        <div className="banner banner-info" style={{ cursor: 'default' }}>
          <span className="banner-icon">
            <CalendarIcon />
          </span>
          <span>다음 상담 예정일: {summary.nextAppointment}</span>
        </div>
      )}

      {!editing ? (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button className="btn btn-primary" onClick={() => navigate('/input', { state: { studentId: student.id, studentName: student.name } })}>
            기록 추가
          </button>
          <button className="btn" onClick={() => navigate('/', { state: { studentId: student.id, studentName: student.name } })}>
            <CalendarIcon /> 예약 잡기
          </button>
          <button className="btn-icon" title="정보 수정" onClick={() => setEditing(true)}>
            <EditIcon />
          </button>
          <button className="btn-icon btn-icon-danger" title="삭제" onClick={handleDelete}>
            <TrashIcon />
          </button>
        </div>
      ) : (
        <Modal title={`${student.name} 학생 정보 수정`} onClose={() => setEditing(false)} maxWidth={560}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 140px' }}>
              <label className="field-label">이름</label>
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
        </Modal>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 340px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="card">
            <div className="info-grid">
              <InfoRow label="학년도" value={student.school_year} />
              <InfoRow label="학년/반/번호" value={formatClassInfo(student) === '-' ? null : formatClassInfo(student)} />
              <InfoRow label="보호자1" value={[student.guardian_name, student.guardian_phone].filter(Boolean).join(' · ') || null} />
              <InfoRow label="보호자2" value={[student.guardian2_name, student.guardian2_phone].filter(Boolean).join(' · ') || null} />
              <InfoRow label="학생 연락처" value={student.student_phone} />
              <InfoRow label="주소" value={student.address} />
              <InfoRow label="특이사항" value={student.health_note} tone="danger" />
              <InfoRow label="메모" value={student.memo} />
            </div>

            {summary && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 12px' }}>
                <MiniMetric label="총 기록 건수" value={summary.totalCount} />
                <MiniMetric label="후속조치 대기" value={summary.followUpPending} />
                <MiniMetric label="생기부 미반영" value={summary.niceUnreflectedCount} />
                <MiniMetric label="최근 기록일" value={summary.lastRecordDate ?? '-'} />
              </div>
            )}
          </div>

          {digest && (
            <div className="card">
              <div className="section-title" style={{ marginBottom: 6 }}>조치사항 (상담 이후 할 일)</div>
              <ActionList
                key={actionsKey}
                studentId={studentId}
                onChanged={() => {
                  setActionsKey((k) => k + 1);
                  loadHistory();
                }}
              />
            </div>
          )}

          {digest && (
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                <span className="section-title" style={{ margin: 0, border: 'none', padding: 0 }}>이전 상담 요약 (최근 5건)</span>
              </div>
              <DigestRecent digest={digest} onOpenRecord={(rid) => navigate(`/search/${rid}`)} />
            </div>
          )}
        </div>

        <div style={{ flex: '2 1 420px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {digest && <ScoreLineChart series={digest.scoreSeries} />}

          {relationSummary && (relationSummary.students.length > 0 || relationSummary.others.length > 0) && (
            <div className="card">
              <div className="field-label">관계 현황 · {student.name} 학생이 남긴 기록 기준</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {relationSummary.students.map((s) => (
                  <button
                    key={s.studentId}
                    type="button"
                    className="badge badge-link"
                    style={{ background: 'var(--bg-panel)', color: 'var(--text)', border: '1px solid var(--border)' }}
                    onClick={() => navigate(`/students/${s.studentId}`)}
                  >
                    {s.name} {s.count}회{s.latestScore != null && ` · 최근 ${s.latestScore}점`}
                  </button>
                ))}
                {relationSummary.others.map((o) => (
                  <span key={o.type} className="badge" style={{ background: 'var(--bg-panel)', color: 'var(--text)', border: '1px solid var(--border)' }}>
                    {o.type} {o.count}회{o.latestScore != null && ` · 최근 ${o.latestScore}점`}
                  </span>
                ))}
              </div>
              <div style={{ marginTop: 8 }}>
                <RelationScoreChart summary={relationSummary} />
              </div>
            </div>
          )}

          <div>
            <div className="section-title">전체 기록 ({records.length}건)</div>
            <div className="card" style={{ padding: 0 }}>
              {loadingHistory ? (
                <div className="empty-state">불러오는 중…</div>
              ) : records.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px 10px' }}>
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
                      <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/search/${r.id}`)}>
                        <td>{r.record_date}</td>
                        <td>
                          <span className="badge" style={{ background: `${r.type_color}18`, color: r.type_color, border: `1px solid ${r.type_color}44` }}>
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
    </div>
  );
}
