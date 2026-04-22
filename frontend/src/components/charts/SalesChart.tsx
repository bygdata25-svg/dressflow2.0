import {
  LineChart,
  Line,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type SalesChartPoint = {
  day: string;
  amount: number;
};

type SalesChartProps = {
  data: SalesChartPoint[];
};

export default function SalesChart({ data }: SalesChartProps) {
  return (
    <div className="card">
      <h3>Ventas del mes</h3>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="day" />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="amount"
            stroke="#111827"
            strokeWidth={3}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
