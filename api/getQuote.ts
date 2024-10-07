import { debounce } from 'lodash';
import {
  createJupiterApiClient,
  QuoteGetRequest,
  QuoteResponse,
} from '@jup-ag/api';
import { Token } from '../types';

/////////////////////////////////////////////////////////////////////////////

export type QuoteArgs = {
  fromAsset?: Token;
  toAsset?: Token;
  currentAmount: number;
};

/////////////////////////////////////////////////////////////////////////////

export async function getQuote({
  fromAsset,
  toAsset,
  currentAmount,
}: QuoteArgs) {
  const jupiterQuoteApi = createJupiterApiClient();

  if (isNaN(currentAmount) || currentAmount <= 0) {
    console.error('Invalid fromAmount value:', currentAmount);
    return;
  }

  if (!fromAsset?.address || !toAsset?.address) {
    console.error('Invalid fromAsset or toAsset value:', fromAsset, toAsset);
    return;
  }

  const params: QuoteGetRequest = {
    inputMint: fromAsset.address,
    outputMint: toAsset.address,
    amount: currentAmount * Math.pow(10, fromAsset.decimals),
    autoSlippage: true,
    autoSlippageCollisionUsdValue: 1_000,
    maxAutoSlippageBps: 1000, // 10%
    minimizeSlippage: true,
    onlyDirectRoutes: false,
    asLegacyTransaction: false,
    // feeBps must have been passed in /quote API.
    // feeBps: 100
  };

  const quote = await jupiterQuoteApi.quoteGet(params);

  if (!quote) {
    throw new Error('unable to quote');
  }

  return quote;
}
