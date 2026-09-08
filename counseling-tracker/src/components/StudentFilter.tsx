import { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import { FilterIcon } from './icons';

export interface StudentFilterValue {
  query: string; // '' = 전체
  grade: string; // '' = 전체
  classNo: string; // '' = 전체
}

export const EMPTY_STUDENT_FILTER: StudentFilterValue = { query: '', grade: '', classNo: '' };

// 기록 조회·학생 관리·관계 그래프에서 공통으로 쓰는 학생 찾기 필터.
// 검색 입력 + 필터 아이콘 버튼. 학년·반(+선택적으로 기록 유형) 선택은 모달에서 한다(자리 차지 최소화).
export default function StudentFilter({
  value,
  onChange,
  placeholder = '이름 또는 번호 검색',
  types,
  typeIds,
  onTypeIdsChange
}: {
  value: StudentFilterValue;
  onChange: (v: StudentFilterValue) => void;
  placeholder?: string;
  // 기록 유형 필터(조회 화면에서만 사용): types를 넘기면 모달에 유형 선택이 추가된다.
  types?: ConsultType[];
  typeIds?: number[];
  onTypeIdsChange?: (ids: number[]) => void;
}) {
  const [students, setStudents] = useState<Student[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  // 모달 안 임시 값 — "적용"을 눌러야 반영된다.
  const [draft, setDraft] = useState<StudentFilterValue>(value);
  const [draftTypeIds, setDraftTypeIds] = useState<number[]>(typeIds ?? []);

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
      if (draft.grade !== '' && s.grade !== Number(draft.grade)) continue;
      set.add(s.class_no);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [students, draft.grade]);

  const filterActive = value.grade !== '' || value.classNo !== '' || (typeIds?.length ?? 0) > 0;

  function openModal() {
    setDraft(value);
    setDraftTypeIds(typeIds ?? []);
    setModalOpen(true);
  }

  function applyDraft() {
    onChange(draft);
    onTypeIdsChange?.(draftTypeIds);
    setModalOpen(false);
  }

  const activeLabel = [
    value.grade ? `${value.grade}학년` : null,
    value.classNo ? `${value.classNo}반` : null,
    types && typeIds && typeIds.length > 0 ? `유형 ${typeIds.length}개` : null
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input
        className="input"
        style={{ flex: 1, minWidth: 0 }}
        placeholder={placeholder}
        value={value.query}
        onChange={(e) => onChange({ ...value, query: e.target.value })}
      />
      <button
        type="button"
        className={'btn btn-icon' + (filterActive ? ' btn-icon-active' : '')}
        title={filterActive ? `필터 적용됨 (${activeLabel}) — 클릭해 변경` : '학년·반 필터'}
        onClick={openModal}
      >
        <FilterIcon />
      </button>
      {filterActive && (
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => {
            onChange({ ...value, grade: '', classNo: '' });
            onTypeIdsChange?.([]);
          }}
        >
          {activeLabel} ✕
        </button>
      )}

      {modalOpen && (
        <Modal title="필터" onClose={() => setModalOpen(false)} maxWidth={380}>
          <div className="field">
            <label className="field-label">학년</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              <button
                type="button"
                className={'btn btn-sm' + (draft.grade === '' ? ' btn-primary' : '')}
                onClick={() => setDraft((d) => ({ ...d, grade: '', classNo: '' }))}
              >
                전체
              </button>
              {grades.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={'btn btn-sm' + (draft.grade === String(g) ? ' btn-primary' : '')}
                  onClick={() => setDraft((d) => ({ ...d, grade: String(g), classNo: '' }))}
                >
                  {g}학년
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label className="field-label">반</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              <button
                type="button"
                className={'btn btn-sm' + (draft.classNo === '' ? ' btn-primary' : '')}
                onClick={() => setDraft((d) => ({ ...d, classNo: '' }))}
              >
                전체
              </button>
              {classes.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={'btn btn-sm' + (draft.classNo === String(c) ? ' btn-primary' : '')}
                  onClick={() => setDraft((d) => ({ ...d, classNo: String(c) }))}
                >
                  {c}반
                </button>
              ))}
            </div>
          </div>
          {types && (
            <div className="field">
              <label className="field-label">기록 유형 (복수 선택 가능, 미선택 = 전체)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {types.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={'btn btn-sm' + (draftTypeIds.includes(t.id) ? ' btn-primary' : '')}
                    onClick={() =>
                      setDraftTypeIds((cur) => (cur.includes(t.id) ? cur.filter((x) => x !== t.id) : [...cur, t.id]))
                    }
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setDraft(EMPTY_STUDENT_FILTER);
                setDraftTypeIds([]);
                onChange(EMPTY_STUDENT_FILTER);
                onTypeIdsChange?.([]);
                setModalOpen(false);
              }}
            >
              전체 초기화
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={applyDraft}>
              적용
            </button>
          </div>
        </Modal>
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
