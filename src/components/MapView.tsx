import { useEffect, useRef } from "react";
import type { Map as LMap, Marker, LeafletMouseEvent } from "leaflet";

export type Pin = { id: string; lat: number; lng: number; label?: string };

type Props = {
  value?: { lat: number; lng: number } | null;
  onPick?: (p: { lat: number; lng: number }) => void;
  pins?: Pin[];
  onPinClick?: (id: string) => void;
  className?: string;
};

const DEFAULT_CENTER: [number, number] = [20.5937, 78.9629];

export function MapView({ value, onPick, pins, onPinClick, className }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const marker = useRef<Marker | null>(null);
  const pinLayer = useRef<Marker[]>([]);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((mod) => {
      if (cancelled || !el.current || map.current) return;
      L.current = mod;
      const m = mod.map(el.current).setView(DEFAULT_CENTER, 4);
      mod.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(m);
      if (pickRef.current) {
        m.on("click", (e: LeafletMouseEvent) => pickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
      }
      map.current = m;
      setTimeout(() => m.invalidateSize(), 100);
      syncMarker();
      syncPins();
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const icon = () =>
    L.current!.divIcon({ className: "", html: '<div class="pin-marker"></div>', iconSize: [28, 28], iconAnchor: [14, 28] });

  function syncMarker() {
    if (!map.current || !L.current) return;
    if (!value) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (!marker.current) {
      marker.current = L.current.marker([value.lat, value.lng], { icon: icon(), draggable: !!pickRef.current }).addTo(map.current);
      marker.current.on("dragend", () => {
        const p = marker.current!.getLatLng();
        pickRef.current?.({ lat: p.lat, lng: p.lng });
      });
    } else marker.current.setLatLng([value.lat, value.lng]);
    map.current.setView([value.lat, value.lng], Math.max(map.current.getZoom(), 16));
  }

  function syncPins() {
    if (!map.current || !L.current || !pins) return;
    pinLayer.current.forEach((p) => p.remove());
    pinLayer.current = pins.map((p) => {
      const mk = L.current!.marker([p.lat, p.lng], { icon: icon() }).addTo(map.current!);
      if (p.label) mk.bindTooltip(p.label);
      mk.on("click", () => onPinClick?.(p.id));
      return mk;
    });
    if (pins.length) {
      map.current.fitBounds(L.current.latLngBounds(pins.map((p) => [p.lat, p.lng])), { padding: [30, 30], maxZoom: 15 });
    }
  }

  useEffect(syncMarker, [value?.lat, value?.lng]);
  useEffect(syncPins, [pins]);

  return <div ref={el} className={className ?? "h-72 w-full rounded-xl border"} />;
}
