import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { issueLabel, statusClass, statusLabel } from "@/lib/issues";

export const Route = createFileRoute("/track")({
  validateSearch: z.object({ code: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Track your complaint — RoadWatch" },
      { name: "description", content: "Check the repair status of your road complaint using its unique ID." },
      { property: "og:title", content: "Track your complaint — RoadWatch" },
      { property: "og:description", content: "Enter your complaint ID to see its current status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrackPage,
});

type Result = { tracking_code: string; issue_type: string; status: string; created_at: string; updated_at: string };

function TrackPage() {
  const { code: initial } = Route.useSearch();
  const [code, setCode] = useState(initial ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null | undefined>(undefined);

  async function lookup(c: string) {
    if (!c.trim()) return;
    setLoading(true);
    const { data } = await supabase.rpc("track_complaint", { _code: c.trim().slice(0, 20) });
    setResult((data as Result[] | null)?.[0] ?? null);
    setLoading(false);
  }

  useEffect(() => { if (initial) lookup(initial); }, [initial]);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-3xl font-extrabold">Track a complaint</h1>
        <form onSubmit={(e) => { e.preventDefault(); lookup(code); }} className="mt-6 flex gap-2">
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="RW-XXXXXX" maxLength={20} className="h-12 font-mono text-lg" />
          <Button type="submit" className="h-12" disabled={loading}>{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}</Button>
        </form>
        {result === null && <p className="mt-6 rounded-xl border bg-card p-4 text-muted-foreground">No complaint found with that ID.</p>}
        {result && (
          <div className="mt-6 rounded-2xl border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-mono text-lg font-bold">{result.tracking_code}</span>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(result.status)}`}>{statusLabel(result.status)}</span>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Issue</dt><dd>{issueLabel(result.issue_type)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Submitted</dt><dd>{new Date(result.created_at).toLocaleString()}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Last update</dt><dd>{new Date(result.updated_at).toLocaleString()}</dd></div>
            </dl>
          </div>
        )}
      </main>
    </div>
  );
}
