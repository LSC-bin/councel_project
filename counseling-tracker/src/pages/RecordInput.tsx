import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

const REFERRAL_OPTIONS = ['Wee클래스', '학폭담당', '보건교사', '학부모', '기타'];

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function RecordInput() {
  const location = useLocation();
  const navState = location.state as { studentId?: number; studentName?: string } | null;

  const [students, setStudents] = useState<Student[]>([]);
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
  const [nextAppointment, setNextAppointment] = useState('');
  const [referredTo, setReferredTo] = useState<string[]>([]);
  const [reflectedInNice, setReflectedInNice] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    window.api.getStudents().then(setStudents);
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
    window.api.getRecords({ limit: 1, order: 'desc' }).then((rows) => {
      const own = rows.find((r) => r.student_id === studentId);
      setPrevScore(own?.state_score ?? null);
    });
  }, [studentId]);

  const filteredStudents = useMemo(() => {
    if (!studentQuery) return [];
    return students.filter((s) => s.name.includes(studentQuery)).slice(0, 8);
  }, [students, studentQuery]);

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
      await window.api.addRecord({
        student_id: studentId,
        type_id: typeId,
        record_date: date,
        content,
        state_score: stateScore,
        follow_up_needed: followUpNeeded,
        next_appointment: followUpNeeded ? nextAppointment || null : null,
        referred_to: referredTo.join(','),
        reflected_in_nice: reflectedInNice
      });
      setToast('저장되었습니다.');
      setContent('');
      setStateScore(null);
      setFollowUpNeeded(false);
      setNextAppointment('');
      setReferredTo([]);
      setReflectedInNice(false);
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 2500);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">기록 입력</h1>
        <p className="page-subtitle">오늘의 상담 내용을 기록하세요.</p>
      </div>

      <div className="card" style={{ maxWidth: 640 }}>
        <div className="field" style={{ position: 'relative' }}>
          <label className="field-label">학생</label>
          <input
            className="input"
            placeholder="학생 이름 검색"
            value={studentId ? students.find((s) => s.id === studentId)?.name ?? studentQuery : studentQuery}
            onChange={(e) => {
              setStudentQuery(e.target.value);
              setStudentId(null);
            }}
          />
          {studentQuery && !studentId && filteredStudents.length > 0 && (
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
                      · {[s.grade != null ? `${s.grade}학년` : null, s.class_no != null ? `${s.class_no}반` : null, s.number != null ? `${s.number}번` : null]
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
        </div>

        <div className="field">
          <label className="field-label">날짜</label>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="field">
          <label className="field-label">상담 유형</label>
          <select className="select" value={typeId ?? ''} onChange={(e) => setTypeId(Number(e.target.value))}>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {templates.length > 0 && (
          <div className="field">
            <label className="field-label">빠른 입력</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {templates.map((tpl) => (
                <button key={tpl.id} type="button" className="btn" onClick={() => insertTemplate(tpl.text)}>
                  {tpl.text}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="field">
          <label className="field-label">내용</label>
          <textarea
            ref={textareaRef}
            rows={6}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="상담 내용을 입력하세요"
          />
        </div>

        <div className="field">
          <label className="field-label">
            상태 점수 (1~5){prevScore != null && <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}> · 직전 상담: {prevScore}</span>}
          </label>
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
            <input
              className="input"
              type="date"
              style={{ marginTop: 8 }}
              value={nextAppointment}
              onChange={(e) => setNextAppointment(e.target.value)}
            />
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
            {saving ? '저장 중…' : '저장'}
          </button>
          {toast && <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{toast}</span>}
        </div>
      </div>
    </div>
  );
}
