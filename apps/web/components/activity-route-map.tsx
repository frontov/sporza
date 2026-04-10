"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ActivityRoutePoint } from "../lib/api";
import { loadYandexMaps } from "../lib/yandex-maps";

interface ActivityRouteMapProps {
  points: ActivityRoutePoint[];
  distanceMeters?: number | null;
  durationSeconds?: number;
}

const YANDEX_MAPS_API_KEY = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY ?? "";

type MarkerPopup = "start" | "finish" | null;

export function ActivityRouteMap({ points, distanceMeters = null, durationSeconds = 0 }: ActivityRouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<{ destroy: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [activePopup, setActivePopup] = useState<MarkerPopup>(null);
  const hasYandexMapsApiKey = Boolean(YANDEX_MAPS_API_KEY);

  const fallback = useMemo(() => <RouteFallback points={points} />, [points]);

  useEffect(() => {
    if (!containerRef.current || points.length < 2) {
      return;
    }

    if (!hasYandexMapsApiKey) {
      setError(null);
      setMapReady(false);
      return;
    }

    let mounted = true;
    setError(null);
    setMapReady(false);

    loadYandexMaps(YANDEX_MAPS_API_KEY)
      .then((ymaps3) => {
        if (!mounted || !containerRef.current) {
          return;
        }

        const coordinates = points.map((point) => [point.lon, point.lat] as [number, number]);
        const bounds = getBounds(points);

        const map = new ymaps3.YMap(
          containerRef.current,
          {
            location: {
              bounds: [
                [bounds.minLon, bounds.minLat],
                [bounds.maxLon, bounds.maxLat],
              ],
              duration: 300,
            },
            mode: "vector",
            behaviors: ["drag", "pinchZoom", "scrollZoom", "dblClick"],
            showScaleInCopyrights: true,
          },
          [new ymaps3.YMapDefaultSchemeLayer({}), new ymaps3.YMapDefaultFeaturesLayer({})],
        );

        mapRef.current = map;

        map.addChild(
          new ymaps3.YMapFeature({
            id: "activity-route",
            geometry: {
              type: "LineString",
              coordinates,
            },
            style: {
              stroke: [
                {
                  color: "#FF6B4A",
                  width: 5,
                },
              ],
            },
          }),
        );

        map.addChild(
          new ymaps3.YMapMarker(
            { coordinates: coordinates[0] },
            createMarkerElement("Старт", "#112A46", () => setActivePopup("start")),
          ),
        );
        map.addChild(
          new ymaps3.YMapMarker(
            { coordinates: coordinates[coordinates.length - 1] },
            createMarkerElement("Финиш", "#0E9F6E", () => setActivePopup("finish")),
          ),
        );

        if (mounted) {
          setMapReady(true);
        }
      })
      .catch((mapError) => {
        if (mounted) {
          setError(mapError instanceof Error ? mapError.message : "Не удалось загрузить Yandex Maps");
          setMapReady(false);
        }
      });

    return () => {
      mounted = false;
      mapRef.current?.destroy();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [hasYandexMapsApiKey, points]);

  if (points.length < 2) {
    return (
      <div className="rounded-[28px] border border-dashed border-ink/15 bg-sky/60 p-8 text-sm text-slate-500">
        Для этой активности маршрут не сохранён.
      </div>
    );
  }

  if (!hasYandexMapsApiKey || error) {
    return (
      <div className="space-y-3">
        {!hasYandexMapsApiKey ? (
          <p className="text-sm text-slate-600">
            Интерактивная карта недоступна без ключа. Задайте{" "}
            <code className="rounded bg-sky/80 px-1.5 py-0.5 text-xs">NEXT_PUBLIC_YANDEX_MAPS_API_KEY</code> в{" "}
            <code className="rounded bg-sky/80 px-1.5 py-0.5 text-xs">.env.local</code> (корень репозитория или{" "}
            <code className="rounded bg-sky/80 px-1.5 py-0.5 text-xs">apps/web</code>) и перезапустите dev-сервер. Ниже — схема
            маршрута.
          </p>
        ) : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {fallback}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_20px_60px_rgba(17,42,70,0.08)]">
      <div className="border-b border-white/70 px-5 py-4 text-sm text-slate-600">Маршрут активности</div>
      <div className="relative h-[360px] w-full">
        {!mapReady ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-sky/40 text-sm text-slate-600">
            Загрузка карты Yandex…
          </div>
        ) : null}
        <div className="h-full w-full" ref={containerRef} />
        {activePopup ? (
          <div className="pointer-events-none absolute left-4 top-4 max-w-[260px] rounded-2xl bg-white/95 p-4 shadow-[0_16px_40px_rgba(17,42,70,0.16)]">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-coral">
              {activePopup === "start" ? "Старт" : "Финиш"}
            </div>
            <div className="mt-2 text-sm leading-6 text-slate-600">
              <p>
                Координаты:{" "}
                {activePopup === "start"
                  ? `${points[0].lat.toFixed(5)}, ${points[0].lon.toFixed(5)}`
                  : `${points[points.length - 1].lat.toFixed(5)}, ${points[points.length - 1].lon.toFixed(5)}`}
              </p>
              <p>Дистанция: {distanceMeters ? `${(distanceMeters / 1000).toFixed(2)} км` : "n/a"}</p>
              <p>Время: {durationSeconds ? `${durationSeconds} сек` : "n/a"}</p>
            </div>
          </div>
        ) : (
          <div className="pointer-events-none absolute left-4 top-4 rounded-2xl bg-white/90 px-4 py-3 text-sm text-slate-600 shadow-[0_12px_32px_rgba(17,42,70,0.12)]">
            Нажмите на маркер старта или финиша, чтобы увидеть summary маршрута.
          </div>
        )}
      </div>
    </div>
  );
}

function createMarkerElement(label: string, color: string, onClick: () => void) {
  const element = document.createElement("button");
  element.type = "button";
  element.style.display = "flex";
  element.style.alignItems = "center";
  element.style.justifyContent = "center";
  element.style.minWidth = "56px";
  element.style.height = "32px";
  element.style.padding = "0 12px";
  element.style.borderRadius = "999px";
  element.style.background = color;
  element.style.color = "#FFFFFF";
  element.style.fontSize = "12px";
  element.style.fontWeight = "700";
  element.style.boxShadow = "0 12px 24px rgba(17,42,70,0.18)";
  element.style.transform = "translate(-50%, -100%)";
  element.style.border = "0";
  element.style.cursor = "pointer";
  element.textContent = label;
  element.addEventListener("click", onClick);
  return element;
}

function RouteFallback({ points }: { points: ActivityRoutePoint[] }) {
  const lats = points.map((point) => point.lat);
  const lons = points.map((point) => point.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const latRange = Math.max(maxLat - minLat, 0.0001);
  const lonRange = Math.max(maxLon - minLon, 0.0001);

  const normalized = points.map((point) => {
    const x = ((point.lon - minLon) / lonRange) * 100;
    const y = 100 - ((point.lat - minLat) / latRange) * 100;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const [startX, startY] = normalized[0].split(",");
  const [endX, endY] = normalized[normalized.length - 1].split(",");

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,#e9f5ff_0%,#d8eff5_100%)] shadow-[0_20px_60px_rgba(17,42,70,0.08)]">
      <div className="border-b border-white/70 px-5 py-4 text-sm text-slate-600">Маршрут активности</div>
      <svg className="h-[320px] w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
        <defs>
          <pattern height="10" id="sporza-grid" patternUnits="userSpaceOnUse" width="10" x="0" y="0">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(17,42,70,0.08)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect fill="url(#sporza-grid)" height="100" width="100" x="0" y="0" />
        <polyline
          fill="none"
          points={normalized.join(" ")}
          stroke="#FF6B4A"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
        />
        <circle cx={startX} cy={startY} fill="#112A46" r="1.8" />
        <circle cx={endX} cy={endY} fill="#0E9F6E" r="1.8" />
      </svg>
    </div>
  );
}

function getBounds(points: ActivityRoutePoint[]) {
  const lats = points.map((point) => point.lat);
  const lons = points.map((point) => point.lon);

  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons),
  };
}
