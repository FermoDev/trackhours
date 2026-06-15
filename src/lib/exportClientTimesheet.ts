import ExcelJS from "exceljs";
import { supabase } from "@/integrations/supabase/client";

type Args = {
  clientId: string;
  clientName: string;
  from?: string; // YYYY-MM-DD
  to?: string;
};

function safeSheetName(name: string, used: Set<string>): string {
  let base = name.replace(/[\\/?*\[\]:]/g, "").trim() || "Unnamed";
  if (base.length > 28) base = base.slice(0, 28);
  let candidate = base;
  let i = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${i})`;
    candidate = base.slice(0, 28 - suffix.length) + suffix;
    i++;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

export async function exportClientTimesheet({ clientId, clientName, from, to }: Args) {
  let q = supabase
    .from("time_entries")
    .select("id, user_id, entry_date, duration_minutes, description, projects(name)")
    .eq("client_id", clientId)
    .not("duration_minutes", "is", null)
    .order("entry_date", { ascending: true });
  if (from) q = q.gte("entry_date", from);
  if (to) q = q.lte("entry_date", to);

  const { data: entries, error } = await q;
  if (error) throw error;
  const rows = (entries || []) as any[];

  const userIds = Array.from(new Set(rows.map(r => r.user_id)));
  const profileMap = new Map<string, string>();
  if (userIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, email")
      .in("user_id", userIds);
    (profiles || []).forEach(p => profileMap.set(p.user_id, p.full_name || p.email || "Unknown"));
  }

  // Group by user
  const byUser = new Map<string, any[]>();
  for (const r of rows) {
    const arr = byUser.get(r.user_id) || [];
    arr.push(r);
    byUser.set(r.user_id, arr);
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "TrackHours";
  wb.created = new Date();

  const rangeLabel = from || to ? `${from || "—"} to ${to || "—"}` : "All time";
  const totalHours = rows.reduce((s, r) => s + (r.duration_minutes || 0), 0) / 60;

  // ===== Summary sheet =====
  const summary = wb.addWorksheet("Summary");
  summary.columns = [
    { width: 28 },
    { width: 36 },
    { width: 12 },
    { width: 14 },
  ];

  summary.mergeCells("A1:D1");
  const title = summary.getCell("A1");
  title.value = `${clientName} — Timesheet`;
  title.font = { bold: true, size: 16 };

  summary.getCell("A2").value = "Date range:";
  summary.getCell("A2").font = { bold: true };
  summary.getCell("B2").value = rangeLabel;
  summary.getCell("A3").value = "Generated:";
  summary.getCell("A3").font = { bold: true };
  summary.getCell("B3").value = new Date().toLocaleString();
  summary.getCell("A4").value = "Total hours:";
  summary.getCell("A4").font = { bold: true };
  summary.getCell("B4").value = Number(totalHours.toFixed(2));

  const headerRowIdx = 6;
  const headerRow = summary.getRow(headerRowIdx);
  headerRow.values = ["Freelancer", "Projects", "Entries", "Total Hours"];
  headerRow.font = { bold: true };
  headerRow.eachCell(cell => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
    cell.border = { bottom: { style: "thin", color: { argb: "FFCCCCCC" } } };
  });

  const summaryRows: { name: string; projects: string; count: number; hours: number }[] = [];
  byUser.forEach((entries, uid) => {
    const name = profileMap.get(uid) || "Unknown";
    const projects = Array.from(new Set(entries.map(e => e.projects?.name).filter(Boolean))).join(", ");
    const hours = entries.reduce((s, e) => s + (e.duration_minutes || 0), 0) / 60;
    summaryRows.push({ name, projects, count: entries.length, hours });
  });
  summaryRows.sort((a, b) => b.hours - a.hours);

  let r = headerRowIdx + 1;
  for (const sr of summaryRows) {
    const row = summary.getRow(r++);
    row.values = [sr.name, sr.projects, sr.count, Number(sr.hours.toFixed(2))];
    row.getCell(4).numFmt = "0.00";
    row.getCell(4).alignment = { horizontal: "right" };
    row.getCell(3).alignment = { horizontal: "right" };
  }
  const totalRow = summary.getRow(r);
  totalRow.values = ["Grand total", "", summaryRows.reduce((s, x) => s + x.count, 0), Number(totalHours.toFixed(2))];
  totalRow.font = { bold: true };
  totalRow.eachCell(cell => {
    cell.border = { top: { style: "thin", color: { argb: "FF999999" } } };
  });
  totalRow.getCell(4).numFmt = "0.00";
  totalRow.getCell(4).alignment = { horizontal: "right" };
  totalRow.getCell(3).alignment = { horizontal: "right" };

  // ===== By Project sheet =====
  const usedNames = new Set<string>(["summary"]);
  const byProject = new Map<string, { name: string; entries: any[] }>();
  for (const r of rows) {
    const pid = r.project_id || "__none__";
    const name = r.projects?.name || "—";
    const cur = byProject.get(pid) || { name, entries: [] };
    cur.entries.push(r);
    byProject.set(pid, cur);
  }
  const projectGroups = Array.from(byProject.values())
    .map(g => ({
      ...g,
      hours: g.entries.reduce((s, e) => s + (e.duration_minutes || 0), 0) / 60,
    }))
    .sort((a, b) => b.hours - a.hours);

  const proj = wb.addWorksheet(safeSheetName("By Project", usedNames));
  proj.columns = [
    { width: 12 },
    { width: 26 },
    { width: 10 },
    { width: 60 },
  ];
  proj.mergeCells("A1:D1");
  const pTitle = proj.getCell("A1");
  pTitle.value = `${clientName} — Project Breakdown`;
  pTitle.font = { bold: true, size: 16 };
  proj.getCell("A2").value = `Date range: ${rangeLabel}`;
  proj.getCell("A2").font = { italic: true, color: { argb: "FF666666" } };

  let pr = 4;
  for (const g of projectGroups) {
    // Contributors breakdown
    const contribMap = new Map<string, number>();
    for (const e of g.entries) {
      const nm = profileMap.get(e.user_id) || "Unknown";
      contribMap.set(nm, (contribMap.get(nm) || 0) + (e.duration_minutes || 0));
    }
    const contributors = Array.from(contribMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([nm, mins]) => `${nm} ${(mins / 60).toFixed(2)}h`)
      .join(", ");

    // Project header row
    proj.mergeCells(`A${pr}:D${pr}`);
    const hdrCell = proj.getCell(`A${pr}`);
    hdrCell.value = `${g.name}    —    ${g.hours.toFixed(2)}h  (${g.entries.length} entries)`;
    hdrCell.font = { bold: true, size: 12 };
    hdrCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F5EE" } };
    pr++;

    // Contributors line
    proj.mergeCells(`A${pr}:D${pr}`);
    const conCell = proj.getCell(`A${pr}`);
    conCell.value = `Contributors: ${contributors}`;
    conCell.font = { italic: true, color: { argb: "FF555555" }, size: 10 };
    pr++;

    // Column headers
    const colHdr = proj.getRow(pr);
    colHdr.values = ["Date", "Freelancer", "Hours", "Description"];
    colHdr.font = { bold: true };
    colHdr.eachCell(c => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
      c.border = { bottom: { style: "thin", color: { argb: "FFCCCCCC" } } };
    });
    pr++;

    // Entry rows
    const sortedEntries = [...g.entries].sort((a, b) => (a.entry_date < b.entry_date ? -1 : 1));
    for (const e of sortedEntries) {
      const rr = proj.getRow(pr++);
      const hours = (e.duration_minutes || 0) / 60;
      const nm = profileMap.get(e.user_id) || "Unknown";
      rr.values = [e.entry_date, nm, Number(hours.toFixed(2)), e.description || ""];
      rr.getCell(3).numFmt = "0.00";
      rr.getCell(3).alignment = { horizontal: "right" };
      rr.getCell(4).alignment = { wrapText: true, vertical: "top" };
    }

    // Project total row
    const ptot = proj.getRow(pr++);
    ptot.values = ["", "Project total", Number(g.hours.toFixed(2)), ""];
    ptot.font = { bold: true };
    ptot.getCell(3).numFmt = "0.00";
    ptot.getCell(3).alignment = { horizontal: "right" };
    ptot.eachCell(c => {
      c.border = { top: { style: "thin", color: { argb: "FF999999" } } };
    });

    // Spacer row
    pr++;
  }

  // Grand total
  const grand = proj.getRow(pr);
  grand.values = ["", "GRAND TOTAL", Number(totalHours.toFixed(2)), ""];
  grand.font = { bold: true, size: 12 };
  grand.getCell(3).numFmt = "0.00";
  grand.getCell(3).alignment = { horizontal: "right" };
  grand.eachCell(c => {
    c.border = { top: { style: "medium", color: { argb: "FF333333" } } };
  });

  // ===== Per-freelancer sheets =====
  for (const sr of summaryRows) {
    const userEntries = Array.from(byUser.entries()).find(([uid]) => (profileMap.get(uid) || "Unknown") === sr.name)?.[1] || [];
    const sheet = wb.addWorksheet(safeSheetName(sr.name, usedNames));
    sheet.columns = [
      { width: 12 },
      { width: 28 },
      { width: 10 },
      { width: 60 },
    ];
    sheet.mergeCells("A1:D1");
    const t = sheet.getCell("A1");
    t.value = `${sr.name} — ${clientName}`;
    t.font = { bold: true, size: 14 };
    sheet.getCell("A2").value = `Date range: ${rangeLabel}`;
    sheet.getCell("A2").font = { italic: true, color: { argb: "FF666666" } };

    const hdr = sheet.getRow(4);
    hdr.values = ["Date", "Project", "Hours", "Description"];
    hdr.font = { bold: true };
    hdr.eachCell(c => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
      c.border = { bottom: { style: "thin", color: { argb: "FFCCCCCC" } } };
    });

    let row = 5;
    const sorted = [...userEntries].sort((a, b) => (a.entry_date < b.entry_date ? -1 : 1));
    for (const e of sorted) {
      const rr = sheet.getRow(row++);
      const hours = (e.duration_minutes || 0) / 60;
      rr.values = [e.entry_date, e.projects?.name || "—", Number(hours.toFixed(2)), e.description || ""];
      rr.getCell(3).numFmt = "0.00";
      rr.getCell(3).alignment = { horizontal: "right" };
      rr.getCell(4).alignment = { wrapText: true, vertical: "top" };
    }
    const tot = sheet.getRow(row);
    tot.values = ["", "Total", Number(sr.hours.toFixed(2)), ""];
    tot.font = { bold: true };
    tot.getCell(3).numFmt = "0.00";
    tot.getCell(3).alignment = { horizontal: "right" };
    tot.eachCell(c => {
      c.border = { top: { style: "thin", color: { argb: "FF999999" } } };
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeClient = clientName.replace(/[^a-z0-9]+/gi, "_");
  const fromLabel = from || "all";
  const toLabel = to || "all";
  a.href = url;
  a.download = `${safeClient}_Timesheet_${fromLabel}_to_${toLabel}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);

  return { entryCount: rows.length, totalHours };
}