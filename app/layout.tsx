import Head from 'next/head';
import { Montserrat } from 'next/font/google';
import { AppLayout } from '@/components/AppLayout';
import { ClusterProvider } from '@/components/ClusterDataAccess';
import { SolanaProvider } from '@/components/SolanaProvider';
import './global.css';

/////////////////////////////////////////////////////////////////////////////

const montserrat = Montserrat({ subsets: ['latin'] });

export const metadata = {
  title: 'DexTab',
  description: 'Dex orders in your browser',
};

/////////////////////////////////////////////////////////////////////////////

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={montserrat.className}>
      <Head>
        <title>{metadata.title}</title>
        <meta name="description" content={metadata.description} />
      </Head>
      <body>
        <ClusterProvider>
          <SolanaProvider>
            <AppLayout>{children}</AppLayout>
          </SolanaProvider>
        </ClusterProvider>
      </body>
    </html>
  );
}
