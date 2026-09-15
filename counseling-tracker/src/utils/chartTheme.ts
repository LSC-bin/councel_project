import { useEffect, useState } from 'react';
import { Chart as ChartJS } from 'chart.js';

// CSS 변수 값 읽기 (차트 색을 테마와 동기화)
export function chartCss(name: string, fallback = ''): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

// chart.js 전역 기본값을 현재 테마(CSS 변수)에 맞춘다.
// 하드코딩 색을 쓰면 다크모드에서 축·범례 글자가 안 보이므로 마운트 시마다 갱신.
export function applyChartTheme() {
  ChartJS.defaults.color = chartCss('--text-secondary', '#6e6e73');
  ChartJS.defaults.borderColor = chartCss('--hairline', 'rgba(0,0,0,0.08)');
  ChartJS.defaults.font.family = getComputedStyle(document.body).fontFamily;
  ChartJS.defaults.font.size = 11;
}

// 테마 전환(html[data-theme] 변경)을 감지해 차트를 다시 그리게 하는 훅.
// 반환값은 리렌더 트리거용 카운터.
export function useChartTheme(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    applyChartTheme();
    const mo = new MutationObserver(() => {
      applyChartTheme();
      setTick((t) => t + 1);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);
  return tick;
}
