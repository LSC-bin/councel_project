import { useState } from 'react';

export function formatClassInfo(s: { grade: number | null; class_no: number | null; number: number | null }) {
  if (s.grade == null && s.class_no == null && s.number == null) return '-';
  const parts = [
    s.grade != null ? `${s.grade}학년` : null,
    s.class_no != null ? `${s.class_no}반` : null,
    s.number != null ? `${s.number}번` : null
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : '-';
}

export function Avatar({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <span className="pinned-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.5), flexShrink: 0 }}>
      {name.slice(0, 1)}
    </span>
  );
}

export function StudentFormFields({
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

export interface ProfileFieldState {
  guardianName: string;
  setGuardianName: (v: string) => void;
  guardianPhone: string;
  setGuardianPhone: (v: string) => void;
  studentPhone: string;
  setStudentPhone: (v: string) => void;
  address: string;
  setAddress: (v: string) => void;
  healthNote: string;
  setHealthNote: (v: string) => void;
  memo: string;
  setMemo: (v: string) => void;
}

export function ProfileFields(p: ProfileFieldState) {
  return (
    <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        <div style={{ flex: '1 1 140px' }}>
          <label className="field-label">보호자</label>
          <input className="input" value={p.guardianName} onChange={(e) => p.setGuardianName(e.target.value)} />
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <label className="field-label">보호자 연락처</label>
          <input className="input" value={p.guardianPhone} onChange={(e) => p.setGuardianPhone(e.target.value)} placeholder="010-0000-0000" />
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <label className="field-label">학생 연락처</label>
          <input className="input" value={p.studentPhone} onChange={(e) => p.setStudentPhone(e.target.value)} placeholder="010-0000-0000" />
        </div>
      </div>
      <div className="field" style={{ marginTop: 10, marginBottom: 0 }}>
        <label className="field-label">주소</label>
        <input className="input" value={p.address} onChange={(e) => p.setAddress(e.target.value)} />
      </div>
      <div className="field" style={{ marginTop: 10, marginBottom: 0 }}>
        <label className="field-label">건강·알레르기 등 특이사항</label>
        <input className="input" value={p.healthNote} onChange={(e) => p.setHealthNote(e.target.value)} />
      </div>
      <div className="field" style={{ marginTop: 10, marginBottom: 0 }}>
        <label className="field-label">메모</label>
        <textarea rows={2} value={p.memo} onChange={(e) => p.setMemo(e.target.value)} />
      </div>
    </>
  );
}

export function useProfileFieldState(student?: Partial<Student>): ProfileFieldState {
  const [guardianName, setGuardianName] = useState(student?.guardian_name ?? '');
  const [guardianPhone, setGuardianPhone] = useState(student?.guardian_phone ?? '');
  const [studentPhone, setStudentPhone] = useState(student?.student_phone ?? '');
  const [address, setAddress] = useState(student?.address ?? '');
  const [healthNote, setHealthNote] = useState(student?.health_note ?? '');
  const [memo, setMemo] = useState(student?.memo ?? '');
  return {
    guardianName,
    setGuardianName,
    guardianPhone,
    setGuardianPhone,
    studentPhone,
    setStudentPhone,
    address,
    setAddress,
    healthNote,
    setHealthNote,
    memo,
    setMemo
  };
}

// 상태 점수(1~5) 추이를 보여주는 작은 SVG 스파크라인. 외부 차트 라이브러리 없이 가볍게 구현.
export function ScoreTrend({ records }: { records: ConsultRecord[] }) {
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

export function FollowUpStatus({ r }: { r: ConsultRecord }) {
  if (!r.follow_up_needed) return <span style={{ color: 'var(--text-faint)' }}>-</span>;
  return <span style={{ color: r.follow_up_done ? 'var(--success)' : 'var(--danger)' }}>{r.follow_up_done ? '완료' : '대기'}</span>;
}

export function InfoRow({ label, value, tone }: { label: string; value?: string | null; tone?: 'danger' }) {
  return (
    <div className="info-row">
      <span className="info-row-label">{label}</span>
      <span style={{ color: value ? (tone === 'danger' ? 'var(--danger)' : 'var(--text)') : 'var(--text-faint)' }}>{value || '미입력'}</span>
    </div>
  );
}

export function MiniMetric({ label, value }: { label: string; value: string | number }) {
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
