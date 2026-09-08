import { useEffect, useMemo, useState } from 'react';

export interface StudentFilterValue {
  query: string;
  grade: string; // '' = 전체
  classNo: string; // '' = 전체
}

export const EMPTY_STUDENT_FILTER: StudentFilterValue = { query: '', grade: '', classNo: '' };

// 기록 조회·학생 관리·관계 그래프에서 공통으로 쓰는 학생 찾기 필터.
// 이름 검색 + 학년 + 반 선택. 학년/반 옵션은 실제 등록된 학생 목록에서 추출한다.
export default function StudentFilter({
  value,
  onChange,
  placeholder = '이름 또는 번호 검색'
}: {
  value: StudentFilterValue;
  onChange: (v: StudentFilterValue) => void;
  placeholder?: string;
}) {
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    window.api.getStudents(false).then(setStudents);
  }, []);

  const grades = useMemo(() => {
    const set = new Set<number>();
    for (const s of students) if (s.grade != null) set.add(s.grade);
    return Array.from(set).sort((a, b) => a - b);
  }, [students]);

  const classes = useMemo(() => {
    const set = new Set<number>();
    for (const s of students) {
      if (s.class_no == null) continue;
      if (value.grade !== '' && s.grade !== Number(value.grade)) continue;
      set.add(s.class_no);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [students, value.grade]);

  const active = value.query !== '' || value.grade !== '' || value.classNo !== '';

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        className="input"
        style={{ flex: '1 1 140px', minWidth: 120 }}
        placeholder={placeholder}
        value={value.query}
        onChange={(e) => onChange({ ...value, query: e.target.value })}
      />
      <select
        className="select"
        style={{ width: 92, flexShrink: 0 }}
        value={value.grade}
        onChange={(e) => onChange({ ...value, grade: e.target.value, classNo: '' })}
        title="학년 필터"
      >
        <option value="">학년 전체</option>
        {grades.map((g) => (
          <option key={g} value={g}>
            {g}학년
          </option>
        ))}
      </select>
      <select
        className="select"
        style={{ width: 80, flexShrink: 0 }}
        value={value.classNo}
        onChange={(e) => onChange({ ...value, classNo: e.target.value })}
        title="반 필터"
      >
        <option value="">반 전체</option>
        {classes.map((c) => (
          <option key={c} value={c}>
            {c}반
          </option>
        ))}
      </select>
      {active && (
        <button type="button" className="btn btn-sm" onClick={() => onChange(EMPTY_STUDENT_FILTER)}>
          초기화
        </button>
      )}
    </div>
  );
}

// 필터 값으로 학생 목록을 걸러내는 헬퍼 (클라이언트 사이드).
export function applyStudentFilter<T extends Student>(students: T[], f: StudentFilterValue): T[] {
  const q = f.query.trim();
  return students.filter((s) => {
    if (q && !s.name.includes(q) && !String(s.number ?? '').includes(q)) return false;
    if (f.grade !== '' && s.grade !== Number(f.grade)) return false;
    if (f.classNo !== '' && s.class_no !== Number(f.classNo)) return false;
    return true;
  });
}
