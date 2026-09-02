// 학생 이름을 A학생, B학생 ... Z학생, A1학생 ... 순으로 매핑한다.
// 매핑은 호출할 때마다 메모리에서만 생성되며 원본 DB에는 어떤 영향도 주지 않는다.
export function buildAnonymMap(studentNames: string[]): Map<string, string> {
  const map = new Map<string, string>();
  studentNames.forEach((name, i) => {
    const label = i < 26 ? String.fromCharCode(65 + i) : `A${i - 25}`;
    map.set(name, `${label}학생`);
  });
  return map;
}
