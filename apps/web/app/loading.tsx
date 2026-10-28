export default function Loading() {
  return (
    <main className="loading-screen" aria-busy="true" aria-label="Loading workspace">
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton" />
      <p>Loading your workspace…</p>
    </main>
  );
}
