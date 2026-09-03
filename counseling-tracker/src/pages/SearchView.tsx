import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function SearchView() {
  const location = useLocation();
  const navigate = useNavigate();
  const navState = location.state as { studentId?: number } | null;

  const [types, setTypes] = useState<ConsultType[]>([]);
  const [studentQuery, setStudentQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [typeIds, setTypeIds] = useState<number[]>([]);

  const [records, setRecords] = useState<ConsultRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.api.getConsultTypes().then(setTypes);
  }, []);

  // 대시보드 위기감지 배너에서 특정 학생으로 이동해온 경우, 해당 학생 이름으로 필터를 채운다.
  useEffect(() => {
    if (!navState?.studentId) return;
    window.api.getStudents(false).then((students) => {
      const s = students.find((st) => st.id === navState.studentId);
      if (s) setStudentQuery(s.name);
    });
  }, [navState?.studentId]);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      window.api
        .getRecords({
          studentQuery: studentQuery || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          typeIds: typeIds.length > 0 ? typeIds : undefined,
          order: 'desc'
        })
        .then(setRecords)
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [studentQuery, startDate, endDate, typeIds]);

  function toggleType(id: number) {
    setTypeIds((cur) => (cur.includes(id) ? cur.filter((t) => t !== id) : [...cur, id]));
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">조회·검색</h1>
        <p className="page-subtitle">학생·기간·유형으로 기록을 검색합니다.</p>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ minWidth: 180 }}>
            <label className="field-label">학생명</label>
            <input
              className="input"
              placeholder="학생 이름"
              value={studentQuery}
              onChange={(e) => setStudentQuery(e.target.value)}
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
          <div style={{ flex: 1, minWidth: 200 }}>
            <label className="field-label">유형</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {types.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="btn"
                  style={
                    typeIds.includes(t.id)
                      ? { background: t.color, borderColor: t.color, color: '#fff' }
                      : undefined
                  }
                  onClick={() => toggleType(t.id)}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="empty-state">불러오는 중…</div>
        ) : records.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">⌕</div>
            <div>조건에 맞는 기록이 없습니다.</div>
          </div>
        ) : (
          <table className="record-table">
            <thead>
              <tr>
                <th>날짜</th>
                <th>학생</th>
                <th>유형</th>
                <th>내용</th>
                <th>후속조치</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/search/${r.id}`)}>
                  <td>{r.record_date}</td>
                  <td>{r.student_name}</td>
                  <td>
                    <span className="badge" style={{ background: `${r.type_color}22`, color: r.type_color }}>
                      <span className="badge-dot" style={{ background: r.type_color }} />
                      {r.type_name}
                    </span>
                  </td>
                  <td>{r.content?.slice(0, 30)}</td>
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
  );
}
