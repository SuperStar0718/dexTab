import { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { WalletButton } from './SolanaProvider';

/////////////////////////////////////////////////////////////////////////////

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
        }}
      >
        <div>
          <Link href="/">
            <Image src="/logo.png" height={80} width={180} alt="DexTab" />
          </Link>
        </div>
        <div>
          <WalletButton />
        </div>
      </div>
      <div style={{ flexGrow: 1, padding: '6px' }}>{children}</div>
      <footer
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px 10px',
        }}
      ></footer>
    </div>
  );
}
