import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="error-screen">
      <p className="eyebrow">404 / CITYPULSE</p>
      <h1>This route is off the map.</h1>
      <p>Return to your workspace to continue exploring.</p>
      <Link className="button button-primary" href="/dashboard">
        Back to overview
      </Link>
    </main>
  );
}
