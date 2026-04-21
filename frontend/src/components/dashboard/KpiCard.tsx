// components/dashboard/KpiCard.tsx

export default function KpiCard({ title, value, trend }) {
  return (
    <div className="kpi-card">
      <div className="kpi-title">{title}</div>
      <div className="kpi-value">{value}</div>
      <div className={`kpi-trend ${trend > 0 ? "up" : "down"}`}>
        {trend > 0 ? "↑" : "↓"} {trend}%
      </div>
    </div>
  );
}
