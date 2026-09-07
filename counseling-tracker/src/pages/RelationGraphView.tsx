import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// 관계 점수(1~5) → 엣지 색. 1=빨강(갈등) … 5=초록(친밀). 점수 없으면 회색.
export function edgeColor(score: number | null) {
  if (score == null) return '#9aa5b1';
  const colors = ['#d94848', '#e07b39', '#e0b13a', '#7cb356', '#2f9e44'];
  return colors[Math.max(0, Math.min(4, Math.round(score) - 1))];
}

const SCORE_LEGEND = [
  { score: 1, label: '갈등·나쁨' },
  { score: 2, label: '다소 나쁨' },
  { score: 3, label: '보통' },
  { score: 4, label: '다소 좋음' },
  { score: 5, label: '친밀·좋음' }
];

interface Layout {
  x: number;
  y: number;
}

// 원형 배치: 노드를 원 위에 균등 배치 (외부 라이브러리 없이 결정적 레이아웃)
function circleLayout(count: number, w: number, h: number): Layout[] {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) / 2 - 46;
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / Math.max(1, count)) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });
}

export default function RelationGraphView() {
  const navigate = useNavigate();
  const [graph, setGraph] = useState<RelationGraph | null>(null);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoverEdge, setHoverEdge] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    window.api.getRelationGraph().then(setGraph);
  }, []);

  const W = 900;
  const H = 560;

  // 검색어 필터: 해당 학생이 포함된 엣지만
  const filteredEdges = useMemo(() => {
    if (!graph) return [];
    const q = query.trim();
    if (!q) return graph.edges;
    return graph.edges.filter((e) => e.aName.includes(q) || e.bName.includes(q));
  }, [graph, query]);

  // 선택 학생 필터: 그 학생과 직접 연결된 엣지만
  const visibleEdges = useMemo(() => {
    if (selectedId == null) return filteredEdges;
    return filteredEdges.filter((e) => e.a === selectedId || e.b === selectedId);
  }, [filteredEdges, selectedId]);

  const visibleNodes = useMemo(() => {
    if (!graph) return [];
    const ids = new Set<number>();
    for (const e of visibleEdges) {
      ids.add(e.a);
      ids.add(e.b);
    }
    return graph.nodes.filter((n) => ids.has(n.id));
  }, [graph, visibleEdges]);

  const pos = useMemo(() => {
    const layout = circleLayout(visibleNodes.length, W, H);
    const map = new Map<number, Layout>();
    visibleNodes.forEach((n, i) => map.set(n.id, layout[i]));
    return map;
  }, [visibleNodes]);

  const nameOf = useMemo(() => {
    const m = new Map<number, string>();
    graph?.nodes.forEach((n) => m.set(n.id, n.name));
    return m;
  }, [graph]);

  const matchedStudents = useMemo(() => {
    const q = query.trim();
    if (!q || !graph) return [];
    return graph.nodes.filter((n) => n.name.includes(q)).slice(0, 8);
  }, [query, graph]);

  if (!graph) return <div className="empty-state">불러오는 중…</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">관계 그래프</h1>
        <p className="page-subtitle">
          학생 간 관계(갈등·친밀)를 그래프로 봅니다. 엣지 색은 가장 최근 관계 점수 기준입니다.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 8, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 300 }}>
          <input
            className="input"
            placeholder="학생 이름 검색 (예: 김민준)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedId(null);
            }}
          />
          {matchedStudents.length > 0 && selectedId == null && (
            <div className="card" style={{ position: 'absolute', zIndex: 10, marginTop: 4, padding: 4, width: '100%' }}>
              {matchedStudents.map((s) => (
                <div
                  key={s.id}
                  className="dropdown-item"
                  onClick={() => {
                    setQuery(s.name);
                    setSelectedId(s.id);
                  }}
                >
                  {s.name}
                </div>
              ))}
            </div>
          )}
        </div>
        {(selectedId != null || query.trim()) && (
          <button
            className="btn btn-sm"
            onClick={() => {
              setSelectedId(null);
              setQuery('');
            }}
          >
            전체 그래프로
          </button>
        )}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginLeft: 'auto', flexWrap: 'wrap' }}>
          {SCORE_LEGEND.map((l) => (
            <span key={l.score} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--text-secondary)' }}>
              <span style={{ width: 18, height: 4, background: edgeColor(l.score), display: 'inline-block' }} />
              {l.score}점 {l.label}
            </span>
          ))}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--text-secondary)' }}>
            <span style={{ width: 18, height: 4, background: edgeColor(null), display: 'inline-block' }} />
            점수 없음
          </span>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {visibleEdges.length === 0 ? (
          <div className="empty-state">
            <div>{graph.edges.length === 0 ? '아직 학생 간 관계 기록이 없습니다.' : '조건에 맞는 관계가 없습니다.'}</div>
            {graph.edges.length === 0 && (
              <p style={{ fontSize: 12, marginTop: 4, color: 'var(--text-faint)' }}>
                기록 입력에서 "관련 대상"을 학생으로 지정하고 관계 점수를 남기면 그래프에 표시됩니다.
              </p>
            )}
          </div>
        ) : (
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', background: 'var(--bg-card)' }}>
            {/* 엣지 */}
            {visibleEdges.map((e, i) => {
              const pa = pos.get(e.a);
              const pb = pos.get(e.b);
              if (!pa || !pb) return null;
              const color = edgeColor(e.latestScore);
              const width = Math.min(7, 1.5 + e.count * 0.8);
              const active = hoverEdge === i;
              return (
                <g key={`e${i}`}>
                  <line
                    x1={pa.x}
                    y1={pa.y}
                    x2={pb.x}
                    y2={pb.y}
                    stroke={color}
                    strokeWidth={active ? width + 1.5 : width}
                    strokeDasharray={e.bidirectional ? undefined : '5 3'}
                    opacity={active ? 1 : 0.75}
                  />
                  {/* hover hit 영역 */}
                  <line
                    x1={pa.x}
                    y1={pa.y}
                    x2={pb.x}
                    y2={pb.y}
                    stroke="transparent"
                    strokeWidth={12}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoverEdge(i)}
                    onMouseLeave={() => setHoverEdge(null)}
                  />
                  {active && (
                    <text
                      x={(pa.x + pb.x) / 2}
                      y={(pa.y + pb.y) / 2 - 6}
                      textAnchor="middle"
                      fontSize={11}
                      fill="var(--text)"
                      style={{ paintOrder: 'stroke', stroke: 'var(--bg-card)', strokeWidth: 4 }}
                    >
                      {e.aName} ↔ {e.bName} · 최근 {e.latestScore ?? '-'}점 · {e.count}회{e.bidirectional ? ' · 양방향' : ''}
                    </text>
                  )}
                </g>
              );
            })}

            {/* 노드 */}
            {visibleNodes.map((n) => {
              const p = pos.get(n.id);
              if (!p) return null;
              const isSel = selectedId === n.id;
              return (
                <g
                  key={n.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedId(isSel ? null : n.id)}
                  onDoubleClick={() => navigate(`/students/${n.id}`)}
                >
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isSel ? 15 : 12}
                    fill={isSel ? 'var(--accent)' : 'var(--bg-card)'}
                    stroke={isSel ? 'var(--accent-strong)' : 'var(--border-strong)'}
                    strokeWidth={1.5}
                  />
                  <text
                    x={p.x}
                    y={p.y + 4}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={700}
                    fill={isSel ? '#fff' : 'var(--accent-strong)'}
                  >
                    {n.name.slice(0, 1)}
                  </text>
                  <text
                    x={p.x}
                    y={p.y + (isSel ? 30 : 27)}
                    textAnchor="middle"
                    fontSize={11.5}
                    fontWeight={600}
                    fill="var(--text)"
                    style={{ paintOrder: 'stroke', stroke: 'var(--bg-card)', strokeWidth: 3 }}
                  >
                    {n.name}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      <p style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 6 }}>
        노드 클릭 = 그 학생의 관계만 보기 · 더블클릭 = 학생 프로필 · 실선 = 양방향 기록, 점선 = 한쪽 기록만 · 선 굵기 = 언급 횟수
      </p>
    </div>
  );
}
