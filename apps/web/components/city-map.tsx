'use client';
import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { ScatterplotLayer } from '@deck.gl/layers';
import { districts, type District } from '../lib/seed';
import 'maplibre-gl/dist/maplibre-gl.css';

export default function CityMap({ district, heatmap }: { district: string; heatmap: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    let map: maplibregl.Map | undefined;
    try {
      map = new maplibregl.Map({
        container: container.current,
        style: {
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© OpenStreetMap contributors',
            },
          },
          layers: [
            {
              id: 'osm',
              type: 'raster',
              source: 'osm',
              paint: { 'raster-saturation': -0.75, 'raster-brightness-max': 0.6 },
            },
          ],
        },
        center: [77.5946, 12.9716],
        zoom: 10.7,
        attributionControl: {},
      });
      map.addControl(new maplibregl.NavigationControl(), 'top-right');
      const data = district === 'all' ? districts : districts.filter((row) => row.id === district);
      const overlay = new MapboxOverlay({
        interleaved: false,
        layers: [
          new ScatterplotLayer<District>({
            id: 'sample-districts',
            data,
            getPosition: (row) => [row.longitude, row.latitude],
            getRadius: (row) => (heatmap ? row.demand * 2 : 450),
            getFillColor: (row) =>
              row.demand > row.supply
                ? [96, 224, 213, heatmap ? 80 : 220]
                : [167, 139, 250, heatmap ? 80 : 220],
            getLineColor: [200, 240, 250],
            stroked: true,
            getLineWidth: 2,
            lineWidthUnits: 'pixels',
            pickable: true,
          }),
        ],
        getTooltip: (info) => {
          const row = info.object as District | undefined;
          return row ? { text: `${row.name}\nSynthetic demand: ${row.demand} units/day` } : null;
        },
      });
      map.addControl(overlay);
      const canvas = map.getCanvas();
      canvas.setAttribute(
        'aria-label',
        'Interactive map of fictional sample districts near Bengaluru. Use arrow keys to pan and plus or minus to zoom.',
      );
      map.on('error', () => setFailed(true));
    } catch {
      queueMicrotask(() => setFailed(true));
    }
    return () => map?.remove();
  }, [district, heatmap]);
  return (
    <div className="map-wrap">
      <div ref={container} className="live-map" />
      {failed && (
        <p className="map-notice" role="status">
          Map tiles unavailable. Use the accessible district table below.
        </p>
      )}
      <span className="map-credit">
        Fictional districts · real basemap · approximate sample coordinates
      </span>
    </div>
  );
}
