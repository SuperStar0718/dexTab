import fetch from 'cross-fetch';

/////////////////////////////////////////////////////////////////////////////

export const cancelOrders = async ( orders: string[], wallet:any) => {
  const { tx } = await (
    await fetch(`https://jup.ag/api/limit/v1/cancelOrders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        owner: wallet.publicKey?.toString(),
        feePayer: wallet.publicKey?.toString(),
        orders,
      }),
    })
  ).json();

  return tx;
};
