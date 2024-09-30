import type { Metadata } from 'next';
import Swap from '@/components/Swap';
import Image from 'next/image';

/////////////////////////////////////////////////////////////////////////////

export const metadata: Metadata = {
  title: 'DexTab',
  description: 'Dex orders in your browser',
};

/////////////////////////////////////////////////////////////////////////////

export default function Page() {
  return (
    <div className="app">
      <Image src="/assets/logo.png" height={140} width={240} alt="DexTab" />
      <div className="animate__animated animate__pulse animate__infinite animate__slow">
        <h1 className="text-white text-4xl font-bold">Coming soon!</h1>
      </div>
    </div>
  );
}
