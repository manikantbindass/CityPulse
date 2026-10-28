'use client';
import { useQuery } from '@tanstack/react-query';
import { Button } from './ui/button';
type Evidence = {
  source: string;
  rows: {
    zone_id: string;
    name: string;
    demand: number;
    supply: number;
    gap: number;
    observations: number;
  }[];
};
export function BackendEvidence() {
  const query = useQuery<Evidence>({
    queryKey: ['backend-evidence'],
    retry: false,
    queryFn: async () => {
      const response = await fetch('/api/evidence');
      if (!response.ok) throw new Error('Start the Spring API to query stored observations.');
      return response.json();
    },
  });
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Stored observation evidence</h2>
          <p>
            A separate real API query of the local database fixture. Workspace filters above apply
            to the illustrative charts.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => query.refetch()}>
          Refresh API evidence
        </Button>
      </div>
      {query.isPending && <p role="status">Querying tenant-scoped observations…</p>}
      {query.isError && (
        <p className="fine-print" role="status">
          {query.error.message} No results are fabricated when the API is unavailable.
        </p>
      )}
      {query.data && (
        <>
          <p className="fine-print">{query.data.source} · synthetic fixture, not live city data</p>
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Scrollable data table"
          >
            <table>
              <caption className="sr-only">
                Stored local fixture imbalance results in kilograms
              </caption>
              <thead>
                <tr>
                  <th scope="col">Zone</th>
                  <th scope="col">Demand (kg)</th>
                  <th scope="col">Supply (kg)</th>
                  <th scope="col">Gap (kg)</th>
                  <th scope="col">Observations</th>
                </tr>
              </thead>
              <tbody>
                {query.data.rows.map((row) => (
                  <tr key={row.zone_id}>
                    <th scope="row">{row.name}</th>
                    <td>{row.demand}</td>
                    <td>{row.supply}</td>
                    <td>{row.gap}</td>
                    <td>{row.observations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!query.data.rows.length && <p>No observations match the local fixture window.</p>}
        </>
      )}
    </section>
  );
}
