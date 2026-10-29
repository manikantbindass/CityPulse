import type { CityPage } from './contracts';
export async function getCities(): Promise<CityPage> {
  const response = await fetch('/api/cities', { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('City registry is unavailable. Start the API to connect live.');
  return response.json() as Promise<CityPage>;
}
export async function getForecast(
  values: number[],
  horizon: number,
): Promise<{ predictions: number[]; model: string }> {
  const response = await fetch('/api/forecast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values, horizon, interval_minutes: 1440 }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Forecast service unavailable. Start the local AI service.');
  return response.json();
}
export function exportCsv(rows: Record<string, unknown>[], name: string) {
  if (!rows.length) return;
  const columns = Object.keys(rows[0]);
  const cell = (value: unknown) => {
    const raw = String(value ?? '');
    const safe = /^(?:\s*[=+@\-]|[\t\r\n])/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const csv = [
    columns.map(cell).join(','),
    ...rows.map((row) => columns.map((key) => cell(row[key])).join(',')),
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
