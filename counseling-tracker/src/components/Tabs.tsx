// macOS 세그먼트 컨트롤 스타일 탭. 플랫 디자인(그림자·그라데이션 없음, 헤어라인 구분).
interface TabItem<T extends string> {
  key: T;
  label: string;
}

interface Props<T extends string> {
  tabs: TabItem<T>[];
  active: T;
  onChange: (key: T) => void;
  size?: 'sm' | 'md';
}

export default function Tabs<T extends string>({ tabs, active, onChange, size = 'md' }: Props<T>) {
  return (
    <div className={'seg-tabs' + (size === 'sm' ? ' seg-tabs-sm' : '')} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={active === t.key}
          className={'seg-tab' + (active === t.key ? ' seg-tab-active' : '')}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
