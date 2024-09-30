import { Montserrat } from 'next/font/google';
import { AppLayout } from '@/components/AppLayout';
import { ClusterProvider } from '@/components/ClusterDataAccess';
import { SolanaProvider } from '@/components/SolanaProvider';
import './globals.css';

/////////////////////////////////////////////////////////////////////////////

const montserrat = Montserrat({ subsets: ['latin'] });

/////////////////////////////////////////////////////////////////////////////

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={montserrat.className}>
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
