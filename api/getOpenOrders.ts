import fetch from 'cross-fetch';

/////////////////////////////////////////////////////////////////////////////

export const getOpenOrders = async (publicKey: string) => {
  const openOrdersRes = await (
    await fetch(`https://jup.ag/api/limit/v1/openOrders?wallet=${publicKey}`)
  ).json();

  return openOrdersRes || [];
};
