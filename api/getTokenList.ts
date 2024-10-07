import fetch from 'cross-fetch';

/////////////////////////////////////////////////////////////////////////////

export async function getTokenList() {
  const tokenList = await (
    await fetch('https://tokens.jup.ag/tokens?tags=verified')
  ).json();

  return tokenList;
}
