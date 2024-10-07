'use client';
import React, { useState, useEffect, useCallback } from 'react';
import debounce from 'lodash.debounce';
import { useWallet } from '@solana/wallet-adapter-react';
import { QuoteResponse } from '@jup-ag/api';
import { cancelOrders } from '@/api/cancelOrders';
import { getQuote, QuoteArgs } from '@/api/getQuote';
import { getOpenOrders } from '@/api/getOpenOrders';
import { getOrderHistory } from '@/api/getOrderHistory';
import { signAndSendLimitTransaction } from '@/api/signAndSendLimitTransaction';
import { signAndSendTransaction } from '@/api/signAndSendTransaction';
import { Token } from '@/types';
import { getTokenDecimalsFromCA, getTokenSymbolFromCA } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/components/AppContext';
import styles from './index.module.scss';

/////////////////////////////////////////////////////////////////////////////

export default function Limit() {
  const wallet = useWallet();
  const { connection, tokenList } = useAppContext();

  const [fromAsset, setFromAsset] = useState<Token | undefined>(undefined);
  const [toAsset, setToAsset] = useState<Token | undefined>(undefined);
  const [fromAmount, setFromAmount] = useState<number | undefined>();
  const [toAmount, setToAmount] = useState<number | undefined>();

  const [openOrders, setOpenOrders] = useState<any[]>([]);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [limitRate, setLimitRate] = useState<number | undefined>();
  const [shouldUpdateLimitRate, setShouldUpdateLimitRate] =
    useState<boolean>(true);

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
    if (!isLoading && wallet.publicKey) {
      getOpenOrders(wallet.publicKey?.toString()).then(setOpenOrders);
      getOrderHistory(wallet.publicKey?.toString()).then(setOrderHistory);
    }
  }, [isLoading, wallet.publicKey]);

  useEffect(() => {
    if (quoteResponse?.outAmount && toAsset && fromAsset) {
      const outAmountNumber =
        Number(quoteResponse.outAmount) / Math.pow(10, toAsset.decimals);

      if (shouldUpdateLimitRate) {
        setToAmount(outAmountNumber);
        setLimitRate(outAmountNumber / (fromAmount || 0));
      } else {
        setToAmount((fromAmount || 0) * Number(limitRate));
      }
    }
  }, [quoteResponse, toAsset, fromAsset]);

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

  const handleLimitRateChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setShouldUpdateLimitRate(false);
    setLimitRate(Number(event.target.value));
  };

  //////////////////////////////////////////////

  async function executeTransaction() {
    signAndSendLimitTransaction({
      inAmount: (fromAmount || 0) * Math.pow(10, fromAsset?.decimals || 0),
      outAmount:
        (limitRate || 0) *
        (fromAmount || 0) *
        Math.pow(10, toAsset?.decimals || 0),
      inputMint: fromAsset?.address || '',
      outputMint: toAsset?.address || '',
      connection,
      wallet,
    });
  }

  //////////////////////////////////////////////

  const cancelOrder = async (publicKey: string) => {
    const tx = await cancelOrders(publicKey, [publicKey]);
    signAndSendTransaction({
      tx,
      connection,
      wallet,
    });
  };

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
          <div className={styles.label}>{`Buy ${toAsset?.symbol} at rate`}</div>
          <div className={styles.item}>
            <input
              type="number"
              value={limitRate}
              className={styles.inputField}
              placeholder="0.00"
              onChange={handleLimitRateChange}
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

      <Tabs defaultValue="openOrders" className="w-full pt-8 text-center">
        <TabsList className="bg-[#4b3c54] rounded-3xl mb-4 self-center">
          <TabsTrigger value="openOrders" className="rounded-3xl">
            Open Orders
          </TabsTrigger>
          <TabsTrigger value="orderHistory" className="rounded-3xl">
            Order History
          </TabsTrigger>
        </TabsList>
        <TabsContent value="openOrders" className="text-white text-left">
          {openOrders?.map(({ account, publicKey }) => {
            const inputSymbol = getTokenSymbolFromCA(
              tokenList,
              account.inputMint
            );
            const outputSymbol = getTokenSymbolFromCA(
              tokenList,
              account.outputMint
            );
            const inputAmount =
              account.oriInAmount /
              Math.pow(
                10,
                getTokenDecimalsFromCA(tokenList, account.inputMint) || 0
              );
            const outputAmount =
              account.oriOutAmount /
              Math.pow(
                10,
                getTokenDecimalsFromCA(tokenList, account.outputMint) || 0
              );
            return (
              <div className="flex flex-wrap justify-between items-center border border-white/10 pb-4 mb-4 rounded-md p-4 font-medium">
                <div className="flex flex-col justify-start">
                  <p className="text-red-800">
                    {`Sell ${inputAmount} ${inputSymbol}`}
                  </p>
                  <p className="text-green-500">{`Buy ${outputAmount} ${outputSymbol}`}</p>
                </div>
                <div>
                  <button
                    className="bg-red-500 text-white px-4 py-2 rounded-md"
                    onClick={() => cancelOrder(publicKey)}
                  >
                    Cancel order
                  </button>
                </div>
                <div>
                  <p>{`${
                    outputAmount / inputAmount
                  } ${outputSymbol} per ${inputSymbol}`}</p>
                </div>
              </div>
            );
          })}
        </TabsContent>
        <TabsContent value="orderHistory" className="text-white text-left">
          {orderHistory?.map((order) => {
            const inputSymbol = getTokenSymbolFromCA(
              tokenList,
              order.inputMint
            );
            const outputSymbol = getTokenSymbolFromCA(
              tokenList,
              order.outputMint
            );
            const inputAmount =
              order.oriInAmount /
              Math.pow(
                10,
                getTokenDecimalsFromCA(tokenList, order.inputMint) || 0
              );
            const outputAmount =
              order.oriOutAmount /
              Math.pow(
                10,
                getTokenDecimalsFromCA(tokenList, order.outputMint) || 0
              );
            return (
              <div className="flex flex-wrap justify-between items-center border border-white/10 pb-4 mb-4 rounded-md p-4 font-medium">
                <div className="flex flex-col justify-start">
                  <p className="text-red-800">
                    {`Sell ${inputAmount} ${inputSymbol}`}
                  </p>
                  <p className="text-green-500">{`Buy ${outputAmount} ${outputSymbol}`}</p>
                </div>
                <div>
                  <p>{`${
                    outputAmount / inputAmount
                  } ${outputSymbol} per ${inputSymbol}`}</p>
                </div>
              </div>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
