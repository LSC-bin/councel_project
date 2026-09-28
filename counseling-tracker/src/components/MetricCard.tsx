interface Props {
  label: string;
  value: string | number;
  alert?: boolean;
}

export default function MetricCard({ label, value, alert = false }: Props) {
  return (
    <div className={'metric-card' + (alert ? ' alert' : '')}>
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={alert ? { color: 'var(--danger)' } : undefined}>
        {value}
      </div>
    </div>
  );
}
