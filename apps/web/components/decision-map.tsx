'use client';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import { Map as MapLibreMap, NavigationControl, LngLatBounds } from 'maplibre-gl';
import type { Opportunity } from '../lib/decision-contracts';

export function DecisionMap({ rows }: { rows: Opportunity[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('');
  useEffect(() => {
    if (!ref.current) return;
    const points = rows.filter((r) => r.latitude != null && r.longitude != null);
    if (!points.length) return;
    let map: MapLibreMap | undefined;
    try {
      map = new MapLibreMap({
        container: ref.current,
        style: {
          version: 8,
          sources: {},
          layers: [{ id: 'ground', type: 'background', paint: { 'background-color': '#101e2b' } }],
        },
        center: [points[0].longitude!, points[0].latitude!],
        zoom: 9,
      });
      map.addControl(new NavigationControl());
      map.on('load', () => {
        map!.addSource('districts', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: points.map((r) => ({
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [r.longitude!, Math.max(-85, Math.min(85, r.latitude!))],
              },
              properties: { id: r.id, gap: r.gap ?? -1 },
            })),
          },
        });
        map!.addLayer({
          id: 'districts',
          type: 'circle',
          source: 'districts',
          paint: {
            'circle-color': ['case', ['<', ['get', 'gap'], 0], '#91a6b5', '#8ae7dd'],
            'circle-radius': ['interpolate', ['linear'], ['get', 'gap'], 0, 7, 200, 22],
            'circle-opacity': 0.85,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#eefaff',
          },
        });
        const bounds = new LngLatBounds();
        points.forEach((p) =>
          bounds.extend([p.longitude!, Math.max(-85, Math.min(85, p.latitude!))]),
        );
        map!.fitBounds(bounds, { padding: 65, maxZoom: 12, duration: 0 });
        map!.on('click', 'districts', (e) =>
          setSelected(String(e.features?.[0]?.properties?.id ?? '')),
        );
      });
      map.on('error', () =>
        setError('Map rendering is unavailable. The coordinate table remains accessible.'),
      );
    } catch {
      queueMicrotask(() => setError('WebGL is unavailable. Use the coordinate table below.'));
    }
    return () => map?.remove();
  }, [rows]);
  return (
    <div>
      <p className="fine-print">
        Coordinate overlay only · no street basemap, route or travel time is implied. Circles show
        known positive quantity gaps; gray means unknown.
      </p>
      <div ref={ref} className="decision-map" aria-label="District gap coordinate overlay" />
      {error && <p role="status">{error}</p>}
      {selected && <p>Selected: {rows.find((r) => r.id === selected)?.name}</p>}
      <div className="table-scroll">
        <table>
          <caption>Accessible district coordinates and gaps</caption>
          <thead>
            <tr>
              <th scope="col">District</th>
              <th scope="col">Latitude</th>
              <th scope="col">Longitude</th>
              <th scope="col">Gap</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <th scope="row">{r.name}</th>
                <td>{r.latitude ?? 'Unknown'}</td>
                <td>{r.longitude ?? 'Unknown'}</td>
                <td>{r.gap ?? 'Unknown'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
