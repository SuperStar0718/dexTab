import type { Metadata } from 'next';
import Swap from '@/components/Swap';

/////////////////////////////////////////////////////////////////////////////

export const metadata: Metadata = {
  title: 'DexTab',
  description: 'Dex orders in your browser',
};

/////////////////////////////////////////////////////////////////////////////

export default function Page() {
  return (
    <div className="app">
      <Swap />
    </div>
  );
}
