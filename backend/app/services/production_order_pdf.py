from __future__ import annotations

import html
from typing import Any
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright


def _safe(value: Any) -> str:
    if value is None:
        return "-"
    return html.escape(str(value))


def _translate_unit(unit: str | None) -> str:
    if not unit:
        return ""
    mapping = {
        "meters": "metros",
        "meter": "metro",
        "m": "m",
        "units": "unidades",
        "unit": "unidad",
        "pcs": "piezas",
        "piece": "pieza",
        "dozen": "docena",
    }
    return mapping.get(unit.lower(), unit)


def _resolve_public_url(base_url: str, maybe_relative: str | None) -> str | None:
    if not maybe_relative:
        return None
    if maybe_relative.startswith("http://") or maybe_relative.startswith("https://"):
        return maybe_relative
    return urljoin(base_url.rstrip("/") + "/", maybe_relative.lstrip("/"))


def build_production_order_html(
    *,
    order: dict[str, Any],
    fabric_materials: list[dict[str, Any]],
    trim_materials: list[dict[str, Any]],
    public_base_url: str,
) -> str:
    brand_color = order.get("tenant_primary_color") or "#111111"
    tenant_name = order.get("tenant_name") or "DressFlow"
    logo_url = _resolve_public_url(public_base_url, order.get("tenant_logo_url"))
    design_photo_url = _resolve_public_url(public_base_url, order.get("design_photo_url"))

    def render_logo() -> str:
        if logo_url:
            return f'<img src="{_safe(logo_url)}" alt="{_safe(tenant_name)}" class="logo-img" />'
        initials = _safe((tenant_name[:2] or "DF").upper())
        return f'<div class="logo-fallback">{initials}</div>'

    def render_rows(rows: list[dict[str, Any]], include_roll: bool) -> str:
        if not rows:
            colspan = 4 if include_roll else 3
            return (
                f'<tr><td colspan="{colspan}" class="empty-row">'
                "No hay materiales asignados."
                "</td></tr>"
            )

        rendered: list[str] = []
        for row in rows:
            cells = [
                f"<td>{_safe(row.get('description_snapshot'))}</td>",
                f"<td>{_safe(row.get('planned_quantity'))} {_safe(_translate_unit(row.get('unit')))}</td>",
            ]
            if include_roll:
                cells.append(f"<td>{_safe(row.get('roll_code'))}</td>")
            cells.append(f"<td>{_safe(row.get('notes'))}</td>")
            rendered.append(f"<tr>{''.join(cells)}</tr>")
        return "".join(rendered)

    status = _safe(order.get("status"))
    priority = _safe(order.get("priority"))
    due_date = _safe(order.get("due_date"))
    order_number = _safe(order.get("order_number"))
    workshop_name = _safe(order.get("workshop_supplier_name"))
    target_dress_name = _safe(order.get("target_dress_name"))
    target_dress_code = _safe(order.get("target_dress_code"))
    target_size = _safe(order.get("target_size"))
    target_color = _safe(order.get("target_color"))
    planned_quantity = _safe(order.get("planned_quantity"))
    produced_quantity = _safe(order.get("produced_quantity"))
    notes = _safe(order.get("notes") or "Sin observaciones.")

    design_image_html = (
        f'<img src="{_safe(design_photo_url)}" alt="Diseño" />'
        if design_photo_url
        else "<div class='empty-row'>No hay imagen cargada para este diseño.</div>"
    )

    return f"""<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Orden {order_number}</title>
  <style>
    :root {{
      --brand: {brand_color};
      --text: #161616;
      --muted: #6b7280;
      --border: #d9dde3;
      --paper: #ffffff;
    }}

    * {{
      box-sizing: border-box;
    }}

    html, body {{
      margin: 0;
      padding: 0;
      background: #fff;
      color: var(--text);
      font-family: Inter, Arial, sans-serif;
    }}

    body {{
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }}

    .sheet {{
      width: 100%;
      background: var(--paper);
    }}

    .topbar {{
      height: 8px;
      background: linear-gradient(90deg, var(--brand), #d8d8d8);
    }}

    .inner {{
      padding: 22px 24px 26px;
    }}

    .header {{
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 18px;
      align-items: start;
      border-bottom: 1px solid var(--border);
      padding-bottom: 14px;
    }}

    .brand {{
      display: flex;
      align-items: center;
      gap: 16px;
    }}

    .logo {{
      width: 68px;
      height: 68px;
      border: 1px solid var(--border);
      border-radius: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      background: #fff;
      flex-shrink: 0;
    }}

    .logo-img {{
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }}

    .logo-fallback {{
      font-weight: 800;
      font-size: 20px;
      color: var(--brand);
    }}

    .kicker {{
      margin: 0 0 4px;
      font-size: 10px;
      letter-spacing: .16em;
      text-transform: uppercase;
      color: var(--muted);
      font-weight: 800;
    }}

    .title {{
      margin: 0;
      font-size: 28px;
      line-height: 1.02;
      letter-spacing: -0.04em;
      font-family: Georgia, "Times New Roman", serif;
    }}

    .subtitle {{
      margin: 4px 0 0;
      font-size: 13px;
      color: var(--muted);
    }}

    .orderbox {{
      min-width: 180px;
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 14px 16px;
      background: #fafafa;
    }}

    .orderbox .label {{
      display: block;
      font-size: 10px;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: var(--muted);
      font-weight: 800;
      margin-bottom: 4px;
    }}

    .orderbox .value {{
      font-size: 26px;
      font-weight: 800;
      line-height: 1;
    }}

    .orderbox .sub {{
      margin-top: 8px;
      font-size: 12px;
      color: var(--muted);
    }}

    .chips {{
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 14px;
    }}

    .chip {{
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      padding: 0 11px;
      border-radius: 999px;
      background: #f4f5f6;
      border: 1px solid var(--border);
      font-size: 12px;
      font-weight: 700;
    }}

    .top-grid {{
      display: grid;
      grid-template-columns: 1.15fr .85fr;
      gap: 16px;
      margin-top: 18px;
      align-items: start;
      page-break-inside: avoid;
      break-inside: avoid;
    }}

    .card {{
      border: 1px solid var(--border);
      border-radius: 20px;
      background: #fff;
      overflow: hidden;
      page-break-inside: avoid;
      break-inside: avoid;
    }}

    .card-head {{
      padding: 12px 14px;
      border-bottom: 1px solid var(--border);
      background: #f8f9fb;
      font-size: 10px;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: var(--muted);
      font-weight: 800;
    }}

    .card-body {{
      padding: 14px;
    }}

    .meta-grid {{
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }}

    .meta-item {{
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 10px 12px;
      background: #fff;
    }}

    .meta-item span {{
      display: block;
      font-size: 10px;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: var(--muted);
      font-weight: 800;
      margin-bottom: 4px;
    }}

    .meta-item strong {{
      font-size: 14px;
      line-height: 1.2;
    }}

    .note {{
      border: 1px dashed var(--border);
      border-radius: 14px;
      padding: 12px;
      min-height: 88px;
      white-space: pre-wrap;
      line-height: 1.45;
      font-size: 13px;
      background: #fafafa;
    }}

    .checklist {{
      display: grid;
      gap: 9px;
    }}

    .check {{
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-size: 13px;
    }}

    .box {{
      width: 15px;
      height: 15px;
      border-radius: 4px;
      border: 1.5px solid var(--border);
      flex-shrink: 0;
      margin-top: 1px;
    }}

    .visual {{
      display: grid;
      gap: 14px;
    }}

    .imagebox {{
      border: 1px solid var(--border);
      border-radius: 18px;
      min-height: 220px;
      padding: 10px;
      background: #fafafa;
      display: flex;
      align-items: center;
      justify-content: center;
    }}

    .imagebox img {{
      width: 100%;
      max-height: 250px;
      object-fit: contain;
    }}

    .mini-facts {{
      display: grid;
      gap: 10px;
    }}

    .mini-fact {{
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 10px 12px;
    }}

    .mini-fact span {{
      display: block;
      font-size: 10px;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: var(--muted);
      font-weight: 800;
      margin-bottom: 4px;
    }}

    .mini-fact strong {{
      font-size: 14px;
      line-height: 1.2;
    }}

    .section {{
      margin-top: 18px;
      page-break-inside: avoid;
      break-inside: avoid;
    }}

    .section-title {{
      margin: 0 0 10px;
      font-size: 16px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }}

    .table-wrap {{
      border: 1px solid var(--border);
      border-radius: 18px;
      overflow: hidden;
      background: #fff;
      page-break-inside: avoid;
      break-inside: avoid;
    }}

    table {{
      width: 100%;
      border-collapse: collapse;
    }}

    th, td {{
      text-align: left;
      vertical-align: top;
      padding: 9px 10px;
      border-bottom: 1px solid var(--border);
      font-size: 12px;
      line-height: 1.25;
    }}

    thead th {{
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: .08em;
      color: var(--muted);
      background: #f6f7f9;
      font-weight: 800;
    }}

    tbody tr:last-child td {{
      border-bottom: none;
    }}

    .empty-row {{
      color: var(--muted);
      background: #fafafa;
    }}

    .signatures {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
      margin-top: 20px;
      page-break-inside: avoid;
      break-inside: avoid;
    }}

    .signatures div {{
      border-top: 1px solid var(--border);
      padding-top: 8px;
      font-size: 12px;
      color: var(--muted);
      min-height: 24px;
    }}

    .footer {{
      margin-top: 12px;
      text-align: center;
      font-size: 11px;
      color: var(--muted);
    }}

    @page {{
      size: A4;
      margin: 10mm;
    }}
  </style>
</head>
<body>
  <div class="sheet">
    <div class="topbar"></div>

    <div class="inner">
      <header class="header">
        <div>
          <div class="brand">
            <div class="logo">
              {render_logo()}
            </div>

            <div>
              <p class="kicker">{_safe(tenant_name)}</p>
              <h1 class="title">Orden de Producción</h1>
              <p class="subtitle">Ficha premium de taller · DressFlow</p>
            </div>
          </div>

          <div class="chips">
            <span class="chip">{status}</span>
            <span class="chip">Prioridad: {priority}</span>
            <span class="chip">Entrega: {due_date}</span>
          </div>
        </div>

        <div class="orderbox">
          <span class="label">Orden</span>
          <span class="value">{order_number}</span>
          <div class="sub">Taller: {workshop_name}</div>
        </div>
      </header>

      <section class="top-grid">
        <div class="card">
          <div class="card-head">Datos de producción</div>
          <div class="card-body">
            <div class="meta-grid">
              <div class="meta-item"><span>Vestido</span><strong>{target_dress_name}</strong></div>
              <div class="meta-item"><span>Código</span><strong>{target_dress_code}</strong></div>
              <div class="meta-item"><span>Talle</span><strong>{target_size}</strong></div>
              <div class="meta-item"><span>Color</span><strong>{target_color}</strong></div>
              <div class="meta-item"><span>Planificado</span><strong>{planned_quantity}</strong></div>
              <div class="meta-item"><span>Producido</span><strong>{produced_quantity}</strong></div>
            </div>

            <div style="margin-top:14px;">
              <div class="card-head" style="margin:-14px -14px 12px; border-left:none; border-right:none; border-radius:0;">Observaciones</div>
              <div class="note">{notes}</div>
            </div>

            <div style="margin-top:14px;">
              <div class="card-head" style="margin:-14px -14px 12px; border-left:none; border-right:none; border-radius:0;">Checklist de taller</div>
              <div class="checklist">
                <div class="check"><span class="box"></span>Materiales recibidos</div>
                <div class="check"><span class="box"></span>Moldería verificada</div>
                <div class="check"><span class="box"></span>Confección iniciada</div>
                <div class="check"><span class="box"></span>Terminaciones revisadas</div>
                <div class="check"><span class="box"></span>Producción entregada</div>
              </div>
            </div>
          </div>
        </div>

        <div class="visual">
          <div class="card">
            <div class="card-head">Diseño</div>
            <div class="card-body">
              <div class="imagebox">
                {design_image_html}
              </div>
            </div>
          </div>

          <div class="mini-facts">
            <div class="mini-fact">
              <span>Vestido objetivo</span>
              <strong>{target_dress_name}</strong>
            </div>

            <div class="mini-fact">
              <span>Taller asignado</span>
              <strong>{workshop_name}</strong>
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">Telas</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Material</th>
                <th>Cantidad</th>
                <th>Rollo</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {render_rows(fabric_materials, include_roll=True)}
            </tbody>
          </table>
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">Avíos</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Material</th>
                <th>Cantidad</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {render_rows(trim_materials, include_roll=False)}
            </tbody>
          </table>
        </div>
      </section>

      <section class="signatures">
        <div>Firma entrega materiales</div>
        <div>Firma recepción taller / modista</div>
      </section>

      <div class="footer">DressFlow · AI • FASHION • ERP</div>
    </div>
  </div>
</body>
</html>
"""


def html_to_pdf_bytes(html_content: str) -> bytes:
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        try:
            page = browser.new_page()
            page.set_content(html_content, wait_until="load")
            page.emulate_media(media="print")

            pdf_bytes = page.pdf(
                format="A4",
                print_background=True,
                margin={
                    "top": "10mm",
                    "right": "10mm",
                    "bottom": "10mm",
                    "left": "10mm",
                },
                prefer_css_page_size=True,
            )
            return pdf_bytes
        finally:
            browser.close()
