import ExcelJS from "exceljs";
import { supabase } from "@/integrations/supabase/client";

type Args = {
  clientId: string;
  clientName: string;
  from?: string; // YYYY-MM-DD
  to?: string;
};

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

  // Normalize entries: { name, date(Date), ym, hours, desc, project }
  type Entry = { name: string; date: Date; ym: string; hours: number; desc: string; project: string };
  const entries2: Entry[] = rows.map(r => {
    const d = new Date(r.entry_date + "T00:00:00");
    const ym = `${d.getFullYear()}-${d.getMonth() + 1}`;
    return {
      name: profileMap.get(r.user_id) || "Unknown",
      date: d,
      ym,
      hours: (r.duration_minutes || 0) / 60,
      desc: r.description || "",
      project: r.projects?.name || "—",
    };
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "TrackHours";
  wb.created = new Date();

  // ===== Sheet 1: Hours per person by project (two pivot blocks) =====
  const pivot = wb.addWorksheet("Hours per person by project");

  const projects = Array.from(new Set(entries2.map(e => e.project))).sort();
  const months = Array.from(new Set(entries2.map(e => e.ym)))
    .sort((a, b) => {
      const [ay, am] = a.split("-").map(Number);
      const [by, bm] = b.split("-").map(Number);
      return ay !== by ? ay - by : am - bm;
    });
  const people = Array.from(new Set(entries2.map(e => e.name))).sort();

  // sum helper
  const sum = (filter: (e: Entry) => boolean) =>
    entries2.filter(filter).reduce((s, e) => s + e.hours, 0);

  const fmtNum = (v: number) => (v ? Number(v.toFixed(2)) : null);

  // ---- Block A: Project by Month ----
  pivot.getCell("A1").value = "Project by Month - Hours";
  pivot.getCell("A1").font = { bold: true };

  pivot.getCell("A3").value = "Name";
  pivot.getCell("A3").font = { bold: true };
  pivot.getCell("B3").value = "(All)";

  pivot.getCell("A5").value = "Sum of Hours";
  pivot.getCell("A5").font = { bold: true };
  pivot.getCell("B5").value = "Year-Month";
  pivot.getCell("B5").font = { bold: true };

  // Header row 6: Project | months... | Grand Total
  const headerA = pivot.getRow(6);
  headerA.getCell(1).value = "Project";
  months.forEach((m, i) => (headerA.getCell(2 + i).value = m));
  headerA.getCell(2 + months.length).value = "Grand Total";
  headerA.font = { bold: true };
  headerA.eachCell(c => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
    c.border = { bottom: { style: "thin", color: { argb: "FFCCCCCC" } } };
  });

  let rowIdx = 7;
  for (const p of projects) {
    const row = pivot.getRow(rowIdx++);
    row.getCell(1).value = p;
    months.forEach((m, i) => {
      const v = sum(e => e.project === p && e.ym === m);
      row.getCell(2 + i).value = fmtNum(v);
    });
    const gt = sum(e => e.project === p);
    row.getCell(2 + months.length).value = fmtNum(gt);
  }
  // Grand total row
  const gtA = pivot.getRow(rowIdx++);
  gtA.getCell(1).value = "Grand Total";
  gtA.font = { bold: true };
  months.forEach((m, i) => {
    gtA.getCell(2 + i).value = fmtNum(sum(e => e.ym === m));
  });
  gtA.getCell(2 + months.length).value = fmtNum(sum(() => true));
  gtA.eachCell(c => {
    c.border = { top: { style: "thin", color: { argb: "FF999999" } } };
  });

  // ---- Block B: Project by People ----
  rowIdx += 2;
  pivot.getCell(`A${rowIdx}`).value = "Project by People - Hours";
  pivot.getCell(`A${rowIdx}`).font = { bold: true };
  rowIdx += 2;
  pivot.getCell(`A${rowIdx}`).value = "Year-Month";
  pivot.getCell(`A${rowIdx}`).font = { bold: true };
  pivot.getCell(`B${rowIdx}`).value = "(All)";
  rowIdx += 2;
  pivot.getCell(`A${rowIdx}`).value = "Sum of Hours";
  pivot.getCell(`A${rowIdx}`).font = { bold: true };
  pivot.getCell(`B${rowIdx}`).value = "Name";
  pivot.getCell(`B${rowIdx}`).font = { bold: true };

  rowIdx += 1;
  const headerB = pivot.getRow(rowIdx++);
  headerB.getCell(1).value = "Project";
  people.forEach((p, i) => (headerB.getCell(2 + i).value = p));
  headerB.getCell(2 + people.length).value = "Grand Total";
  headerB.font = { bold: true };
  headerB.eachCell(c => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
    c.border = { bottom: { style: "thin", color: { argb: "FFCCCCCC" } } };
  });

  for (const proj of projects) {
    const row = pivot.getRow(rowIdx++);
    row.getCell(1).value = proj;
    people.forEach((pe, i) => {
      row.getCell(2 + i).value = fmtNum(sum(e => e.project === proj && e.name === pe));
    });
    row.getCell(2 + people.length).value = fmtNum(sum(e => e.project === proj));
  }
  const gtB = pivot.getRow(rowIdx++);
  gtB.getCell(1).value = "Grand Total";
  gtB.font = { bold: true };
  people.forEach((pe, i) => {
    gtB.getCell(2 + i).value = fmtNum(sum(e => e.name === pe));
  });
  gtB.getCell(2 + people.length).value = fmtNum(sum(() => true));
  gtB.eachCell(c => {
    c.border = { top: { style: "thin", color: { argb: "FF999999" } } };
  });

  // Column widths
  pivot.getColumn(1).width = 46;
  const maxCols = Math.max(months.length, people.length) + 1;
  for (let i = 2; i <= 1 + maxCols; i++) pivot.getColumn(i).width = 12;

  // ===== Sheet 2: Detail Timesheets =====
  const detail = wb.addWorksheet("Detail Timesheets");
  detail.columns = [
    { header: "Name", key: "name", width: 22 },
    { header: "Date", key: "date", width: 12 },
    { header: "Year-Month", key: "ym", width: 12 },
    { header: "Hours", key: "hours", width: 8 },
    { header: "Task / Description", key: "desc", width: 80 },
    { header: "Project", key: "project", width: 40 },
  ];
  detail.getRow(1).font = { bold: true };
  detail.getRow(1).eachCell(c => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
    c.border = { bottom: { style: "thin", color: { argb: "FFCCCCCC" } } };
  });

  const sorted = [...entries2].sort((a, b) => a.date.getTime() - b.date.getTime());
  for (const e of sorted) {
    const row = detail.addRow({
      name: e.name,
      date: e.date,
      ym: e.ym,
      hours: Number(e.hours.toFixed(2)),
      desc: e.desc,
      project: e.project,
    });
    row.getCell(2).numFmt = "yyyy-mm-dd";
    row.getCell(4).numFmt = "0.##";
    row.getCell(5).alignment = { wrapText: true, vertical: "top" };
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeClient = clientName.replace(/[^a-z0-9]+/gi, "_");
  const fromLabel = from || "all";
  const toLabel = to || "all";
  a.href = url;
  a.download = `${safeClient}_Total_Hours_${fromLabel}_to_${toLabel}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);

  const totalHours = entries2.reduce((s, e) => s + e.hours, 0);
  return { entryCount: rows.length, totalHours };
}