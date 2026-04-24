import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { DataGrid } from "../components/data-grid/DataGrid";

function money(v:number){
  return new Intl.NumberFormat("en-US", {
    style:"currency",
    currency:"USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v||0);
}

export default function DressStockValuationReportPage(){

  const [rows,setRows]=useState<any[]>([]);
  const [kpis,setKpis]=useState<any>({});

  const load=async()=>{
    const res=await api.get("/reports/dress-stock-valuation");
    setRows(res.data.items);
    setKpis(res.data.kpis);
  };

  const exportExcel = () => {
    window.open("/api/v1/reports/dress-stock-valuation/export", "_blank");
  };

  useEffect(()=>{load()},[]);

  return (
    <section className="df-pro-page">

      <div className="df-pro-page__header">
        <div>
          <h1>Stock valorizado de vestidos</h1>
        </div>

        <button className="df-pro-btn" onClick={exportExcel}>
          Exportar Excel
        </button>
      </div>

      {/* KPIs */}
      <div className="df-kpis">
        <div>Total vestidos: {kpis.total_items}</div>
        <div>Disponibles: {kpis.available_items}</div>
        <div>Valor venta: {money(kpis.total_sale_value)}</div>
        <div>Valor alquiler: {money(kpis.total_rental_value)}</div>
      </div>

      <DataGrid
        rows={rows}
        getRowKey={(r)=>r.id}
        columns={[
          {key:"code",label:"Código"},
          {key:"name",label:"Vestido"},
          {key:"capsule",label:"Cápsula"},
          {key:"size",label:"Talle"},
          {key:"color",label:"Color"},
          {key:"status",label:"Estado"},
          {
            key:"sale_price",
            label:"Precio venta",
            render:r=>money(r.sale_price)
          },
          {
            key:"rental_price",
            label:"Precio alquiler",
            render:r=>money(r.rental_price)
          },
        ]}
      />

    </section>
  );
}
