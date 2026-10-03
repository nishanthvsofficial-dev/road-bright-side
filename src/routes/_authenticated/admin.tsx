import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, LogOut, MapPin, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { SiteHeader } from "@/components/SiteHeader";
import { MapView } from "@/components/MapView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ISSUE_TYPES, STATUSES, issueLabel, statusClass, statusLabel } from "@/lib/issues";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin dashboard — RoadWatch" },
      { name: "description", content: "View, filter and manage citizen road complaints." },
      { property: "og:title", content: "Admin dashboard — RoadWatch" },
      { property: "og:description", content: "Manage reported road issues." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

type Complaint = Tables<"complaints">;

function AdminPage() {
  const nav = useNavigate();
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Complaint | null>(null);

  const isAdmin = useQuery({
    queryKey: ["is-admin", user.id],
    queryFn: async () => (await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" })).data === true,
  });

  const list = useQuery({
    queryKey: ["complaints"],
    enabled: isAdmin.data === true,
    queryFn: async () => {
      const { data, error } = await supabase.from("complaints").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => (list.data ?? []).filter((c) =>
    (status === "all" || c.status === status) &&
    (type === "all" || c.issue_type === type) &&
    (!q || [c.tracking_code, c.name, c.description].join(" ").toLowerCase().includes(q.toLowerCase())),
  ), [list.data, status, type, q]);

  const pins = useMemo(() => filtered.filter((c) => c.latitude != null && c.longitude != null)
    .map((c) => ({ id: c.id, lat: c.latitude!, lng: c.longitude!, label: `${c.tracking_code} · ${issueLabel(c.issue_type)}` })), [filtered]);

  const counts = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s.value, (list.data ?? []).filter((c) => c.status === s.value).length])), [list.data]);

  async function signOut() { await supabase.auth.signOut(); qc.clear(); nav({ to: "/auth" }); }

  if (isAdmin.isLoading) return <div className="min-h-screen"><SiteHeader /><Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin" /></div>;
  if (!isAdmin.data) return (
    <div className="min-h-screen"><SiteHeader />
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-extrabold">No admin access</h1>
        <p className="mt-2 text-muted-foreground">Your account ({user.email}) isn't an authority account.</p>
        <Button variant="outline" className="mt-6" onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Sign out</Button>
      </main>
    </div>
  );

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-extrabold">Complaints</h1>
          <Button variant="outline" size="sm" onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Sign out</Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STATUSES.map((s) => (
            <button key={s.value} onClick={() => setStatus(status === s.value ? "all" : s.value)} className={`rounded-xl border bg-card p-4 text-left ${status === s.value ? "ring-2 ring-ring" : ""}`}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <p className="font-display text-3xl font-extrabold">{counts[s.value] ?? 0}</p>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search ID, name, description" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Select value={status} onValueChange={setStatus}><SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All statuses</SelectItem>{STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select>
          <Select value={type} onValueChange={setType}><SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All issue types</SelectItem>{ISSUE_TYPES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="grid gap-5 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <MapView pins={pins} onPinClick={(id) => setSelected(filtered.find((c) => c.id === id) ?? null)} className="h-80 w-full overflow-hidden rounded-2xl border lg:h-[560px]" />
          </div>
          <div className="space-y-2 lg:col-span-2 lg:max-h-[560px] lg:overflow-y-auto">
            {list.isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin" />}
            {!list.isLoading && filtered.length === 0 && <p className="rounded-xl border bg-card p-6 text-center text-muted-foreground">No complaints match.</p>}
            {filtered.map((c) => (
              <button key={c.id} onClick={() => setSelected(c)} className="w-full rounded-xl border bg-card p-4 text-left hover:border-accent">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold">{c.tracking_code}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${statusClass(c.status)}`}>{statusLabel(c.status)}</span>
                </div>
                <p className="mt-1 font-semibold">{issueLabel(c.issue_type)}</p>
                <p className="line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()} · {c.photos.length} photo(s)</p>
              </button>
            ))}
          </div>
        </div>
      </main>
      <DetailDialog complaint={selected} onClose={() => setSelected(null)} onSaved={() => qc.invalidateQueries({ queryKey: ["complaints"] })} />
    </div>
  );
}

function DetailDialog({ complaint, onClose, onSaved }: { complaint: Complaint | null; onClose: () => void; onSaved: () => void }) {
  const [urls, setUrls] = useState<string[]>([]);
  const [status, setStatus] = useState("pending");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!complaint) return;
    setStatus(complaint.status); setNotes(complaint.admin_notes ?? ""); setUrls([]);
    if (complaint.photos.length) {
      supabase.storage.from("complaint-photos").createSignedUrls(complaint.photos, 3600)
        .then(({ data }) => setUrls((data ?? []).map((d) => d.signedUrl).filter(Boolean) as string[]));
    }
  }, [complaint]);

  async function save() {
    if (!complaint) return;
    setSaving(true);
    const { error } = await supabase.from("complaints").update({ status, admin_notes: notes.slice(0, 2000) }).eq("id", complaint.id);
    setSaving(false);
    if (error) { toast.error("Update failed"); return; }
    toast.success("Complaint updated"); onSaved(); onClose();
  }

  const c = complaint;
  return (
    <Dialog open={!!c} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {c && <>
          <DialogHeader><DialogTitle className="font-display">{c.tracking_code} · {issueLabel(c.issue_type)}</DialogTitle></DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <div><p className="text-muted-foreground">Reporter</p><p className="font-medium">{c.name}</p></div>
              <div><p className="text-muted-foreground">Contact</p><p className="font-medium break-all">{c.contact}</p></div>
            </div>
            <div><p className="text-muted-foreground">Description</p><p className="whitespace-pre-wrap">{c.description}</p></div>
            {c.suggestion && <div><p className="text-muted-foreground">Suggestion</p><p className="whitespace-pre-wrap">{c.suggestion}</p></div>}
            {c.photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {urls.length === 0 ? <Loader2 className="h-5 w-5 animate-spin" /> : urls.map((u) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="Complaint photo" className="aspect-square w-full rounded-lg border object-cover" /></a>
                ))}
              </div>
            )}
            {c.latitude != null && c.longitude != null && <>
              <MapView value={{ lat: c.latitude, lng: c.longitude }} className="h-56 w-full overflow-hidden rounded-xl border" />
              <a className="inline-flex items-center text-accent underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${c.latitude}&mlon=${c.longitude}#map=18/${c.latitude}/${c.longitude}`}>
                <MapPin className="mr-1 h-4 w-4" />{c.latitude.toFixed(5)}, {c.longitude.toFixed(5)}
              </a>
            </>}
            <div className="grid gap-3 border-t pt-4">
              <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select>
              <Textarea placeholder="Internal notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
              <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save changes</Button>
            </div>
          </div>
        </>}
      </DialogContent>
    </Dialog>
  );
}
