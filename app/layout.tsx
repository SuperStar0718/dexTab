import { Montserrat } from 'next/font/google';
import { AppLayout } from '@/components/AppLayout';
import { ClusterProvider } from '@/components/ClusterDataAccess';
import { SolanaProvider } from '@/components/SolanaProvider';
import { AppContextProvider } from '@/components/AppContext';
import 'animate.css';
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
            <AppContextProvider>
              <AppLayout>{children}</AppLayout>
            </AppContextProvider>
          </SolanaProvider>
        </ClusterProvider>
      </body>
    </html>
  );
}
