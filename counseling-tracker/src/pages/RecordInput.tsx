import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { RelationEditor } from './recordShared';

const REFERRAL_OPTIONS = ['Wee클래스', '학폭담당', '보건교사', '학부모', '기타'];

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function RecordInput() {
  const location = useLocation();
  const navigate = useNavigate();
  const navState = location.state as { studentId?: number; studentName?: string } | null;

  const [students, setStudents] = useState<Student[]>([]);
  const [pinned, setPinned] = useState<Student[]>([]);
  const [types, setTypes] = useState<ConsultType[]>([]);
  const [templates, setTemplates] = useState<QuickTemplate[]>([]);

  const [studentQuery, setStudentQuery] = useState('');
  const [studentId, setStudentId] = useState<number | null>(navState?.studentId ?? null);
  const [date, setDate] = useState(today());
  const [typeId, setTypeId] = useState<number | null>(null);
  const [content, setContent] = useState('');
  const [stateScore, setStateScore] = useState<number | null>(null);
  const [prevScore, setPrevScore] = useState<number | null>(null);
  const [followUpNeeded, setFollowUpNeeded] = useState(false);
  const [referredTo, setReferredTo] = useState<string[]>([]);
  const [reflectedInNice, setReflectedInNice] = useState(false);
  const [relations, setRelations] = useState<RecordRelationInput[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    window.api.getStudents().then(setStudents);
    window.api.getPinnedStudents().then(setPinned);
    window.api.getConsultTypes().then((t) => {
      setTypes(t);
      if (t.length > 0) setTypeId(t[0].id);
    });
  }, []);

  useEffect(() => {
    if (typeId == null) return;
    window.api.getQuickTemplates(typeId).then(setTemplates);
  }, [typeId]);

  useEffect(() => {
    if (studentId == null) {
      setPrevScore(null);
      return;
    }
    window.api.getRecords({ studentId, limit: 1, order: 'desc' }).then((rows) => {
      setPrevScore(rows[0]?.state_score ?? null);
    });
  }, [studentId]);

  const filteredStudents = useMemo(() => {
    if (!studentQuery) return [];
    return students.filter((s) => s.name.includes(studentQuery)).slice(0, 8);
  }, [students, studentQuery]);

  const selectedStudent = students.find((s) => s.id === studentId) ?? null;
  const selectedType = types.find((t) => t.id === typeId) ?? null;

  function insertTemplate(text: string) {
    const el = textareaRef.current;
    if (!el) {
      setContent((c) => c + text);
      return;
    }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const next = content.slice(0, start) + text + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + text.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function toggleReferral(option: string) {
    setReferredTo((cur) => (cur.includes(option) ? cur.filter((o) => o !== option) : [...cur, option]));
  }

  async function handleSave() {
    if (!studentId || !date || !typeId) {
      setToast('학생, 날짜, 유형은 필수입니다.');
      return;
    }
    setSaving(true);
    try {
      const record = await window.api.addRecord({
        student_id: studentId,
        type_id: typeId,
        record_date: date,
        content,
        state_score: stateScore,
        follow_up_needed: followUpNeeded,
        referred_to: referredTo.join(','),
        reflected_in_nice: reflectedInNice
      });
      if (relations.length > 0) {
        await window.api.setRecordRelations(record.id, relations);
      }
      setToast('저장되었습니다.');
      setContent('');
      setStateScore(null);
      setFollowUpNeeded(false);
      setReferredTo([]);
      setReflectedInNice(false);
      setRelations([]);
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 2500);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">기록 입력</h1>
        <p className="page-subtitle">오늘의 학생 기록을 남기세요.</p>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <div className="field" style={{ position: 'relative', marginBottom: pinned.length > 0 ? 10 : 0 }}>
              <label className="field-label">학생 *</label>
              {selectedStudent ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 10px',
                    border: '1px solid var(--accent)',
                    borderRadius: 'var(--radius)',
                    background: 'var(--accent-bg)'
                  }}
                >
                  <span className="pinned-avatar">{selectedStudent.name.slice(0, 1)}</span>
                  <span style={{ fontWeight: 500, fontSize: 13.5 }}>{selectedStudent.name}</span>
                  <button
                    type="button"
                    className="btn-icon"
                    style={{ marginLeft: 'auto' }}
                    title="다른 학생 선택"
                    onClick={() => {
                      setStudentId(null);
                      setStudentQuery('');
                    }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <>
                  <input
                    className="input"
                    placeholder="학생 이름 검색"
                    value={studentQuery}
                    onChange={(e) => setStudentQuery(e.target.value)}
                    autoFocus
                  />
                  {studentQuery && filteredStudents.length > 0 && (
                    <div className="card" style={{ position: 'absolute', zIndex: 10, marginTop: 4, padding: 4, width: '100%' }}>
                      {filteredStudents.map((s) => (
                        <div
                          key={s.id}
                          className="sidebar-link"
                          style={{ cursor: 'pointer' }}
                          onClick={() => {
                            setStudentId(s.id);
                            setStudentQuery('');
                          }}
                        >
                          {s.name}{' '}
                          {(s.grade != null || s.class_no != null || s.number != null) && (
                            <span style={{ color: 'var(--text-faint)' }}>
                              ·{' '}
                              {[
                                s.grade != null ? `${s.grade}학년` : null,
                                s.class_no != null ? `${s.class_no}반` : null,
                                s.number != null ? `${s.number}번` : null
                              ]
                                .filter(Boolean)
                                .join(' ')}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {students.length === 0 && (
                    <p style={{ color: 'var(--text-faint)', fontSize: 12.5, marginTop: 6 }}>
                      등록된 학생이 없습니다. 설정에서 명부를 먼저 업로드하세요.
                    </p>
                  )}
                </>
              )}
            </div>

            {!selectedStudent && pinned.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {pinned.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="btn"
                    style={{ padding: '3px 10px', fontSize: 12.5 }}
                    onClick={() => setStudentId(s.id)}
                  >
                    ★ {s.name}
                  </button>
                ))}
              </div>
            )}

            {prevScore != null && (
              <p style={{ color: 'var(--text-faint)', fontSize: 12, marginTop: 8, marginBottom: 0 }}>직전 상태 점수: {prevScore}점</p>
            )}

            <div className="field" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <label className="field-label">날짜</label>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            <div className="field" style={{ marginBottom: templates.length > 0 ? 12 : 0 }}>
              <label className="field-label">기록 유형</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {types.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="btn"
                    style={
                      typeId === t.id
                        ? { background: t.color, borderColor: t.color, color: '#fff' }
                        : { borderColor: `${t.color}55` }
                    }
                    onClick={() => setTypeId(t.id)}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            {templates.length > 0 && (
              <div className="field" style={{ marginBottom: 0, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <label className="field-label">빠른 입력 {selectedType && `— ${selectedType.name}`}</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {templates.map((tpl) => (
                    <button key={tpl.id} type="button" className="btn" style={{ fontSize: 12.5 }} onClick={() => insertTemplate(tpl.text)}>
                      {tpl.text}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ flex: '2 1 380px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <div className="field">
              <label className="field-label">내용</label>
              <textarea
                ref={textareaRef}
                rows={8}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="기록 내용을 입력하세요"
              />
            </div>

            <div className="field" style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <label className="field-label">
                상태 점수 (1~5)
                <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}> · 선택 사항</span>
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="btn"
                    style={
                      stateScore === n
                        ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)', flex: 1, justifyContent: 'center' }
                        : { flex: 1, justifyContent: 'center' }
                    }
                    onClick={() => setStateScore(stateScore === n ? null : n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 500 }}>
                <input type="checkbox" checked={followUpNeeded} onChange={(e) => setFollowUpNeeded(e.target.checked)} />
                후속조치 필요
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 500 }}>
                <input type="checkbox" checked={reflectedInNice} onChange={(e) => setReflectedInNice(e.target.checked)} />
                생기부 반영 완료
              </label>
            </div>

            <div className="field" style={{ marginTop: 12, marginBottom: 12 }}>
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

            <div className="field" style={{ marginBottom: 0, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <label className="field-label">관련 대상 (갈등 상대 등)</label>
              <RelationEditor
                relations={relations}
                setRelations={setRelations}
                excludeStudentId={studentId}
                mainStudentName={selectedStudent?.name}
              />
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
                marginTop: 14,
                paddingTop: 12,
                borderTop: '1px solid var(--border)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
                  {saving ? '저장 중…' : '저장'}
                </button>
                {toast && <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{toast}</span>}
              </div>
              <button
                type="button"
                className="btn"
                style={{ fontSize: 12.5 }}
                onClick={() => navigate('/', selectedStudent ? { state: { studentId: selectedStudent.id, studentName: selectedStudent.name } } : undefined)}
              >
                📅 다음 상담 예약은 캘린더에서
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
