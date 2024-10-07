import fetch from 'cross-fetch';

/////////////////////////////////////////////////////////////////////////////

export const cancelOrders = async (publicKey: string, orders: string[]) => {
  const { tx } = await (
    await fetch(`https://jup.ag/api/limit/v1/cancelOrders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        owner: publicKey,
        feePayer: publicKey,
        orders,
      }),
    })
  ).json();

  return tx;
};
