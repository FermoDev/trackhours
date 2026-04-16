import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, BarChart3, FileText, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Clock className="h-6 w-6 text-primary" />
            <span className="text-xl font-semibold tracking-tight">TimeTrack</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild><Link to="/login">Log in</Link></Button>
            <Button asChild><Link to="/signup">Sign up free</Link></Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight text-foreground leading-tight">
          Time tracking<br />made <span className="text-primary">effortless</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          One-click timer, clean timesheets, and instant reports.
          Built for freelancers who value their time.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Button size="lg" asChild className="rounded-xl px-8 text-base">
            <Link to="/signup">Get started — it's free</Link>
          </Button>
          <Button size="lg" variant="outline" asChild className="rounded-xl px-8 text-base">
            <Link to="/login">Log in</Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: Clock, title: "One-click timer", desc: "Start tracking instantly. Your timer persists across page refreshes and shows everywhere in the app." },
            { icon: FileText, title: "Clean timesheets", desc: "View, filter, and submit your time entries. Weekly grid view for easy manual time entry." },
            { icon: BarChart3, title: "Instant reports", desc: "See hours by project, client, and date. Export to CSV for invoicing." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-8">
              <f.icon className="h-8 w-8 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <p className="text-center text-sm text-muted-foreground">© {new Date().getFullYear()} TimeTrack. All rights reserved.</p>
      </footer>
    </div>
  );
}
