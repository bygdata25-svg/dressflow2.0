type AlertItem = {
  type: string;
  message: string;
};

type AlertsPanelProps = {
  alerts: AlertItem[];
};

export default function AlertsPanel({ alerts }: AlertsPanelProps) {
  return (
    <div className="card">
      <h3>Alertas</h3>

      <div className="alerts">
        {alerts.map((a: AlertItem, i: number) => (
          <div key={i} className={`alert alert-${a.type}`}>
            <span>{a.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
