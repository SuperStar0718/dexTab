import fetch from 'cross-fetch';

/////////////////////////////////////////////////////////////////////////////

export const getOrderHistory = async (publicKey: string) => {
  const orderHistoryRes = await (
    await fetch(`https://jup.ag/api/limit/v1/orderHistory?wallet=${publicKey}`)
  ).json();

  return orderHistoryRes || [];
};
