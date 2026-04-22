import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

type InventoryDonutItem = {
  name: string;
  value: number;
};

type InventoryDonutProps = {
  data: InventoryDonutItem[];
};

const COLORS = ["#22c55e", "#ef4444", "#f59e0b", "#3b82f6"];

export default function InventoryDonut({ data }: InventoryDonutProps) {
  return (
    <div className="card">
      <h3>Estado del Inventario</h3>

      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius={70}
            outerRadius={100}
            paddingAngle={3}
          >
            {data.map((_, index: number) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
