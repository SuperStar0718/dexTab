import { Token } from '@/types';
import { Connection } from '@solana/web3.js';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/////////////////////////////////////////////////////////////////////////////

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/////////////////////////////////////////////////////////////////////////////

export const wait = (time: number) =>
  new Promise((resolve) => setTimeout(resolve, time));

/////////////////////////////////////////////////////////////////////////////

export const getTokenSymbolFromCA = (tokenList: Token[], ca: string) => {
  return tokenList?.find((asset) => asset.address === ca)?.symbol;
};

/////////////////////////////////////////////////////////////////////////////

export const getTokenDecimalsFromCA = (tokenList: Token[], ca: string) => {
  return tokenList?.find((asset) => asset.address === ca)?.decimals;
};

/////////////////////////////////////////////////////////////////////////////

export async function isBlockhashExpired(
  connection: Connection,
  lastValidBlockHeight: number
) {
  let currentBlockHeight = await connection.getBlockHeight('finalized');
  console.log('                           ');
  console.log('Current Block height:             ', currentBlockHeight);
  console.log(
    'Last Valid Block height - 150:     ',
    lastValidBlockHeight - 150
  );
  console.log('--------------------------------------------');
  console.log(
    'Difference:                      ',
    currentBlockHeight - (lastValidBlockHeight - 150)
  ); // If Difference is positive, blockhash has expired.
  console.log('                           ');

  return currentBlockHeight > lastValidBlockHeight - 150;
}

/////////////////////////////////////////////////////////////////////////////
