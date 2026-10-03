import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Camera, CheckCircle2, Copy, Crosshair, ImagePlus, Loader2, MapPin, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { MapView } from "@/components/MapView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ISSUE_TYPES } from "@/lib/issues";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RoadWatch — Report potholes, streetlights & sidewalk damage" },
      { name: "description", content: "Report road issues with photos and GPS location, and track your complaint with a unique ID." },
      { property: "og:title", content: "RoadWatch — Report road issues" },
      { property: "og:description", content: "Snap a photo, pin the spot, submit. Track repairs with your complaint ID." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportPage,
});

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  contact: z.string().trim().min(5, "Enter a phone or email").max(255),
  issue_type: z.string().min(1, "Choose an issue type"),
  description: z.string().trim().min(10, "Describe the problem (10+ characters)").max(2000),
  suggestion: z.string().trim().max(1000).optional(),
});

const MAX_FILES = 6;
const MAX_SIZE = 5 * 1024 * 1024;

function Section({ n, title, icon: Icon, children }: { n: number; title: string; icon: typeof Camera; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-asphalt font-display font-extrabold text-primary">{n}</span>
        <h2 className="flex items-center gap-2 text-lg font-bold"><Icon className="h-5 w-5 text-accent" />{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ReportPage() {
  const [form, setForm] = useState({ name: "", contact: "", issue_type: "", description: "", suggestion: "" });
  const [files, setFiles] = useState<File[]>([]);
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [code, setCode] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  function addFiles(list: FileList | null) {
    if (!list) return;
    const ok: File[] = [];
    for (const f of Array.from(list)) {
      if (!["image/jpeg", "image/png"].includes(f.type)) { toast.error(`${f.name}: only JPEG or PNG`); continue; }
      if (f.size > MAX_SIZE) { toast.error(`${f.name}: max 5MB`); continue; }
      ok.push(f);
    }
    setFiles((prev) => [...prev, ...ok].slice(0, MAX_FILES));
  }

  function detect() {
    if (!navigator.geolocation) { toast.error("GPS not available — tap the map to pin the location"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setLoc({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocating(false); toast.success("Location captured"); },
      () => { setLocating(false); toast.error("Couldn't get GPS — tap the map to pin it manually"); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    const errs: Record<string, string> = {};
    if (!parsed.success) parsed.error.issues.forEach((i) => (errs[String(i.path[0])] = i.message));
    if (!loc) errs["location"] = "Add the location using GPS or by tapping the map";
    setErrors(errs);
    if (Object.keys(errs).length) { toast.error("Please fix the highlighted fields"); return; }

    setSubmitting(true);
    try {
      const folder = crypto.randomUUID();
      const paths: string[] = [];
      for (const [i, f] of files.entries()) {
        const path = `${folder}/${i}.${f.type === "image/png" ? "png" : "jpg"}`;
        const { error } = await supabase.storage.from("complaint-photos").upload(path, f, { contentType: f.type });
        if (error) throw error;
        paths.push(path);
      }
      const d = parsed.data!;
      const { data, error } = await supabase.rpc("submit_complaint", {
        _name: d.name, _contact: d.contact, _issue_type: d.issue_type, _description: d.description,
        _suggestion: d.suggestion ?? "", _latitude: loc!.lat, _longitude: loc!.lng, _photos: paths,
      });
      if (error) throw error;
      setCode(data as string);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error(err);
      toast.error("Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setForm({ name: "", contact: "", issue_type: "", description: "", suggestion: "" });
    setFiles([]); setLoc(null); setCode(null);
  }

  if (code) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-lg px-4 py-12 text-center">
          <CheckCircle2 className="mx-auto h-16 w-16 text-success" />
          <h1 className="mt-4 text-3xl font-extrabold">Complaint submitted</h1>
          <p className="mt-2 text-muted-foreground">Thank you! Save this ID to track progress.</p>
          <div className="mt-6 rounded-2xl bg-asphalt p-6 text-asphalt-foreground">
            <p className="text-xs uppercase tracking-widest opacity-70">Complaint ID</p>
            <p className="mt-1 font-display text-4xl font-extrabold tracking-wider text-primary">{code}</p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={() => { navigator.clipboard.writeText(code); toast.success("Copied"); }}>
              <Copy className="mr-1 h-4 w-4" /> Copy ID
            </Button>
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild><Link to="/track" search={{ code }}>Track this complaint</Link></Button>
            <Button variant="outline" onClick={reset}>Report another issue</Button>
          </div>
        </main>
      </div>
    );
  }

  const err = (k: string) => errors[k] && <p className="mt-1 text-sm text-destructive">{errors[k]}</p>;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="bg-asphalt text-asphalt-foreground">
        <div className="mx-auto max-w-5xl px-4 pb-10 pt-8">
          <h1 className="text-3xl font-extrabold leading-tight sm:text-5xl">Spotted a road problem?<br /><span className="text-primary">Report it in a minute.</span></h1>
          <p className="mt-3 max-w-xl opacity-80">Potholes, dark streetlights, broken sidewalks — snap a photo, pin the spot, and we'll route it to the right team.</p>
        </div>
        <div className="road-dash h-1 opacity-60" />
      </div>

      <form onSubmit={submit} className="mx-auto grid max-w-5xl gap-5 px-4 py-8 lg:grid-cols-2">
        <div className="space-y-5">
          <Section n={1} title="Your complaint" icon={Send}>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div><Label htmlFor="name">Full name</Label><Input id="name" value={form.name} onChange={(e) => set("name")(e.target.value)} maxLength={100} />{err("name")}</div>
                <div><Label htmlFor="contact">Phone or email</Label><Input id="contact" value={form.contact} onChange={(e) => set("contact")(e.target.value)} maxLength={255} />{err("contact")}</div>
              </div>
              <div>
                <Label>Type of issue</Label>
                <Select value={form.issue_type} onValueChange={set("issue_type")}>
                  <SelectTrigger><SelectValue placeholder="Select issue type" /></SelectTrigger>
                  <SelectContent>{ISSUE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
                {err("issue_type")}
              </div>
              <div><Label htmlFor="desc">Describe the problem</Label><Textarea id="desc" rows={4} value={form.description} onChange={(e) => set("description")(e.target.value)} maxLength={2000} placeholder="Size, how long it's been there, any danger…" />{err("description")}</div>
              <div><Label htmlFor="sug">Suggestions for improvement <span className="text-muted-foreground">(optional)</span></Label><Textarea id="sug" rows={3} value={form.suggestion} onChange={(e) => set("suggestion")(e.target.value)} maxLength={1000} placeholder="e.g. add a speed bump, better lighting at this corner…" /></div>
            </div>
          </Section>

          <Section n={2} title="Photos" icon={Camera}>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-muted/50 p-6 text-center hover:border-accent">
              <ImagePlus className="h-8 w-8 text-accent" />
              <span className="font-semibold">Upload photos</span>
              <span className="text-xs text-muted-foreground">JPEG or PNG · up to {MAX_FILES} files · 5MB each</span>
              <input type="file" accept="image/jpeg,image/png" multiple className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            </label>
            {files.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {files.map((f, i) => (
                  <div key={i} className="relative aspect-square overflow-hidden rounded-lg border">
                    <img src={URL.createObjectURL(f)} alt={f.name} className="h-full w-full object-cover" />
                    <button type="button" aria-label="Remove photo" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded-full bg-asphalt p-1 text-asphalt-foreground"><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-5">
          <Section n={3} title="Location" icon={MapPin}>
            <Button type="button" onClick={detect} disabled={locating} className="w-full">
              {locating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Crosshair className="mr-2 h-4 w-4" />}
              Use my current location
            </Button>
            <p className="my-3 text-center text-xs text-muted-foreground">or tap the map / drag the pin to set it manually</p>
            <MapView value={loc} onPick={setLoc} className="h-72 w-full overflow-hidden rounded-xl border sm:h-80" />
            {loc && <p className="mt-2 text-sm text-muted-foreground"><MapPin className="mr-1 inline h-4 w-4 text-accent" />{loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}</p>}
            {err("location")}
          </Section>

          <Button type="submit" size="lg" disabled={submitting} className="h-14 w-full text-base font-bold">
            {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
            Submit Complaint
          </Button>
        </div>
      </form>
    </div>
  );
}
