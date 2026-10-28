'use client';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';
type Record = {
  id: string;
  digest: string;
  status: string;
  chain_id: number | null;
  transaction_hash: string | null;
  contract_version: string | null;
  verified_at: string | null;
};
export function ChainRecords() {
  const query = useQuery<Record[]>({
    queryKey: ['verification-records'],
    retry: false,
    queryFn: async () => {
      const response = await fetch('/api/chain');
      if (!response.ok)
        throw new Error(
          'Start the backend to inspect recorded digests and independently checked transaction receipts.',
        );
      return response.json();
    },
  });
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Verification records · backend evidence</h2>
          <p>
            Digest receipt and chain confirmation are distinct states. No blockchain status is
            fabricated.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => query.refetch()}>
          Refresh receipts
        </Button>
      </div>
      {query.isPending && <p role="status">Loading verification records…</p>}
      {query.isError && (
        <p role="status" className="fine-print">
          {query.error.message}
        </p>
      )}
      {query.data && !query.data.length && (
        <div className="empty-state">
          <ShieldCheck size={28} />
          <h3>No verification records yet</h3>
          <p>
            Use the documented local-chain demonstration to attest a synthetic report, then submit
            its receipt for backend RPC verification.
          </p>
        </div>
      )}
      {query.data && query.data.length > 0 && (
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Scrollable data table">
          <table>
            <caption className="sr-only">
              Backend verification status, chain and transaction references
            </caption>
            <thead>
              <tr>
                <th scope="col">Digest</th>
                <th scope="col">Status</th>
                <th scope="col">Network</th>
                <th scope="col">Transaction</th>
                <th scope="col">Version</th>
              </tr>
            </thead>
            <tbody>
              {query.data.map((row) => (
                <tr key={row.id}>
                  <th scope="row">
                    <code title={row.digest}>{row.digest.slice(0, 16)}…</code>
                  </th>
                  <td>
                    {row.status === 'CHAIN_CONFIRMED'
                      ? 'Receipt checked on chain'
                      : 'Digest recorded off-chain'}
                  </td>
                  <td>
                    {row.chain_id === 31337
                      ? 'Local EVM · 31337'
                      : (row.chain_id ?? 'No chain receipt')}
                  </td>
                  <td>
                    <code title={row.transaction_hash ?? undefined}>
                      {row.transaction_hash
                        ? `${row.transaction_hash.slice(0, 16)}…`
                        : 'Not submitted'}
                    </code>
                  </td>
                  <td>{row.contract_version ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="fine-print">
        Confirmation means a successful matching event in the canonical block at verification time.
        Reorganizations and source trust still matter. Local chains have no public explorer.
      </p>
    </section>
  );
}
