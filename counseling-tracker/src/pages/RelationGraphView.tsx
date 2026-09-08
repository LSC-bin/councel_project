import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useContextMenu } from '../components/ContextMenu';
import StudentFilter, { EMPTY_STUDENT_FILTER, applyStudentFilter, type StudentFilterValue } from '../components/StudentFilter';

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

// 힘 기반 레이아웃: 반발력 + 엣지 스프링 + 중심 인력을 반복 계산.
// 원형 배치보다 관계 뭉침(클러스터)이 자연스럽게 드러나고, 연결 많은 학생이 중앙으로 모인다.
// 결정적 결과를 위해 고정 시드로 원형 초기 배치 후 시뮬레이션한다.
function forceLayout(nodes: { id: number }[], edges: { a: number; b: number }[], w: number, h: number): Map<number, Layout> {
  const n = nodes.length;
  const pos = new Map<number, Layout>();
  const cx = w / 2;
  const cy = h / 2;
  const r0 = Math.min(w, h) / 2 - 60;
  nodes.forEach((node, i) => {
    const angle = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
    pos.set(node.id, { x: cx + r0 * Math.cos(angle), y: cy + r0 * Math.sin(angle) });
  });
  if (n <= 1) return pos;

  const idx = new Map<number, number>();
  nodes.forEach((node, i) => idx.set(node.id, i));
  const links = edges
    .map((e) => ({ i: idx.get(e.a)!, j: idx.get(e.b)! }))
    .filter((l) => l.i != null && l.j != null);

  const ITER = 220;
  const REPULSE = 9000;
  const SPRING = 0.02;
  const SPRING_LEN = 110;
  const GRAVITY = 0.012;
  const DAMP = 0.85;
  const vx = new Array(n).fill(0);
  const vy = new Array(n).fill(0);
  const pts = nodes.map((node) => pos.get(node.id)!);

  for (let it = 0; it < ITER; it++) {
    // 반발력
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = pts[i].x - pts[j].x;
        let dy = pts[i].y - pts[j].y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) {
          dx = (Math.sin(i * 12.9898 + j * 78.233) + 1) * 0.5 + 0.1;
          dy = (Math.cos(i * 39.3468 + j * 11.135) + 1) * 0.5 + 0.1;
          d2 = dx * dx + dy * dy;
        }
        const f = REPULSE / d2;
        const d = Math.sqrt(d2);
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        vx[i] += fx;
        vy[i] += fy;
        vx[j] -= fx;
        vy[j] -= fy;
      }
    }
    // 스프링
    for (const l of links) {
      const dx = pts[l.j].x - pts[l.i].x;
      const dy = pts[l.j].y - pts[l.i].y;
      const d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const f = SPRING * (d - SPRING_LEN);
      const fx = (dx / d) * f;
      const fy = (dy / d) * f;
      vx[l.i] += fx;
      vy[l.i] += fy;
      vx[l.j] -= fx;
      vy[l.j] -= fy;
    }
    // 중심 중력 + 적분
    for (let i = 0; i < n; i++) {
      vx[i] += (cx - pts[i].x) * GRAVITY;
      vy[i] += (cy - pts[i].y) * GRAVITY;
      vx[i] *= DAMP;
      vy[i] *= DAMP;
      pts[i].x += Math.max(-12, Math.min(12, vx[i]));
      pts[i].y += Math.max(-12, Math.min(12, vy[i]));
      pts[i].x = Math.max(40, Math.min(w - 40, pts[i].x));
      pts[i].y = Math.max(34, Math.min(h - 40, pts[i].y));
    }
  }
  nodes.forEach((node, i) => pos.set(node.id, pts[i]));
  return pos;
}

type ConflictFilter = 'all' | 'conflict' | 'positive';

