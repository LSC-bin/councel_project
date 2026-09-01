import { useEffect, useState } from 'react';

export default function Settings() {
  const [students, setStudents] = useState<Student[]>([]);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function refresh() {
    window.api.getStudents().then(setStudents);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleImport() {
    setImporting(true);
    setMessage(null);
    try {
      const result = await window.api.importStudents();
      if (result.canceled) return;
      setMessage(`${result.imported}명의 학생을 가져왔습니다.`);
      refresh();
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">설정</h1>
        <p className="page-subtitle">학생 명부, 상담 유형, 앱 환경을 관리합니다.</p>
      </div>

      <div className="section">
        <h2 className="section-title">학생 명부</h2>
        <div className="card">
          <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>
            엑셀 파일(번호 · 이름 · 학번)을 업로드해 학생 명부를 등록하세요.
          </p>
          <button className="btn btn-primary" disabled={importing} onClick={handleImport}>
            {importing ? '가져오는 중…' : '명부 업로드'}
          </button>
          {message && <p style={{ color: 'var(--success)', fontSize: 13, marginTop: 10 }}>{message}</p>}
          <p style={{ color: 'var(--text-faint)', fontSize: 12.5, marginTop: 14, marginBottom: 0 }}>
            현재 등록된 학생: {students.length}명
          </p>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">상담 유형 · 빠른 입력 템플릿 · 앱 잠금 · 학년도 전환</h2>
        <div className="card empty-state">
          <div className="empty-state-icon">⚙</div>
          <div>다음 단계에서 구현 예정입니다.</div>
        </div>
      </div>
    </div>
  );
}
