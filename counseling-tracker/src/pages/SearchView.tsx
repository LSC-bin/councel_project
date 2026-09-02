import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

const REFERRAL_OPTIONS = ['Wee클래스', '학폭담당', '보건교사', '학부모', '기타'];

export default function SearchView() {
  const location = useLocation();
  const navState = location.state as { studentId?: number } | null;

  const [types, setTypes] = useState<ConsultType[]>([]);
  const [studentQuery, setStudentQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [typeIds, setTypeIds] = useState<number[]>([]);

  const [records, setRecords] = useState<ConsultRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

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

  const selected = useMemo(() => records.find((r) => r.id === selectedId) ?? null, [records, selectedId]);

  async function refetch() {
    const rows = await window.api.getRecords({
      studentQuery: studentQuery || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      typeIds: typeIds.length > 0 ? typeIds : undefined,
      order: 'desc'
    });
    setRecords(rows);
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">조회·검색</h1>
        <p className="page-subtitle">학생·기간·유형으로 상담 기록을 검색합니다.</p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
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

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div className="card" style={{ flex: selected ? '1 1 55%' : '1 1 100%', padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div className="empty-state">불러오는 중…</div>
          ) : records.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">⌕</div>
              <div>조건에 맞는 상담 기록이 없습니다.</div>
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
                  <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedId(r.id)}>
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

        {selected && (
          <RecordDetailPanel
            key={selected.id}
            record={selected}
            types={types}
            onClose={() => setSelectedId(null)}
            onChanged={refetch}
          />
        )}
      </div>
    </div>
  );
}

function RecordDetailPanel({
  record,
  types,
  onClose,
  onChanged
}: {
  record: ConsultRecord;
  types: ConsultType[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [typeId, setTypeId] = useState(record.type_id);
  const [content, setContent] = useState(record.content ?? '');
  const [stateScore, setStateScore] = useState<number | null>(record.state_score);
  const [followUpNeeded, setFollowUpNeeded] = useState(!!record.follow_up_needed);
  const [followUpDone, setFollowUpDone] = useState(!!record.follow_up_done);
  const [nextAppointment, setNextAppointment] = useState(record.next_appointment ?? '');
  const [referredTo, setReferredTo] = useState<string[]>(record.referred_to ? record.referred_to.split(',').filter(Boolean) : []);
  const [reflectedInNice, setReflectedInNice] = useState(!!record.reflected_in_nice);
  const [saving, setSaving] = useState(false);

  function toggleReferral(option: string) {
    setReferredTo((cur) => (cur.includes(option) ? cur.filter((o) => o !== option) : [...cur, option]));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await window.api.updateRecord(record.id, {
        type_id: typeId,
        content,
        state_score: stateScore,
        follow_up_needed: followUpNeeded,
        follow_up_done: followUpDone,
        next_appointment: followUpNeeded ? nextAppointment || null : null,
        referred_to: referredTo.join(','),
        reflected_in_nice: reflectedInNice
      });
      setEditing(false);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('이 상담 기록을 삭제할까요? 되돌릴 수 없습니다.')) return;
    await window.api.deleteRecord(record.id);
    onChanged();
    onClose();
  }

  return (
    <div className="card" style={{ flex: '1 1 45%', position: 'sticky', top: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{record.student_name}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 12.5 }}>{record.record_date}</div>
        </div>
        <button className="btn" onClick={onClose}>
          닫기
        </button>
      </div>

      {!editing ? (
        <>
          <div className="field">
            <span className="badge" style={{ background: `${record.type_color}22`, color: record.type_color }}>
              <span className="badge-dot" style={{ background: record.type_color }} />
              {record.type_name}
            </span>
          </div>
          <div className="field" style={{ whiteSpace: 'pre-wrap', fontSize: 13.5 }}>
            {record.content || <span style={{ color: 'var(--text-faint)' }}>내용 없음</span>}
          </div>
          <div className="field" style={{ fontSize: 12.5, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {record.state_score != null && <div>상태 점수: {record.state_score}</div>}
            {!!record.follow_up_needed && (
              <div>
                후속조치: {record.follow_up_done ? '완료' : '대기'}
                {record.next_appointment ? ` · 다음 상담 예정 ${record.next_appointment}` : ''}
              </div>
            )}
            {record.referred_to && <div>유관기관 연계: {record.referred_to.split(',').join(', ')}</div>}
            <div>생기부 반영: {record.reflected_in_nice ? '완료' : '미반영'}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={() => setEditing(true)}>
              수정
            </button>
            <button className="btn" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={handleDelete}>
              삭제
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="field">
            <label className="field-label">상담 유형</label>
            <select className="select" value={typeId} onChange={(e) => setTypeId(Number(e.target.value))}>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label">내용</label>
            <textarea rows={5} value={content} onChange={(e) => setContent(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label">상태 점수</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className="btn"
                  style={stateScore === n ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' } : undefined}
                  onClick={() => setStateScore(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 500 }}>
              <input type="checkbox" checked={followUpNeeded} onChange={(e) => setFollowUpNeeded(e.target.checked)} />
              후속조치 필요
            </label>
            {followUpNeeded && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                <input
                  className="input"
                  type="date"
                  value={nextAppointment}
                  onChange={(e) => setNextAppointment(e.target.value)}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, whiteSpace: 'nowrap' }}>
                  <input type="checkbox" checked={followUpDone} onChange={(e) => setFollowUpDone(e.target.checked)} />
                  완료됨
                </label>
              </div>
            )}
          </div>
          <div className="field">
            <label className="field-label">유관기관 연계</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {REFERRAL_OPTIONS.map((opt) => (
                <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5 }}>
                  <input type="checkbox" checked={referredTo.includes(opt)} onChange={() => toggleReferral(opt)} />
                  {opt}
                </label>
              ))}
            </div>
          </div>
          <div className="field">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 500 }}>
              <input type="checkbox" checked={reflectedInNice} onChange={(e) => setReflectedInNice(e.target.checked)} />
              생기부 반영 완료
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
              {saving ? '저장 중…' : '저장'}
            </button>
            <button className="btn" onClick={() => setEditing(false)}>
              취소
            </button>
          </div>
        </>
      )}
    </div>
  );
}
