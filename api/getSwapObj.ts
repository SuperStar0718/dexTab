import { createJupiterApiClient, QuoteResponse } from '@jup-ag/api';

/////////////////////////////////////////////////////////////////////////////

type SwapArgs = {
  quoteResponse?: QuoteResponse;
  userPublicKey: string;
  wrapAndUnwrapSol: boolean;
};

/////////////////////////////////////////////////////////////////////////////

export async function getSwapObj({
  quoteResponse,
  userPublicKey,
  wrapAndUnwrapSol = true,
}: SwapArgs) {
  const jupiterQuoteApi = createJupiterApiClient();

  if (!quoteResponse) {
    console.error('Quote response is null');
    return;
  }

  try {
    const swapTxResponse = await jupiterQuoteApi.swapPost({
      swapRequest: {
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto',
        // feeAccount is optional. Use if you want to charge a fee.  feeBps must have been passed in /quote API.
        // feeAccount: "fee_account_public_key"
      },
    });

    return swapTxResponse;
  } catch (error) {
    console.error('Error swapping tokens', error);
  }
}
