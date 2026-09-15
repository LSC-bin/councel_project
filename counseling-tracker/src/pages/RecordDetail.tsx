import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { RelationEditor } from './recordShared';
import { TrashIcon, BackIcon, CalendarIcon, FolderIcon, EditIcon } from '../components/icons';
import { Avatar, formatClassInfo } from './studentShared';
import ActionList from '../components/ActionList';
import Modal from '../components/Modal';

const REFERRAL_OPTIONS = ['Wee클래스', '학폭담당', '보건교사', '학부모', '기타'];

// 상태 점수 색: 1=빨강(어려움) ~ 5=초록(좋음). 관계 그래프 엣지 색과 같은 척도.
function scoreColorLocal(score: number): string {
  const colors = ['#c93c3c', '#d07a2f', '#b09417', '#6f9e3f', '#2e7d46'];
  return colors[Math.min(4, Math.max(0, score - 1))];
}

export default function RecordDetail() {
  const { id } = useParams<{ id: string }>();
  const recordId = Number(id);
  const navigate = useNavigate();
  const location = useLocation();
  // 어디서 들어왔는지: 학생 프로필에서 오면 뒤로가기 시 그곳으로, 아니면 조회·검색으로
  const backTo = (location.state as { from?: string } | null)?.from ?? '/search';
  const backLabel = (location.state as { fromLabel?: string } | null)?.fromLabel ?? '조회·검색';

  const [record, setRecord] = useState<ConsultRecord | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [types, setTypes] = useState<ConsultType[]>([]);
  const [folders, setFolders] = useState<RecordFolder[]>([]);
  const [editing, setEditing] = useState(false);
  const [folderPicker, setFolderPicker] = useState(false);

  const [typeId, setTypeId] = useState<number>(0);
  const [folderId, setFolderId] = useState<number | null>(null);
  const [content, setContent] = useState('');
  const [stateScore, setStateScore] = useState<number | null>(null);
  const [followUpNeeded, setFollowUpNeeded] = useState(false);
  const [followUpDone, setFollowUpDone] = useState(false);
  const [referredTo, setReferredTo] = useState<string[]>([]);
  const [reflectedInNice, setReflectedInNice] = useState(false);
  const [relations, setRelations] = useState<RecordRelationInput[]>([]);
  const [savedRelations, setSavedRelations] = useState<RecordRelation[]>([]);
  const [saving, setSaving] = useState(false);

  function loadRelations() {
    window.api.getRecordRelations(recordId).then((rows) => {
      setSavedRelations(rows);
      setRelations(
        rows.map((r) => ({
          related_type: r.related_type,
          related_student_id: r.related_student_id,
          related_label: r.related_label,
          relation_score: r.relation_score,
          note: r.note
        }))
      );
    });
  }

  function loadRecord() {
    window.api.getRecordById(recordId).then((r) => {
      if (!r) {
        setNotFound(true);
        return;
      }
      setRecord(r);
      setTypeId(r.type_id);
      setFolderId(r.folder_id ?? null);
      setContent(r.content ?? '');
      setStateScore(r.state_score);
      setFollowUpNeeded(!!r.follow_up_needed);
      setFollowUpDone(!!r.follow_up_done);
      setReferredTo(r.referred_to ? r.referred_to.split(',').filter(Boolean) : []);
      setReflectedInNice(!!r.reflected_in_nice);
      window.api.getStudentById(r.student_id).then((s) => setStudent(s ?? null));
    });
  }

  useEffect(() => {
    if (!recordId || Number.isNaN(recordId)) {
      setNotFound(true);
      return;
    }
    setNotFound(false);
    setEditing(false);
    loadRecord();
    loadRelations();
    window.api.getConsultTypes().then(setTypes);
    window.api.getFolders().then(setFolders);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId]);

  function toggleReferral(option: string) {
    setReferredTo((cur) => (cur.includes(option) ? cur.filter((o) => o !== option) : [...cur, option]));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await window.api.updateRecord(recordId, {
        type_id: typeId,
        folder_id: folderId,
        content,
        state_score: stateScore,
        follow_up_needed: followUpNeeded,
        follow_up_done: followUpDone,
        referred_to: referredTo.join(','),
        reflected_in_nice: reflectedInNice
      });
      await window.api.setRecordRelations(recordId, relations);
      setEditing(false);
      loadRecord();
      loadRelations();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('이 기록을 삭제할까요? 되돌릴 수 없습니다.')) return;
    await window.api.deleteRecord(recordId);
    navigate(backTo);
  }

  if (notFound) {
    return (
      <div>
        <div className="page-header">
          <button className="back-btn" onClick={() => navigate(backTo)} title={`${backLabel}으로 돌아가기`}>
            <BackIcon />
          </button>
        </div>
        <div className="card empty-state">기록을 찾을 수 없습니다.</div>
      </div>
    );
  }

  if (!record) {
    return <div className="empty-state">불러오는 중…</div>;
  }

  return (
    <div>
      <div className="page-header" style={{ alignItems: 'center' }}>
        <button className="back-btn" onClick={() => navigate(backTo)} title={`${backLabel}으로 돌아가기`}>
          <BackIcon />
        </button>
        <Avatar name={record.student_name} size={34} />
        <div>
          <h1
            className="page-title page-title-link"
            onClick={() => navigate(`/students/${record.student_id}`)}
            title="학생 프로필로 이동"
          >
            {record.student_name}
          </h1>
          <p className="page-subtitle">
            {record.record_date}
            {student && formatClassInfo(student) !== '-' && ` · ${formatClassInfo(student)}`}
          </p>
        </div>
      </div>

      <div className="detail-grid">
        <div className="card detail-main">
        {!editing ? (
          <>
            <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <span className="badge" style={{ background: `${record.type_color}18`, color: record.type_color }}>
                {record.type_name}
              </span>
              <span className="badge" style={{ background: 'var(--bg-panel)', color: 'var(--text-secondary)' }}>
                <FolderIcon /> {record.folder_name ?? '미분류'}
              </span>
              <span style={{ fontSize: 11.5, color: 'var(--text-faint)', marginLeft: 'auto' }}>
                작성 {record.created_at?.slice(0, 16).replace('T', ' ')}
              </span>
            </div>
            <div className="detail-content">
              {record.content || <span style={{ color: 'var(--text-faint)' }}>내용 없음</span>}
            </div>
            {savedRelations.length > 0 && (
              <div className="field" style={{ marginBottom: 0, paddingTop: 10 }}>
                <label className="field-label">관련 대상</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {savedRelations.map((r) =>
                    r.related_type === '학생' && r.related_student_id ? (
                      <button
                        key={r.id}
                        type="button"
                        className="badge badge-link"
                        style={{ background: 'var(--bg-panel)', color: 'var(--text)' }}
                        onClick={() => navigate(`/students/${r.related_student_id}`)}
                        title="학생 프로필로 이동"
                      >
                        {r.related_type} · {r.related_student_name}
                        {r.relation_score != null && ` · ${r.relation_score}점`}
                      </button>
                    ) : (
                      <span key={r.id} className="badge" style={{ background: 'var(--bg-panel)', color: 'var(--text)' }}>
                        {r.related_type} · {r.related_label}
                        {r.relation_score != null && ` · ${r.relation_score}점`}
                      </span>
                    )
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8 }}>
              <div className="field" style={{ flex: 1 }}>
                <label className="field-label">기록 유형</label>
                <select className="select" value={typeId} onChange={(e) => setTypeId(Number(e.target.value))}>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label className="field-label">상담 폴더</label>
                <select
                  className="select"
                  value={folderId ?? ''}
                  onChange={(e) => setFolderId(e.target.value === '' ? null : Number(e.target.value))}
                >
                  <option value="">미분류</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <label className="field-label">내용</label>
              <textarea className="detail-textarea" value={content} onChange={(e) => setContent(e.target.value)} />
            </div>
          </>
        )}
        </div>

        <div className="card detail-side">
        {!editing ? (
          <>
            <div className="detail-meta">
              <div className="detail-meta-item">
                <span className="detail-meta-label">상태 점수</span>
                <strong style={{ fontSize: 18, color: record.state_score != null ? scoreColorLocal(record.state_score) : undefined }}>
                  {record.state_score ?? '-'}
                </strong>
              </div>
              <div className="detail-meta-item">
                <span className="detail-meta-label">후속조치</span>
                <strong style={{ color: !record.follow_up_needed ? undefined : record.follow_up_done ? 'var(--success)' : 'var(--danger)' }}>
                  {!record.follow_up_needed ? '불필요' : record.follow_up_done ? '완료' : '대기'}
                </strong>
              </div>
              <div className="detail-meta-item">
                <span className="detail-meta-label">생기부 반영</span>
                <strong style={{ color: record.reflected_in_nice ? 'var(--success)' : 'var(--danger)' }}>
                  {record.reflected_in_nice ? '완료' : '미반영'}
                </strong>
              </div>
              <div className="detail-meta-item">
                <span className="detail-meta-label">유관기관 연계</span>
                <strong>{record.referred_to ? record.referred_to.split(',').join(', ') : '-'}</strong>
              </div>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <ActionList recordId={recordId} studentId={record.student_id} />
            </div>
            <div className="detail-actions">
              <button className="btn btn-primary" onClick={() => setEditing(true)}>
                <EditIcon /> 수정
              </button>
              <button className="btn" onClick={() => setFolderPicker(true)}>
                <FolderIcon /> 폴더에 넣기
              </button>
              <button
                className="btn"
                onClick={() => navigate('/', { state: { studentId: record.student_id, studentName: record.student_name } })}
              >
                <CalendarIcon /> 예약 잡기
              </button>
              <button className="btn-icon btn-icon-danger" title="삭제" onClick={handleDelete}>
                <TrashIcon />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="field">
              <label className="field-label">상태 점수</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="btn"
                    style={stateScore === n ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)', flex: 1, justifyContent: 'center' } : { flex: 1, justifyContent: 'center' }}
                    onClick={() => setStateScore(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 500 }}>
                  <input type="checkbox" checked={followUpNeeded} onChange={(e) => setFollowUpNeeded(e.target.checked)} />
                  후속조치 필요
                </label>
                {followUpNeeded && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, whiteSpace: 'nowrap' }}>
                    <input type="checkbox" checked={followUpDone} onChange={(e) => setFollowUpDone(e.target.checked)} />
                    완료됨
                  </label>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 500 }}>
                  <input type="checkbox" checked={reflectedInNice} onChange={(e) => setReflectedInNice(e.target.checked)} />
                  생기부 반영 완료
                </label>
              </div>
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
              <label className="field-label">관련 대상 (갈등 상대 등)</label>
              <RelationEditor
                relations={relations}
                setRelations={setRelations}
                excludeStudentId={record.student_id}
                mainStudentName={record.student_name}
              />
            </div>
            <div className="detail-actions">
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
      </div>

      {folderPicker && (
        <Modal title="상담 폴더에 넣기" onClose={() => setFolderPicker(false)} maxWidth={360}>
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 0 }}>
            {record?.record_date} · {record?.student_name} 기록을 넣을 폴더를 선택하세요.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
            <button
              type="button"
              className="folder-item"
              onClick={async () => {
                await window.api.updateRecord(recordId, { folder_id: null });
                setFolderPicker(false);
                loadRecord();
              }}
            >
              미분류
            </button>
            {(() => {
              const rows: React.ReactNode[] = [];
              const walk = (parentId: number | null, depth: number) => {
                for (const f of folders
                  .filter((x) => (x.parent_id ?? null) === parentId)
                  .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999) || a.name.localeCompare(b.name))) {
                  rows.push(
                    <button
                      key={f.id}
                      type="button"
                      className="folder-item"
                      style={{
                        paddingLeft: 8 + depth * 14,
                        background: record?.folder_id === f.id ? 'var(--accent-bg)' : undefined
                      }}
                      onClick={async () => {
                        await window.api.updateRecord(recordId, { folder_id: f.id });
                        setFolderPicker(false);
                        loadRecord();
                      }}
                    >
                      {f.name}
                      {record?.folder_id === f.id && <span className="folder-count">현재</span>}
                    </button>
                  );
                  walk(f.id, depth + 1);
                }
              };
              walk(null, 0);
              return rows;
            })()}
          </div>
        </Modal>
      )}
    </div>
  );
}
