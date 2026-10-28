import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '../components/providers';

export const metadata: Metadata = {
  title: 'CityPulse · Urban intelligence',
  description: 'A local foundation for accountable urban supply and demand intelligence.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
