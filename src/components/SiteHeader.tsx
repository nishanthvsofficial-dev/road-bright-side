import { Link } from "@tanstack/react-router";
import { Construction } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="bg-asphalt text-asphalt-foreground">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-extrabold">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <Construction className="h-5 w-5" />
          </span>
          RoadWatch
        </Link>
        <nav className="flex gap-1 text-sm font-medium">
          <Link to="/" className="rounded-md px-3 py-1.5 hover:bg-asphalt-foreground/10" activeOptions={{ exact: true }} activeProps={{ className: "text-primary" }}>Report</Link>
          <Link to="/track" className="rounded-md px-3 py-1.5 hover:bg-asphalt-foreground/10" activeProps={{ className: "text-primary" }}>Track</Link>
          <Link to="/admin" className="rounded-md px-3 py-1.5 hover:bg-asphalt-foreground/10" activeProps={{ className: "text-primary" }}>Admin</Link>
        </nav>
      </div>
      <div className="hazard-stripe h-1.5" />
    </header>
  );
}
