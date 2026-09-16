import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, ProfileFields, StudentFormFields, formatClassInfo, useProfileFieldState } from './studentShared';
import { PinIcon, PlusIcon, SortIcon } from '../components/icons';
import Modal from '../components/Modal';
import Tabs from '../components/Tabs';
import { useContextMenu } from '../components/ContextMenu';
import StudentFilter, { EMPTY_STUDENT_FILTER, applyStudentFilter, type StudentFilterValue } from '../components/StudentFilter';

type SortKey = 'name' | 'schoolYear' | 'grade' | 'classNo' | 'number';

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'name', label: '이름' },
  { key: 'schoolYear', label: '학년도' },
  { key: 'grade', label: '학년' },
  { key: 'classNo', label: '반' },
  { key: 'number', label: '번호' }
];

export default function StudentsView() {
  const navigate = useNavigate();
  const ctx = useContextMenu();

  const [students, setStudents] = useState<StudentWithStats[]>([]);
  const [filter, setFilter] = useState<StudentFilterValue>(EMPTY_STUDENT_FILTER);
  const [sortKey, setSortKey] = useState<SortKey>('grade');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [addTab, setAddTab] = useState<'manual' | 'excel'>('manual');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  function refresh() {
    setLoading(true);
    window.api
      .getStudentsWithStats()
      .then(setStudents)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => applyStudentFilter(students, filter), [students, filter]);

  const sorted = useMemo(() => {
    const val = (s: StudentWithStats): string | number => {
      switch (sortKey) {
        case 'name':
          return s.name;
        case 'schoolYear':
          return s.school_year ?? '';
        case 'grade':
          return s.grade ?? 999;
        case 'classNo':
          return s.class_no ?? 999;
        case 'number':
          return s.number ?? 999;
      }
    };
    const dir = sortDir === 'asc' ? 1 : -1;
    return filtered.slice().sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (typeof va === 'string' && typeof vb === 'string') return va.localeCompare(vb, 'ko') * dir;
      return ((va as number) - (vb as number)) * dir;
    });
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  async function handleExcelImport() {
    setImporting(true);
    setImportResult(null);
    try {
      const result = await window.api.importStudents();
      if (result.canceled) return;
      if (result.error) {
        setImportResult({ tone: 'err', text: result.error });
        return;
      }
      setImportResult({
        tone: 'ok',
        text: `${result.imported}명을 등록했습니다.${result.skipped > 0 ? ` ${result.skipped}행은 이름 없음 또는 중복으로 건너뛰었습니다.` : ''}`
      });
      refresh();
    } finally {
      setImporting(false);
    }
  }

  async function handleTogglePin(s: StudentWithStats) {
    await window.api.togglePin(s.id);
    refresh();
  }

  async function handleDelete(s: StudentWithStats) {
    if (!confirm(`${s.name} 학생을 삭제할까요? 이 학생의 기록도 모두 함께 삭제되며 되돌릴 수 없습니다.`)) return;
    await window.api.deleteStudent(s.id);
    refresh();
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">학생 관리</h1>
        <p className="page-subtitle">
          학생 정보를 확인·수정하고, 학생별 전체 기록을 한눈에 봅니다. 열 제목을 눌러 정렬하고, 행을 우클릭하면 빠른 메뉴가 열립니다.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: '1 1 260px', minWidth: 220 }}>
          <StudentFilter value={filter} onChange={setFilter} />
        </div>
        <button
          className="btn btn-primary"
          style={{ whiteSpace: 'nowrap' }}
          onClick={() => {
            setAddTab('manual');
            setImportResult(null);
            setAdding(true);
          }}
        >
          <PlusIcon /> 학생 추가
        </button>
      </div>

      {adding && (
        <Modal title="학생 추가" onClose={() => setAdding(false)} maxWidth={560}>
          <div style={{ marginBottom: 14 }}>
            <Tabs
              tabs={[
                { key: 'manual', label: '직접 입력' },
                { key: 'excel', label: '엑셀 등록' }
              ]}
              active={addTab}
              onChange={setAddTab}
            />
          </div>
          {addTab === 'manual' ? (
            <AddStudentForm
              onCancel={() => setAdding(false)}
              onAdded={(s) => {
                setAdding(false);
                refresh();
                navigate(`/students/${s.id}`);
              }}
            />
          ) : (
            <ExcelImportPanel
              importing={importing}
              result={importResult}
              onImport={handleExcelImport}
              onClose={() => setAdding(false)}
            />
          )}
        </Modal>
      )}

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="empty-state">불러오는 중…</div>
        ) : sorted.length === 0 ? (
          <div className="empty-state">
            <div>{students.length === 0 ? '등록된 학생이 없습니다.' : '검색 결과가 없습니다.'}</div>
          </div>
        ) : (
          <table className="record-table">
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.key} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => toggleSort(c.key)} title={`${c.label} 정렬 (다시 누르면 방향 전환)`}>
                    {c.label}
                    {sortKey === c.key && <SortIcon dir={sortDir} />}
                  </th>
                ))}
                <th>기록 건수</th>
                <th>최근 기록</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr
                  key={s.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/students/${s.id}`)}
                  onContextMenu={(e) =>
                    ctx.open(e, [
                      { label: '학생 프로필 열기', onClick: () => navigate(`/students/${s.id}`) },
                      { label: '기록 추가', onClick: () => navigate('/input', { state: { studentId: s.id, studentName: s.name } }) },
                      { label: '이 학생 기록 조회', onClick: () => navigate('/search', { state: { studentId: s.id } }) },
                      { label: s.pinned ? '즐겨찾기 해제' : '즐겨찾기 고정', onClick: () => handleTogglePin(s) },
                      { label: '학생 삭제', danger: true, separatorBefore: true, onClick: () => handleDelete(s) }
                    ])
                  }
                >
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <Avatar name={s.name} size={20} />
                      {s.name}
                      {!!s.pinned && (
                        <span style={{ color: 'var(--accent)' }} title="즐겨찾기 고정됨">
                          <PinIcon filled />
                        </span>
                      )}
                    </div>
                  </td>
                  <td>{s.school_year ?? '-'}</td>
                  <td>{s.grade != null ? `${s.grade}학년` : '-'}</td>
                  <td>{s.class_no != null ? `${s.class_no}반` : '-'}</td>
                  <td>{s.number != null ? `${s.number}번` : '-'}</td>
                  <td>{s.record_count}</td>
                  <td>{s.last_record_date ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 6 }}>
        {sorted.length}명 표시 중 · 정렬: {COLUMNS.find((c) => c.key === sortKey)?.label} {sortDir === 'asc' ? '오름차순' : '내림차순'}
      </p>
      {ctx.element}
    </div>
  );
}

function AddStudentForm({ onCancel, onAdded }: { onCancel: () => void; onAdded: (s: Student) => void }) {
  const [name, setName] = useState('');
  const [schoolYear, setSchoolYear] = useState('');
  const [grade, setGrade] = useState('');
  const [classNo, setClassNo] = useState('');
  const [number, setNumber] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const profile = useProfileFieldState();
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const student = await window.api.addStudent({
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
      onAdded(student);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 140px' }}>
          <label className="field-label">이름 *</label>
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
      <button
        type="button"
        className="btn btn-sm"
        style={{ marginTop: 10 }}
        onClick={() => setShowProfile((v) => !v)}
      >
        {showProfile ? '보호자·연락처 정보 접기' : '보호자·연락처 정보 입력 (선택)'}
      </button>
      {showProfile && <ProfileFields {...profile} />}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 10 }}>
        <button className="btn btn-primary" disabled={saving || !name.trim()} onClick={handleAdd}>
          추가
        </button>
        <button className="btn" onClick={onCancel}>
          취소
        </button>
      </div>
    </div>
  );
}

// 학생 추가 모달의 '엑셀 등록' 탭: 명부 양식 다운로드 + 일괄 등록을 한곳에서.
function ExcelImportPanel({
  importing,
  result,
  onImport,
  onClose
}: {
  importing: boolean;
  result: { tone: 'ok' | 'err'; text: string } | null;
  onImport: () => void;
  onClose: () => void;
}) {
  return (
    <div>
      <p style={{ color: 'var(--text-secondary)', fontSize: 12.5, marginTop: 0 }}>
        엑셀 파일(학년도 · 학년 · 반 · 번호 · 이름, 선택: 보호자 · 연락처 · 주소 · 특이사항 · 메모)로 학생 명부를 일괄 등록합니다.
        이미 등록된 학생(이름·학년도·학년·반·번호 동일)은 자동으로 건너뜁니다.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" disabled={importing} onClick={onImport}>
          {importing ? '가져오는 중…' : '엑셀 파일 선택 후 등록'}
        </button>
        <button
          className="btn"
          onClick={() => window.api.downloadStudentTemplate()}
          title="학년도·학년·반·번호·이름·보호자 등 컬럼이 들어간 엑셀 양식을 저장합니다"
        >
          명부 양식 다운로드
        </button>
      </div>
      {result && (
        <p style={{ fontSize: 12.5, color: result.tone === 'ok' ? 'var(--success)' : 'var(--danger)', marginTop: 10, marginBottom: 0 }}>
          {result.text}
        </p>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 10 }}>
        <button className="btn" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}
