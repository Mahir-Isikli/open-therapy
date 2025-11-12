import { headers } from 'next/headers';
import { getAppConfig } from '@/lib/utils';
import Script from 'next/script';

interface LayoutProps {
  children: React.ReactNode;
}

export default async function Layout({ children }: LayoutProps) {
  const hdrs = await headers();
  const { companyName, logo, logoDark } = await getAppConfig(hdrs);

  return (
    <>
      {/* Animated Gradient Background */}
      <Script src="/gradient/gradient-engine.js" strategy="afterInteractive" />

      {children}
    </>
  );
}
