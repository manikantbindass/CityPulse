export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    const { registerOTel } = await import('@vercel/otel');
    registerOTel({ serviceName: 'citypulse-web' });
  }
}
export function onRequestError() {
  // Do not log exception text, URLs, headers or bodies supplied by a caller.
  console.error(JSON.stringify({ event: 'web_request_error', service: 'citypulse-web' }));
}
