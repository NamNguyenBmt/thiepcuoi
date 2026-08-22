import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Thiệp cưới online',
  description: 'Thiệp cưới online — ThiepCuoiOnline',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body
        style={{
          margin: 0,
          background: '#faf7f6',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          color: '#1f2328',
        }}
      >
        {children}
      </body>
    </html>
  );
}
