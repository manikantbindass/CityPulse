'use client';
import { Button } from '../components/ui/button';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-screen">
      <h1>Something interrupted this view.</h1>
      <p>Your local preferences are saved. Try loading the page again.</p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
