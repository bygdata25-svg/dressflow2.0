import type { ReactNode } from "react";
import "./DataGrid.css";

export type DataGridColumn<T> = {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
};

type DataGridProps<T> = {
  rows: T[];
  columns: DataGridColumn<T>[];
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  getRowClassName?: (row: T) => string | undefined;
};

export function DataGrid<T>({
  rows,
  columns,
  getRowKey,
  onRowClick,
  getRowClassName,
}: DataGridProps<T>) {
  return (
    <div className="df-table-wrap">
      <table className="df-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => {
            const rowClass = getRowClassName?.(row) || "";

            return (
              <tr
                key={getRowKey(row)}
                className={rowClass}
                onClick={() => onRowClick?.(row)}
                style={{
                  cursor: onRowClick ? "pointer" : "default",
                }}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    onClick={(e) => {
                      if (column.key === "actions") {
                        e.stopPropagation();
                      }
                    }}
                    style={{
                      cursor:
                        column.key === "actions"
                          ? "default"
                          : onRowClick
                          ? "pointer"
                          : "default",
                    }}
                  >
                    {column.render
                      ? column.render(row)
                      : (row as any)[column.key]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
