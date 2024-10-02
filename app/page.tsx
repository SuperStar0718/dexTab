import type { Metadata } from 'next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Swap from '@/components/Swap';
import Limit from '@/components/Limit';

/////////////////////////////////////////////////////////////////////////////

export const metadata: Metadata = {
  title: 'DexTab',
  description: 'Dex orders in your browser',
};

/////////////////////////////////////////////////////////////////////////////

export default function Page() {
  return (
    <div className="app">
      <Tabs
        defaultValue="swap"
        className="w-full max-w-[600px] bg-[#230a31] p-5 rounded-[12px] flex flex-col"
      >
        <TabsList className="bg-[#4b3c54] rounded-3xl mb-4 self-center">
          <TabsTrigger value="swap" className="rounded-3xl">
            Swap
          </TabsTrigger>
          <TabsTrigger value="limit" className="rounded-3xl">
            Limit
          </TabsTrigger>
        </TabsList>
        <TabsContent value="swap">
          <Swap />
        </TabsContent>
        <TabsContent value="limit">
          <Limit />
        </TabsContent>
      </Tabs>
    </div>
  );
}
