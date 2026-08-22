import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sim Suite',
  description: 'SimSuite — insurance agency management for motor and non-motor portfolios.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
