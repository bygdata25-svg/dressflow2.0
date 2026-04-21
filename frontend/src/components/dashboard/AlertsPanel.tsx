// components/dashboard/AlertsPanel.tsx

export default function AlertsPanel({ alerts }) {
  return (
    <div className="card">
      <h3>Alertas</h3>

      <div className="alerts">
        {alerts.map((a, i) => (
          <div key={i} className={`alert alert-${a.type}`}>
            <span>{a.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
