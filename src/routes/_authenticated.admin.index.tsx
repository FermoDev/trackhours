import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { formatDuration } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Clock, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const [stats, setStats] = useState({ today: 0, week: 0, month: 0, entries: 0 });
  const [byProject, setByProject] = useState<{ name: string; hours: number }[]>([]);
  const [byFreelancer, setByFreelancer] = useState<{ name: string; hours: number }[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const monthStart = new Date(); monthStart.setDate(1);

      const [todayRes, weekRes, monthRes, entriesRes] = await Promise.all([
        supabase.from("time_entries").select("duration_minutes").eq("entry_date", today).not("duration_minutes", "is", null),
        supabase.from("time_entries").select("duration_minutes").gte("entry_date", weekStart.toISOString().slice(0, 10)).not("duration_minutes", "is", null),
        supabase.from("time_entries").select("duration_minutes").gte("entry_date", monthStart.toISOString().slice(0, 10)).not("duration_minutes", "is", null),
        supabase.from("time_entries").select("id").gte("entry_date", monthStart.toISOString().slice(0, 10)),
      ]);

      setStats({
        today: todayRes.data?.reduce((s, e) => s + (e.duration_minutes || 0), 0) || 0,
        week: weekRes.data?.reduce((s, e) => s + (e.duration_minutes || 0), 0) || 0,
        month: monthRes.data?.reduce((s, e) => s + (e.duration_minutes || 0), 0) || 0,
        entries: entriesRes.data?.length || 0,
      });

      // By project
      const projRes = await supabase.from("time_entries").select("project_id, duration_minutes, projects(name)").not("duration_minutes", "is", null).gte("entry_date", monthStart.toISOString().slice(0, 10));
      if (projRes.data) {
        const map = new Map<string, { name: string; total: number }>();
        (projRes.data as any[]).forEach((e: any) => {
          const name = e.projects?.name || "Unknown";
          const cur = map.get(e.project_id) || { name, total: 0 };
          cur.total += e.duration_minutes || 0;
          map.set(e.project_id, cur);
        });
        setByProject(Array.from(map.values()).map(v => ({ name: v.name, hours: Math.round(v.total / 6) / 10 })).sort((a, b) => b.hours - a.hours).slice(0, 8));
      }

      // By freelancer
      const freelRes = await supabase.from("time_entries").select("user_id, duration_minutes").not("duration_minutes", "is", null).gte("entry_date", monthStart.toISOString().slice(0, 10));
      const profRes = await supabase.from("profiles").select("user_id, full_name");
      if (freelRes.data && profRes.data) {
        const profMap = new Map(profRes.data.map(p => [p.user_id, p.full_name]));
        const map = new Map<string, number>();
        freelRes.data.forEach(e => map.set(e.user_id, (map.get(e.user_id) || 0) + (e.duration_minutes || 0)));
        setByFreelancer(Array.from(map.entries()).map(([uid, total]) => ({ name: profMap.get(uid) || "Unknown", hours: Math.round(total / 6) / 10 })).sort((a, b) => b.hours - a.hours).slice(0, 8));
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Today", value: formatDuration(stats.today), icon: Clock },
          { label: "This week", value: formatDuration(stats.week), icon: Clock },
          { label: "This month", value: formatDuration(stats.month), icon: Clock },
          { label: "Entries this month", value: String(stats.entries), icon: FileText },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <s.icon className="h-4 w-4" />
                <span className="text-xs">{s.label}</span>
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Hours by project (this month)</CardTitle></CardHeader>
          <CardContent>
            {byProject.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={byProject} layout="vertical">
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="hours" fill="var(--color-primary)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground">No data yet</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Hours by freelancer (this month)</CardTitle></CardHeader>
          <CardContent>
            {byFreelancer.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={byFreelancer} layout="vertical">
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="hours" fill="var(--color-chart-2)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground">No data yet</p>}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
