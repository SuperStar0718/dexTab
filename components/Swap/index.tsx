'use client';
import React, { useState, useEffect, useCallback } from 'react';
import debounce from 'lodash.debounce';
import { useWallet } from '@solana/wallet-adapter-react';
import { QuoteResponse } from '@jup-ag/api';
import { getQuote, QuoteArgs } from '@/api/getQuote';
import { getSwapObj } from '@/api/getSwapObj';
import { signAndSendTransaction } from '@/api/signAndSendTransaction';
import { Token } from '@/types';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/components/AppContext';
import styles from './index.module.scss';

/////////////////////////////////////////////////////////////////////////////

export default function Swap() {
  const wallet = useWallet();
  const { connection, tokenList } = useAppContext();

  const [fromAsset, setFromAsset] = useState<Token | undefined>(undefined);
  const [toAsset, setToAsset] = useState<Token | undefined>(undefined);
  const [fromAmount, setFromAmount] = useState<number | undefined>();
  const [toAmount, setToAmount] = useState<number | undefined>();

  const [isLoading, setIsLoading] = useState(false);
  const [quoteResponse, setQuoteResponse] = useState<
    QuoteResponse | undefined
  >();

  //////////////////////////////////////////////

  useEffect(() => {
    if (tokenList) {
      setFromAsset(tokenList[0]);
      setToAsset(tokenList[1]);
    }
  }, [tokenList]);

  useEffect(() => {
    if (quoteResponse?.outAmount && toAsset) {
      const outAmountNumber =
        Number(quoteResponse.outAmount) / Math.pow(10, toAsset.decimals);
      setToAmount(outAmountNumber);
    }
  }, [quoteResponse, toAsset]);

  //////////////////////////////////////////////

  const getLatestQuote = async (args: QuoteArgs) => {
    const quote = await getQuote(args);
    setQuoteResponse(quote);
    setIsLoading(false);
  };
  const debounceQuoteCall = useCallback(debounce(getLatestQuote, 500), []);

  //////////////////////////////////////////////

  const handleFromAssetChange = async (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setFromAsset(
      tokenList?.find((asset) => asset.symbol === event.target.value) ||
        tokenList?.[0]
    );
  };

  const handleToAssetChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setToAsset(
      tokenList?.find((asset) => asset.symbol === event.target.value) ||
        tokenList?.[1]
    );
  };

  const handleFromValueChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const amount = Number(event.target.value);
    setFromAmount(amount);
    if (amount) {
      setIsLoading(true);
      debounceQuoteCall({
        fromAsset,
        toAsset,
        currentAmount: amount,
      });
    }
  };

  //////////////////////////////////////////////

  async function executeTransaction() {
    const swapObj = await getSwapObj({
      quoteResponse,
      userPublicKey: wallet.publicKey?.toBase58() || '',
      wrapAndUnwrapSol: true,
    });

    if (!swapObj) {
      console.error('Swap object is null');
      return;
    }

    signAndSendTransaction({
      tx: swapObj.swapTransaction,
      lastValidBlockHeight: swapObj.lastValidBlockHeight,
      connection,
      wallet,
    });
  }

  return (
    <div className={styles.body}>
      <div className={styles.innerContainer}>
        <div className={styles.inputContainer}>
          <div className={styles.label}>You&apos;re Selling</div>
          <div className={styles.item}>
            <select
              value={fromAsset?.symbol}
              onChange={handleFromAssetChange}
              className={styles.selectField}
            >
              {tokenList?.map((asset) => (
                <option key={asset.address} value={asset?.symbol}>
                  {asset?.symbol}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={fromAmount}
              onChange={handleFromValueChange}
              className={styles.inputField}
              placeholder="0.00"
            />
          </div>
        </div>

        <div className={styles.inputContainer}>
          <div className={styles.label}>You&apos;re Buying</div>
          <div className={styles.item}>
            <select
              value={toAsset?.symbol}
              onChange={handleToAssetChange}
              className={styles.selectField}
            >
              {tokenList?.map((asset) => (
                <option key={asset.address} value={asset?.symbol}>
                  {asset?.symbol}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={toAmount}
              className={styles.inputField}
              readOnly
              placeholder="0.00"
            />
          </div>
        </div>
        <Button
          onClick={executeTransaction}
          className={styles.button}
          disabled={toAsset?.address === fromAsset?.address}
          style={{
            opacity: isLoading ? 0.5 : 1,
            cursor: isLoading ? 'not-allowed' : 'pointer',
          }}
        >
          {isLoading ? 'Loading...' : 'Swap'}
        </Button>
      </div>
    </div>
  );
}
