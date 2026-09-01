interface Props {
  label: string;
  value: string | number;
}

export default function MetricCard({ label, value }: Props) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  );
}
