from __future__ import annotations

import json
import math
import os
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt
from openpyxl import Workbook
from openpyxl.formatting.rule import CellIsRule
from openpyxl.styles import Font, PatternFill
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


STATUS_MAP = {
    "Aberto": "Aberto",
    "Em atendimento": "Em Andamento",
    "Resolvido": "Fechado",
}

PRIORITY_ORDER = ["Critica", "Alta", "Media", "Baixa"]
STATUS_ORDER = ["Aberto", "Em Andamento", "Fechado"]


def parse_iso(value: str | None) -> datetime | None:
    if not value:
      return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return None


def format_date(value: datetime | None) -> str:
    if not value:
        return "Em aberto"
    return value.strftime("%d/%m/%Y")


def format_datetime(value: datetime | None) -> str:
    if not value:
        return "Nao informado"
    return value.strftime("%d/%m/%Y %H:%M")


def format_duration(opened: datetime | None, closed: datetime | None) -> str:
    if not opened or not closed:
        return "Em aberto"
    delta = closed - opened
    total_minutes = max(0, int(delta.total_seconds() // 60))
    days, remainder = divmod(total_minutes, 1440)
    hours, minutes = divmod(remainder, 60)
    parts = []
    if days:
        parts.append(f"{days}d")
    if hours:
        parts.append(f"{hours}h")
    if minutes or not parts:
        parts.append(f"{minutes}min")
    return " ".join(parts)


def average_duration_minutes(records: list[dict]) -> int:
    values = []
    for record in records:
        opened = record["opened_at"]
        closed = record["closed_at"]
        if opened and closed:
            values.append(max(0, int((closed - opened).total_seconds() // 60)))
    if not values:
        return 0
    return int(sum(values) / len(values))


def format_minutes(minutes: int) -> str:
    hours, mins = divmod(minutes, 60)
    days, hours = divmod(hours, 24)
    parts = []
    if days:
        parts.append(f"{days}d")
    if hours:
        parts.append(f"{hours}h")
    if mins or not parts:
        parts.append(f"{mins}min")
    return " ".join(parts)


def normalize_ticket(ticket: dict) -> dict:
    opened = parse_iso(ticket.get("createdAt"))
    closed = parse_iso(ticket.get("closedAt"))
    status = STATUS_MAP.get(ticket.get("status"), ticket.get("status", "Aberto"))

    if status == "Fechado" and not closed:
        closed = opened

    return {
        "id": ticket.get("id", "Sem ID"),
        "category": ticket.get("category", "Nao informado"),
        "priority": ticket.get("priority", "Baixa"),
        "status": status,
        "technician": ticket.get("technician") or "Nao atribuido",
        "opened_at": opened,
        "closed_at": closed,
        "description": ticket.get("description") or "Sem descricao.",
        "resolution": ticket.get("resolution") or "Pendente",
    }


def build_summary(records: list[dict]) -> dict:
    status_counts = Counter(record["status"] for record in records)
    priority_counts = Counter(record["priority"] for record in records)
    technician_counts = Counter(record["technician"] for record in records)
    category_counts = Counter(record["category"] for record in records)
    closed_records = [record for record in records if record["status"] == "Fechado"]

    return {
        "total": len(records),
        "status_counts": status_counts,
        "priority_counts": priority_counts,
        "average_resolution": format_minutes(average_duration_minutes(closed_records)),
        "top_technician": technician_counts.most_common(1)[0][0] if technician_counts else "Nao atribuido",
        "top_category": category_counts.most_common(1)[0][0] if category_counts else "Nao informado",
    }


def period_range(periodicity: str, generated_at: datetime) -> tuple[datetime, datetime]:
    if periodicity == "daily":
        start = generated_at.replace(hour=0, minute=0, second=0, microsecond=0)
        end = generated_at.replace(hour=23, minute=59, second=59, microsecond=999999)
        return start, end

    if periodicity == "weekly":
        start = generated_at.replace(hour=0, minute=0, second=0, microsecond=0)
        start = start.replace(day=generated_at.day)  # keep date semantics explicit
        from datetime import timedelta

        start = start - timedelta(days=6)
        end = generated_at.replace(hour=23, minute=59, second=59, microsecond=999999)
        return start, end

    start = generated_at.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    end = generated_at.replace(hour=23, minute=59, second=59, microsecond=999999)
    return start, end


def format_period_title(periodicity: str, generated_at: datetime) -> str:
    months = [
        "Janeiro",
        "Fevereiro",
        "Marco",
        "Abril",
        "Maio",
        "Junho",
        "Julho",
        "Agosto",
        "Setembro",
        "Outubro",
        "Novembro",
        "Dezembro",
    ]
    if periodicity == "daily":
        return f"Relatorio Diario de Chamados de TI - {generated_at.strftime('%d/%m/%Y')}"
    if periodicity == "weekly":
        return f"Relatorio Semanal de Chamados de TI - semana de {generated_at.strftime('%d/%m/%Y')}"
    return f"Relatorio Mensal de Chamados de TI - {months[generated_at.month - 1]}/{generated_at.year}"


def build_docx(
    output_path: Path,
    records: list[dict],
    summary: dict,
    generated_by: str,
    generated_at: datetime,
    report_title: str,
    covered_period: str,
) -> None:
    document = Document()
    section = document.sections[0]
    section.top_margin = Inches(0.7)
    section.bottom_margin = Inches(0.7)
    section.left_margin = Inches(0.7)
    section.right_margin = Inches(0.7)

    header = section.header.paragraphs[0]
    header.text = "Central de Chamados de TI"
    header.alignment = WD_ALIGN_PARAGRAPH.CENTER

    footer = section.footer.paragraphs[0]
    footer.text = f"Relatorio gerado em {generated_at.strftime('%d/%m/%Y %H:%M')} por {generated_by}"
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER

    title = document.add_heading(report_title, level=0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER

    meta = document.add_paragraph()
    meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    meta.add_run(
        f"Gerado por: {generated_by} | Data: {generated_at.strftime('%d/%m/%Y %H:%M')} | Periodo: {covered_period}"
    )

    for index, record in enumerate(records):
        if index:
            document.add_page_break()

        document.add_heading(f"Chamado {record['id']}", level=1)
        details = [
            ("ID / Numero do Chamado", record["id"]),
            ("Categoria / Tipo do Problema", record["category"]),
            ("Prioridade / Severidade", record["priority"]),
            ("Status", record["status"]),
            ("Responsavel / Tecnico", record["technician"]),
            ("Data de Abertura", format_date(record["opened_at"])),
            ("Data de Fechamento", format_date(record["closed_at"])),
            ("Tempo de Resolucao", format_duration(record["opened_at"], record["closed_at"])),
            ("Descricao do Problema", record["description"]),
            ("Resolucao Aplicada", record["resolution"]),
        ]

        for label, value in details:
            paragraph = document.add_paragraph()
            run = paragraph.add_run(f"{label}: ")
            run.bold = True
            paragraph.add_run(str(value))

    document.add_page_break()
    document.add_heading("Resumo Consolidado", level=1)
    table = document.add_table(rows=1, cols=2)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.style = "Table Grid"
    header_cells = table.rows[0].cells
    header_cells[0].text = "Indicador"
    header_cells[1].text = "Valor"

    rows = [
        ("Periodo coberto pelo relatorio", covered_period),
        ("Total de chamados no periodo", str(summary["total"])),
        ("Quantidade de chamados abertos", str(summary["status_counts"].get("Aberto", 0))),
        ("Quantidade de chamados em andamento", str(summary["status_counts"].get("Em Andamento", 0))),
        ("Quantidade de chamados fechados", str(summary["status_counts"].get("Fechado", 0))),
        ("Chamados Critica", str(summary["priority_counts"].get("Critica", 0))),
        ("Chamados Alta", str(summary["priority_counts"].get("Alta", 0))),
        ("Chamados Media", str(summary["priority_counts"].get("Media", 0))),
        ("Chamados Baixa", str(summary["priority_counts"].get("Baixa", 0))),
        ("Tempo medio de resolucao", summary["average_resolution"]),
        ("Tecnico com mais chamados atribuidos", summary["top_technician"]),
        ("Categoria mais recorrente", summary["top_category"]),
    ]

    for indicator, value in rows:
        cells = table.add_row().cells
        cells[0].text = indicator
        cells[1].text = value

    document.save(output_path)


def add_pdf_header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 10)
    canvas.drawString(20 * mm, 287 * mm, getattr(doc, "report_title", "Relatorio Detalhado de Chamados"))
    canvas.drawRightString(190 * mm, 10 * mm, f"Pagina {doc.page}")
    canvas.restoreState()


def build_pdf(
    output_path: Path,
    records: list[dict],
    summary: dict,
    generated_by: str,
    generated_at: datetime,
    report_title: str,
    covered_period: str,
) -> None:
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="CenteredTitle", parent=styles["Title"], alignment=TA_CENTER))
    story = [
        Paragraph(report_title, styles["CenteredTitle"]),
        Spacer(1, 8),
        Paragraph(
            f"Gerado por: {generated_by} | Data: {generated_at.strftime('%d/%m/%Y %H:%M')} | Periodo: {covered_period}",
            styles["BodyText"],
        ),
        Spacer(1, 14),
    ]

    for index, record in enumerate(records):
        if index:
            story.append(PageBreak())

        story.append(Paragraph(f"Chamado {record['id']}", styles["Heading1"]))

        lines = [
            ("ID / Numero do Chamado", record["id"]),
            ("Categoria / Tipo do Problema", record["category"]),
            ("Prioridade / Severidade", record["priority"]),
            ("Status", record["status"]),
            ("Responsavel / Tecnico", record["technician"]),
            ("Data de Abertura", format_date(record["opened_at"])),
            ("Data de Fechamento", format_date(record["closed_at"])),
            ("Tempo de Resolucao", format_duration(record["opened_at"], record["closed_at"])),
            ("Descricao do Problema", record["description"]),
            ("Resolucao Aplicada", record["resolution"]),
        ]

        for label, value in lines:
            story.append(Paragraph(f"<b>{label}:</b> {value}", styles["BodyText"]))
            story.append(Spacer(1, 6))

    story.append(PageBreak())
    story.append(Paragraph("Resumo Consolidado", styles["Heading1"]))

    summary_rows = [
        ["Indicador", "Valor"],
        ["Periodo coberto pelo relatorio", covered_period],
        ["Total de chamados no periodo", str(summary["total"])],
        ["Quantidade de chamados abertos", str(summary["status_counts"].get("Aberto", 0))],
        ["Quantidade de chamados em andamento", str(summary["status_counts"].get("Em Andamento", 0))],
        ["Quantidade de chamados fechados", str(summary["status_counts"].get("Fechado", 0))],
        ["Chamados Critica", str(summary["priority_counts"].get("Critica", 0))],
        ["Chamados Alta", str(summary["priority_counts"].get("Alta", 0))],
        ["Chamados Media", str(summary["priority_counts"].get("Media", 0))],
        ["Chamados Baixa", str(summary["priority_counts"].get("Baixa", 0))],
        ["Tempo medio de resolucao", summary["average_resolution"]],
        ["Tecnico com mais chamados atribuidos", summary["top_technician"]],
        ["Categoria mais recorrente", summary["top_category"]],
    ]

    table = Table(summary_rows, colWidths=[110 * mm, 65 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f766e")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dce2e8")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f7fafb")]),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(table)

    document = SimpleDocTemplate(
        str(output_path),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=20 * mm,
        bottomMargin=18 * mm,
    )
    document.report_title = report_title
    document.build(story, onFirstPage=add_pdf_header_footer, onLaterPages=add_pdf_header_footer)


def build_xlsx(output_path: Path, records: list[dict], summary: dict, covered_period: str) -> None:
    workbook = Workbook()
    ws = workbook.active
    ws.title = "Chamados"
    headers = [
        "ID",
        "Categoria",
        "Prioridade",
        "Status",
        "Responsavel",
        "Data de Abertura",
        "Data de Fechamento",
        "Tempo de Resolucao",
        "Descricao",
        "Resolucao",
    ]
    ws.append(headers)

    for cell in ws[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="0F766E")

    for record in records:
        ws.append(
            [
                record["id"],
                record["category"],
                record["priority"],
                record["status"],
                record["technician"],
                format_date(record["opened_at"]),
                format_date(record["closed_at"]),
                format_duration(record["opened_at"], record["closed_at"]),
                record["description"],
                record["resolution"],
            ]
        )

    ws.column_dimensions["A"].width = 18
    ws.column_dimensions["B"].width = 22
    ws.column_dimensions["C"].width = 14
    ws.column_dimensions["D"].width = 16
    ws.column_dimensions["E"].width = 22
    ws.column_dimensions["F"].width = 18
    ws.column_dimensions["G"].width = 18
    ws.column_dimensions["H"].width = 20
    ws.column_dimensions["I"].width = 45
    ws.column_dimensions["J"].width = 45

    ws.conditional_formatting.add(
        "C2:C1048576",
        CellIsRule(operator="equal", formula=['"Critica"'], fill=PatternFill("solid", fgColor="FECACA")),
    )
    ws.conditional_formatting.add(
        "C2:C1048576",
        CellIsRule(operator="equal", formula=['"Alta"'], fill=PatternFill("solid", fgColor="FED7AA")),
    )
    ws.conditional_formatting.add(
        "C2:C1048576",
        CellIsRule(operator="equal", formula=['"Media"'], fill=PatternFill("solid", fgColor="FEF3C7")),
    )
    ws.conditional_formatting.add(
        "C2:C1048576",
        CellIsRule(operator="equal", formula=['"Baixa"'], fill=PatternFill("solid", fgColor="DCFCE7")),
    )

    summary_ws = workbook.create_sheet("Resumo")
    summary_ws.append(["Indicador", "Valor"])
    for cell in summary_ws[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="0F766E")

    summary_rows = [
        ("Periodo coberto pelo relatorio", covered_period),
        ("Total de chamados no periodo", summary["total"]),
        ("Quantidade de chamados abertos", summary["status_counts"].get("Aberto", 0)),
        ("Quantidade de chamados em andamento", summary["status_counts"].get("Em Andamento", 0)),
        ("Quantidade de chamados fechados", summary["status_counts"].get("Fechado", 0)),
        ("Chamados Critica", summary["priority_counts"].get("Critica", 0)),
        ("Chamados Alta", summary["priority_counts"].get("Alta", 0)),
        ("Chamados Media", summary["priority_counts"].get("Media", 0)),
        ("Chamados Baixa", summary["priority_counts"].get("Baixa", 0)),
        ("Tempo medio de resolucao", summary["average_resolution"]),
        ("Tecnico com mais chamados atribuidos", summary["top_technician"]),
        ("Categoria mais recorrente", summary["top_category"]),
    ]

    for row in summary_rows:
        summary_ws.append(list(row))

    summary_ws.column_dimensions["A"].width = 42
    summary_ws.column_dimensions["B"].width = 28

    workbook.save(output_path)


def main() -> None:
    input_path = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])
    payload = json.loads(input_path.read_text(encoding="utf-8"))
    output_dir.mkdir(parents=True, exist_ok=True)

    generated_at = parse_iso(payload.get("generatedAt")) or datetime.now()
    generated_by = payload.get("generatedBy", "Sistema")
    periodicity = payload.get("periodicity", "monthly")
    raw_tickets = payload.get("tickets", [])
    records = [normalize_ticket(ticket) for ticket in raw_tickets]
    summary = build_summary(records)
    period_start, period_end = period_range(periodicity, generated_at)
    covered_period = f"{period_start.strftime('%d/%m/%Y')} a {period_end.strftime('%d/%m/%Y')}"
    report_title = format_period_title(periodicity, generated_at)

    stamp = generated_at.strftime("%Y%m%d_%H%M%S")
    base_name = f"relatorio_chamados_{stamp}"
    docx_path = output_dir / f"{base_name}.docx"
    pdf_path = output_dir / f"{base_name}.pdf"
    xlsx_path = output_dir / f"{base_name}.xlsx"

    build_docx(docx_path, records, summary, generated_by, generated_at, report_title, covered_period)
    build_pdf(pdf_path, records, summary, generated_by, generated_at, report_title, covered_period)
    build_xlsx(xlsx_path, records, summary, covered_period)

    result = {
        "files": [
            {"label": "Word", "filename": docx_path.name, "url": f"/reports/{docx_path.name}"},
            {"label": "PDF", "filename": pdf_path.name, "url": f"/reports/{pdf_path.name}"},
            {"label": "Excel", "filename": xlsx_path.name, "url": f"/reports/{xlsx_path.name}"},
        ]
    }
    print(json.dumps(result))


if __name__ == "__main__":
    main()
