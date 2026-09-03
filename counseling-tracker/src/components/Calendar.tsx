import { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import { EditIcon, TrashIcon } from './icons';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function pad(n: number) {
  return String(n).padStart(2, '0');
}
function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function todayISO() {
  return toISODate(new Date());
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function buildGrid(viewMonth: Date) {
  const first = startOfMonth(viewMonth);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay());
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push(d);
  }
  return cells;
}

interface Props {
  // 다른 화면(학생 상세 등)에서 특정 학생의 예약을 바로 잡으러 온 경우 사용
  prefillStudentId?: number | null;
  prefillStudentName?: string | null;
  onPrefillConsumed?: () => void;
}

export default function Calendar({ prefillStudentId, prefillStudentName, onPrefillConsumed }: Props) {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalDate, setModalDate] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const grid = useMemo(() => buildGrid(viewMonth), [viewMonth]);

  function refresh() {
    setLoading(true);
    const start = toISODate(grid[0]);
    const end = toISODate(grid[grid.length - 1]);
    window.api
      .getAppointmentsInRange(start, end)
      .then(setAppointments)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMonth]);

  useEffect(() => {
    if (prefillStudentId) {
      setViewMonth(startOfMonth(new Date()));
      setModalDate(todayISO());
      setShowAddForm(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillStudentId]);

  const byDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const list = map.get(a.appt_date) ?? [];
      list.push(a);
      map.set(a.appt_date, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.start_time.localeCompare(b.start_time));
    return map;
  }, [appointments]);

  const today = todayISO();
  const modalList = modalDate ? byDate.get(modalDate) ?? [] : [];

  function goToMonth(delta: number) {
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  function closeModal() {
    setModalDate(null);
    setShowAddForm(false);
    onPrefillConsumed?.();
  }

  return (
    <div className="card calendar-card">
      <div className="calendar-header">
        <button className="btn" onClick={() => goToMonth(-1)}>
          ‹
        </button>
        <div className="calendar-title">
          {viewMonth.getFullYear()}년 {viewMonth.getMonth() + 1}월
        </div>
        <button className="btn" onClick={() => goToMonth(1)}>
          ›
        </button>
        <button
          className="btn"
          style={{ marginLeft: 'auto', fontSize: 12 }}
          onClick={() => setViewMonth(startOfMonth(new Date()))}
        >
          오늘
        </button>
      </div>

      <p style={{ color: 'var(--text-faint)', fontSize: 12, margin: '0 0 8px' }}>날짜를 더블클릭하면 예약을 보고 추가할 수 있습니다.</p>

      <div className="calendar-grid calendar-weekdays">
        {WEEKDAYS.map((w) => (
          <div key={w} className="calendar-weekday">
            {w}
          </div>
        ))}
      </div>

      <div className="calendar-days">
        {grid.map((d) => {
          const iso = toISODate(d);
          const inMonth = d.getMonth() === viewMonth.getMonth();
          const list = byDate.get(iso) ?? [];
          const isToday = iso === today;
          return (
            <div
              key={iso}
              className={'calendar-cell' + (inMonth ? '' : ' dim') + (isToday ? ' today' : '')}
              onDoubleClick={() => setModalDate(iso)}
              title="더블클릭하여 예약 보기/추가"
            >
              <div className="calendar-cell-date">{d.getDate()}</div>
              <div className="calendar-cell-items">
                {list.slice(0, 3).map((a) => (
                  <div key={a.id} className="calendar-chip">
                    {a.start_time} {a.student_name}
                  </div>
                ))}
                {list.length > 3 && <div className="calendar-chip-more">+{list.length - 3}</div>}
              </div>
            </div>
          );
        })}
      </div>
      {loading && <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 6 }}>불러오는 중…</div>}

      {modalDate && (
        <Modal title={modalDate} onClose={closeModal} maxWidth={460}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 12.5 }} onClick={() => setShowAddForm((v) => !v)}>
              {showAddForm ? '닫기' : '+ 예약 추가'}
            </button>
          </div>

          {showAddForm && (
            <AddAppointmentForm
              date={modalDate}
              prefillStudentId={prefillStudentId}
              prefillStudentName={prefillStudentName}
              onDone={() => {
                setShowAddForm(false);
                refresh();
                onPrefillConsumed?.();
              }}
            />
          )}

          {modalList.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px 10px' }}>
              예약이 없습니다.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {modalList.map((a) => (
                <AppointmentRow key={a.id} appointment={a} onChanged={refresh} />
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function AppointmentRow({ appointment, onChanged }: { appointment: Appointment; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [apptDate, setApptDate] = useState(appointment.appt_date);
  const [startTime, setStartTime] = useState(appointment.start_time);
  const [endTime, setEndTime] = useState(appointment.end_time);
  const [note, setNote] = useState(appointment.note ?? '');
  const [conflicts, setConflicts] = useState<Appointment[]>([]);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing || !startTime || !endTime || startTime >= endTime) {
      setConflicts([]);
      return;
    }
    setChecking(true);
    const timer = setTimeout(() => {
      window.api
        .checkAppointmentConflict({ appt_date: apptDate, start_time: startTime, end_time: endTime, excludeId: appointment.id })
        .then(setConflicts)
        .finally(() => setChecking(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [editing, apptDate, startTime, endTime, appointment.id]);

  async function handleDelete() {
    if (!confirm(`${appointment.student_name} 학생 예약(${appointment.start_time}~${appointment.end_time})을 삭제할까요?`)) return;
    await window.api.deleteAppointment(appointment.id);
    onChanged();
  }

  async function handleSave() {
    setError(null);
    if (startTime >= endTime) {
      setError('종료 시간은 시작 시간보다 늦어야 합니다.');
      return;
    }
    setSaving(true);
    try {
      const result = await window.api.updateAppointment(appointment.id, {
        appt_date: apptDate,
        start_time: startTime,
        end_time: endTime,
        note: note || null
      });
      if (!result.ok) {
        setConflicts(result.conflicts ?? []);
        setError(result.error ?? '선택한 시간에 이미 예약이 있습니다.');
        return;
      }
      setEditing(false);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="card" style={{ background: 'var(--bg-hover)' }}>
        <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 8 }}>{appointment.student_name} 예약 수정</div>
        <div className="field">
          <label className="field-label">날짜</label>
          <input className="input" type="date" value={apptDate} onChange={(e) => setApptDate(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label">시작</label>
            <input className="input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label">종료</label>
            <input className="input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label className="field-label">메모</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        {checking ? (
          <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>확인 중…</p>
        ) : startTime < endTime ? (
          conflicts.length > 0 ? (
            <p style={{ fontSize: 12, color: 'var(--danger)' }}>
              겹치는 예약: {conflicts.map((c) => `${c.student_name}(${c.start_time}~${c.end_time})`).join(', ')}
            </p>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--success)' }}>✓ 예약 가능한 시간입니다.</p>
          )
        ) : null}
        {error && <p style={{ fontSize: 12.5, color: 'var(--danger)' }}>{error}</p>}

        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-primary" style={{ fontSize: 12.5 }} disabled={saving || conflicts.length > 0} onClick={handleSave}>
            {saving ? '저장 중…' : '저장'}
          </button>
          <button className="btn-icon" title="취소" onClick={() => setEditing(false)}>
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4, fontSize: 13 }}>
      <div>
        <div style={{ fontWeight: 500 }}>
          {appointment.start_time}–{appointment.end_time} · {appointment.student_name}
        </div>
        {appointment.note && <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{appointment.note}</div>}
      </div>
      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
        <button className="btn-icon" title="수정" onClick={() => setEditing(true)}>
          <EditIcon />
        </button>
        <button className="btn-icon btn-icon-danger" title="삭제" onClick={handleDelete}>
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

function AddAppointmentForm({
  date,
  prefillStudentId,
  prefillStudentName,
  onDone
}: {
  date: string;
  prefillStudentId?: number | null;
  prefillStudentName?: string | null;
  onDone: () => void;
}) {
  const [students, setStudents] = useState<Student[]>([]);
  const [studentQuery, setStudentQuery] = useState(prefillStudentName ?? '');
  const [studentId, setStudentId] = useState<number | null>(prefillStudentId ?? null);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('09:30');
  const [note, setNote] = useState('');
  const [conflicts, setConflicts] = useState<Appointment[]>([]);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.api.getStudents().then(setStudents);
  }, []);

  useEffect(() => {
    if (!startTime || !endTime || startTime >= endTime) {
      setConflicts([]);
      return;
    }
    setChecking(true);
    const timer = setTimeout(() => {
      window.api
        .checkAppointmentConflict({ appt_date: date, start_time: startTime, end_time: endTime })
        .then(setConflicts)
        .finally(() => setChecking(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [date, startTime, endTime]);

  const filteredStudents = studentQuery && !studentId ? students.filter((s) => s.name.includes(studentQuery)).slice(0, 6) : [];

  async function handleSubmit() {
    setError(null);
    if (!studentId) {
      setError('학생을 선택하세요.');
      return;
    }
    if (startTime >= endTime) {
      setError('종료 시간은 시작 시간보다 늦어야 합니다.');
      return;
    }
    setSaving(true);
    try {
      const result = await window.api.addAppointment({
        student_id: studentId,
        appt_date: date,
        start_time: startTime,
        end_time: endTime,
        note: note || null
      });
      if (!result.ok) {
        setConflicts(result.conflicts ?? []);
        setError('선택한 시간에 이미 예약이 있습니다.');
        return;
      }
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 12, background: 'var(--bg-hover)' }}>
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
        {filteredStudents.length > 0 && (
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
                {s.name}
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div className="field" style={{ flex: 1 }}>
          <label className="field-label">시작</label>
          <input className="input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label className="field-label">종료</label>
          <input className="input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label className="field-label">메모 (선택)</label>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 진로 상담" />
      </div>

      {checking ? (
        <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>확인 중…</p>
      ) : startTime < endTime ? (
        conflicts.length > 0 ? (
          <p style={{ fontSize: 12, color: 'var(--danger)' }}>
            겹치는 예약: {conflicts.map((c) => `${c.student_name}(${c.start_time}~${c.end_time})`).join(', ')}
          </p>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--success)' }}>✓ 예약 가능한 시간입니다.</p>
        )
      ) : null}

      {error && <p style={{ fontSize: 12.5, color: 'var(--danger)' }}>{error}</p>}

      <button className="btn btn-primary" disabled={saving || conflicts.length > 0} onClick={handleSubmit}>
        {saving ? '저장 중…' : '예약 저장'}
      </button>
    </div>
  );
}