export default function RelationGraphView() {
  const navigate = useNavigate();
  const ctx = useContextMenu();
  const [graph, setGraph] = useState<RelationGraph | null>(null);
  const [studentFilter, setStudentFilter] = useState<StudentFilterValue>(EMPTY_STUDENT_FILTER);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoverEdge, setHoverEdge] = useState<number | null>(null);
  const [conflictFilter, setConflictFilter] = useState<ConflictFilter>('all');
  const [zoom, setZoom] = useState(1);
  const [dragged, setDragged] = useState<{ id: number; dx: number; dy: number } | null>(null);
  const [manualPos, setManualPos] = useState<Map<number, Layout>>(new Map());
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    window.api.getRelationGraph().then(setGraph);
  }, []);

  const W = 900;
  const H = 560;

  // 학생 필터: 조건에 맞는 학생이 포함된 엣지만
  const filteredNodeIds = useMemo(() => {
    if (!graph) return null;
    const q = studentFilter.query.trim();
    const active = q !== '' || studentFilter.grade !== '' || studentFilter.classNo !== '';
    if (!active) return null;
    const ids = new Set<number>();
    for (const n of graph.nodes) {
      if (q && !n.name.includes(q) && !String(n.number ?? '').includes(q)) continue;
      if (studentFilter.grade !== '' && n.grade !== Number(studentFilter.grade)) continue;
      if (studentFilter.classNo !== '' && n.classNo !== Number(studentFilter.classNo)) continue;
      ids.add(n.id);
    }
    return ids;
  }, [graph, studentFilter]);

  const filterActive = filteredNodeIds != null;

  const filteredEdges = useMemo(() => {
    if (!graph) return [];
    let edges = graph.edges;
    if (filteredNodeIds) edges = edges.filter((e) => filteredNodeIds.has(e.a) || filteredNodeIds.has(e.b));
    if (conflictFilter === 'conflict') edges = edges.filter((e) => e.latestScore != null && e.latestScore <= 2);
    if (conflictFilter === 'positive') edges = edges.filter((e) => e.latestScore != null && e.latestScore >= 4);
    return edges;
  }, [graph, filteredNodeIds, conflictFilter]);

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
    const layout = forceLayout(visibleNodes, visibleEdges, W, H);
    // 사용자가 드래그로 옮긴 위치는 우선 적용
    for (const [id, p] of manualPos) {
      if (layout.has(id)) layout.set(id, p);
    }
    return layout;
  }, [visibleNodes, visibleEdges, manualPos]);

  // 노드별 연결 수(노드 크기 결정)
  const degree = useMemo(() => {
    const m = new Map<number, number>();
    for (const e of filteredEdges) {
      m.set(e.a, (m.get(e.a) ?? 0) + 1);
      m.set(e.b, (m.get(e.b) ?? 0) + 1);
    }
    return m;
  }, [filteredEdges]);

  // 선택 학생의 관계 명세(사이드 패널용)
  const selectedDetail = useMemo(() => {
    if (!graph || selectedId == null) return null;
    const node = graph.nodes.find((n) => n.id === selectedId);
    const edges = graph.edges.filter((e) => e.a === selectedId || e.b === selectedId);
    return { node, edges };
  }, [graph, selectedId]);

  const matchedStudents = useMemo(() => {
    const q = studentFilter.query.trim();
    if (!q || !graph) return [];
    return graph.nodes.filter((n) => n.name.includes(q)).slice(0, 8);
  }, [studentFilter.query, graph]);

  // SVG 좌표 변환(줌 반영)
  function toSvgCoords(clientX: number, clientY: number): Layout | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * W * (1 / zoom) + (W * (1 - 1 / zoom)) / 2,
      y: ((clientY - rect.top) / rect.height) * H * (1 / zoom) + (H * (1 - 1 / zoom)) / 2
    };
  }

  function handleNodeMouseDown(e: React.MouseEvent, id: number) {
    if (e.button !== 0) return;
    const p = pos.get(id);
    if (!p) return;
    const start = toSvgCoords(e.clientX, e.clientY);
    if (!start) return;
    setDragged({ id, dx: p.x - start.x, dy: p.y - start.y });
    e.stopPropagation();
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragged) return;
    const p = toSvgCoords(e.clientX, e.clientY);
    if (!p) return;
    setManualPos((cur) => {
      const next = new Map(cur);
      next.set(dragged.id, {
        x: Math.max(40, Math.min(W - 40, p.x + dragged.dx)),
        y: Math.max(34, Math.min(H - 40, p.y + dragged.dy))
      });
      return next;
    });
  }

  const viewBox = useMemo(() => {
    const vw = W / zoom;
    const vh = H / zoom;
    return `${(W - vw) / 2} ${(H - vh) / 2} ${vw} ${vh}`;
  }, [zoom]);

  if (!graph) return <div className="empty-state">불러오는 중…</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">관계 그래프</h1>
        <p className="page-subtitle">
          학생 간 관계(갈등·친밀)를 그래프로 봅니다. 노드는 드래그로 옮길 수 있고, 우클릭하면 빠른 메뉴가 열립니다.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 8, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 240 }}>
          <StudentFilter value={studentFilter} onChange={(v) => { setStudentFilter(v); setSelectedId(null); }} />
          {matchedStudents.length > 0 && selectedId == null && (
            <div className="card" style={{ position: 'absolute', zIndex: 10, marginTop: 4, padding: 4, width: '100%' }}>
              {matchedStudents.map((s) => (
                <div
                  key={s.id}
                  className="dropdown-item"
                  onClick={() => {
                    setStudentFilter((f) => ({ ...f, query: s.name }));
                    setSelectedId(s.id);
                  }}
                >
                  {s.name}
                  {(s.grade != null || s.classNo != null || s.number != null) && (
                    <span style={{ color: 'var(--text-faint)' }}>
                      · {[s.grade != null ? `${s.grade}학년` : null, s.classNo != null ? `${s.classNo}반` : null, s.number != null ? `${s.number}번` : null].filter(Boolean).join(' ')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        {(selectedId != null || filterActive) && (
          <button
            className="btn btn-sm"
            onClick={() => {
              setSelectedId(null);
              setStudentFilter(EMPTY_STUDENT_FILTER);
            }}
          >
            전체 그래프로
          </button>
        )}
        <div style={{ display: 'flex', gap: 4 }}>
          {(
            [
              ['all', '전체'],
              ['conflict', '갈등만 (≤2점)'],
              ['positive', '친밀만 (≥4점)']
            ] as [ConflictFilter, string][]
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              className={'btn btn-sm' + (conflictFilter === v ? ' btn-primary' : '')}
              onClick={() => setConflictFilter(v)}
            >
              {label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button type="button" className="btn btn-sm" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} title="축소">
            −
          </button>
          <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', minWidth: 38, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
          <button type="button" className="btn btn-sm" onClick={() => setZoom((z) => Math.min(3, z + 0.25))} title="확대">
            +
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              setZoom(1);
              setManualPos(new Map());
            }}
            title="배치 초기화"
          >
            초기화
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className="card" style={{ padding: 0, flex: '1 1 560px', minWidth: 0 }}>
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
            <svg
              ref={svgRef}
              viewBox={viewBox}
              width="100%"
              style={{ display: 'block', background: 'var(--bg-card)', cursor: dragged ? 'grabbing' : 'default' }}
              onMouseMove={handleMouseMove}
              onMouseUp={() => setDragged(null)}
              onMouseLeave={() => setDragged(null)}
            >
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
                      onContextMenu={(ev) =>
                        ctx.open(ev, [
                          { label: `${e.aName} 프로필`, onClick: () => navigate(`/students/${e.a}`) },
                          { label: `${e.bName} 프로필`, onClick: () => navigate(`/students/${e.b}`) },
                          {
                            label: '이 관계의 기록 조회',
                            onClick: () => navigate('/search', { state: { studentQuery: e.aName } })
                          }
                        ])
                      }
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
                const deg = degree.get(n.id) ?? 1;
                const rBase = Math.min(20, 10 + deg * 1.6);
                const r = isSel ? rBase + 3 : rBase;
                return (
                  <g
                    key={n.id}
                    style={{ cursor: dragged?.id === n.id ? 'grabbing' : 'grab' }}
                    onMouseDown={(e) => handleNodeMouseDown(e, n.id)}
                    onClick={() => !dragged && setSelectedId(isSel ? null : n.id)}
                    onDoubleClick={() => navigate(`/students/${n.id}`)}
                    onContextMenu={(e) =>
                      ctx.open(e, [
                        { label: '학생 프로필 열기', onClick: () => navigate(`/students/${n.id}`) },
                        { label: '이 학생 관계만 보기', onClick: () => setSelectedId(n.id) },
                        { label: '기록 추가', onClick: () => navigate('/input', { state: { studentId: n.id, studentName: n.name } }) },
                        { label: '이 학생 기록 조회', onClick: () => navigate('/search', { state: { studentId: n.id } }) }
                      ])
                    }
                  >
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={r}
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
                      style={{ pointerEvents: 'none' }}
                    >
                      {n.name.slice(0, 1)}
                    </text>
                    <text
                      x={p.x}
                      y={p.y + r + 14}
                      textAnchor="middle"
                      fontSize={11.5}
                      fontWeight={600}
                      fill="var(--text)"
                      style={{ paintOrder: 'stroke', stroke: 'var(--bg-card)', strokeWidth: 3, pointerEvents: 'none' }}
                    >
                      {n.name}
                    </text>
                    {(n.grade != null || n.classNo != null || n.number != null) && (
                      <text
                        x={p.x}
                        y={p.y + r + 26}
                        textAnchor="middle"
                        fontSize={9.5}
                        fill="var(--text-faint)"
                        style={{ paintOrder: 'stroke', stroke: 'var(--bg-card)', strokeWidth: 3, pointerEvents: 'none' }}
                      >
                        {[n.grade != null ? `${n.grade}학년` : null, n.classNo != null ? `${n.classNo}반` : null, n.number != null ? `${n.number}번` : null]
                          .filter(Boolean)
                          .join(' ')}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* 선택 학생 관계 명세 패널 */}
        {selectedDetail?.node && (
          <div className="card" style={{ flex: '0 1 280px', minWidth: 240 }}>
            <div className="section-title" style={{ marginBottom: 6 }}>
              {selectedDetail.node.name} · 관계 {selectedDetail.edges.length}건
            </div>
            {selectedDetail.edges.length === 0 ? (
              <p style={{ color: 'var(--text-faint)', fontSize: 12.5 }}>조건에 맞는 관계가 없습니다.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {selectedDetail.edges
                  .slice()
                  .sort((x, y) => (x.latestScore ?? 99) - (y.latestScore ?? 99))
                  .map((e, i) => {
                    const otherId = e.a === selectedDetail.node!.id ? e.b : e.a;
                    const otherName = e.a === selectedDetail.node!.id ? e.bName : e.aName;
                    return (
                      <div
                        key={i}
                        style={{ borderRadius: 2, padding: '6px 8px', fontSize: 12.5 }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 14, height: 4, background: edgeColor(e.latestScore), display: 'inline-block', flexShrink: 0 }} />
                          <button
                            type="button"
                            className="badge-link"
                            style={{ background: 'none', border: 'none', padding: 0, fontWeight: 700, color: 'var(--accent-strong)' }}
                            onClick={() => navigate(`/students/${otherId}`)}
                          >
                            {otherName}
                          </button>
                          <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)' }}>
                            최근 {e.latestScore ?? '-'}점 · {e.count}회
                          </span>
                        </div>
                        <div style={{ color: 'var(--text-faint)', fontSize: 11.5, marginTop: 2 }}>
                          평균 {e.avgScore ?? '-'}점{e.minScore != null && e.maxScore != null && e.minScore !== e.maxScore && ` · 범위 ${e.minScore}~${e.maxScore}점 (평가 엇갈림)`}
                          {e.bidirectional ? ' · 양방향 기록' : ''}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 선 색 범례: 그래프 아래에 배치 (상단 자리 차지 방지) */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
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

      <p style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 6 }}>
        노드 클릭 = 그 학생의 관계만 보기 · 더블클릭/우클릭 = 프로필·빠른 메뉴 · 노드 드래그 = 위치 조정 · 선 굵기 = 언급 횟수 · 노드 크기 = 연결 수 · 실선 = 양방향 기록, 점선 = 한쪽 기록만
      </p>
      {ctx.element}
    </div>
  );
}
