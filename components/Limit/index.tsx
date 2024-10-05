'use client';
import React, { useState, useEffect } from 'react';
import {
  VersionedTransaction,
  Connection,
  Keypair,
  ComputeBudgetProgram,
  SystemProgram,
  AddressLookupTableAccount,
  TransactionMessage,
} from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  createJupiterApiClient,
  QuoteGetRequest,
  QuoteResponse,
} from '@jup-ag/api';
import { transactionSenderAndConfirmationWaiter } from '@/lib/transactionSender';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import styles from './index.module.scss';

/////////////////////////////////////////////////////////////////////////////

type Token = {
  address: string;
  symbol: string;
  decimals: number;
};

/////////////////////////////////////////////////////////////////////////////

const debounce = <T extends unknown[]>(
  func: (...args: T) => void,
  wait: number
) => {
  let timeout: NodeJS.Timeout | undefined;

  return (...args: T) => {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/////////////////////////////////////////////////////////////////////////////

export default function Limit() {
  const wallet = useWallet();
  const connection = new Connection(
    'https://fabled-green-frog.solana-mainnet.quiknode.pro/f7944976a48ec80e8628553e4636a3adff6c1ca5'
  );
  const jupiterQuoteApi = createJupiterApiClient();
  const base = Keypair.generate();

  const [tokenList, setTokenList] = useState<Token[] | undefined>([]);
  const [fromAsset, setFromAsset] = useState<Token | undefined>(undefined);
  const [toAsset, setToAsset] = useState<Token | undefined>(undefined);
  const [fromAmount, setFromAmount] = useState<number | undefined>();
  const [toAmount, setToAmount] = useState<number | undefined>();
  const [limitRate, setLimitRate] = useState<number | undefined>();
  const [shouldUpdateLimitRate, setShouldUpdateLimitRate] =
    useState<boolean>(true);
  const [isLoading, setIsLoading] = useState(false);
  const [openOrders, setOpenOrders] = useState<any[]>([]);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);

  const getTokenList = async () => {
    setIsLoading(true);
    const tokenList = await (
      await fetch('https://tokens.jup.ag/tokens?tags=verified')
    ).json();
    setTokenList(tokenList);
    setIsLoading(false);
  };

  const getOpenOrders = async () => {
    const openOrdersRes = await (
      await fetch(
        `https://jup.ag/api/limit/v1/openOrders?wallet=${wallet.publicKey?.toString()}`
      )
    ).json();
    setOpenOrders(openOrdersRes);
  };

  const getOrderHistory = async () => {
    const orderHistoryRes = await (
      await fetch(
        `https://jup.ag/api/limit/v1/orderHistory?wallet=${wallet.publicKey?.toString()}`
      )
    ).json();
    setOrderHistory(orderHistoryRes);
  };

  useEffect(() => {
    getTokenList();
  }, []);

  useEffect(() => {
    if (tokenList) {
      setFromAsset(tokenList[0]);
      setToAsset(tokenList[1]);
    }
  }, [tokenList]);

  useEffect(() => {
    if (!isLoading) {
      getOpenOrders();
      getOrderHistory();
    }
  }, [isLoading]);

  const getTokenSymbolFromCA = (ca: string) => {
    return tokenList?.find((asset) => asset.address === ca)?.symbol;
  };

  const getTokenDecimalsFromCA = (ca: string) => {
    return tokenList?.find((asset) => asset.address === ca)?.decimals;
  };

  const cancelOrder = async (base: string) => {
    const res = await (
      await fetch(`https://jup.ag/api/limit/v1/cancelOrder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner: wallet.publicKey?.toString(),
          orders: [base],
        }),
      })
    ).json();
    console.log({ res });
  };

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

  const handleFromValueChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFromAmount(Number(event.target.value));
  };

  const handleLimitRateChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setShouldUpdateLimitRate(false);
    setLimitRate(Number(event.target.value));
  };

  const debounceQuoteCall = debounce(getQuote, 500);

  useEffect(() => {
    if (fromAmount) {
      debounceQuoteCall(fromAmount);
    }
  }, [fromAmount, debounceQuoteCall]);

  async function isBlockhashExpired(
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

  const sleep = (ms: number) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  };

  async function getQuote(currentAmount: number) {
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
    };

    // get quote
    const quote = await jupiterQuoteApi.quoteGet(params);

    if (!quote) {
      throw new Error('unable to quote');
    }

    if (quote && quote.outAmount) {
      const inAmountNumber = currentAmount * Math.pow(10, fromAsset.decimals);
      const outAmountNumber =
        Number(quote.outAmount) / Math.pow(10, toAsset.decimals);

      if (shouldUpdateLimitRate) {
        setToAmount(outAmountNumber);
        setLimitRate(outAmountNumber / currentAmount);
      } else {
        setToAmount(currentAmount * Number(limitRate));
      }
    }
  }

  async function signAndSendTransaction() {
    if (!wallet.connected || !wallet.signTransaction) {
      console.error(
        'Wallet is not connected or does not support signing transactions'
      );
      return;
    }
    setIsLoading(true);
    const START_TIME = new Date();

    const { tx } = await (
      await fetch('https://jup.ag/api/limit/v1/createOrder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner: wallet.publicKey?.toString(),
          inAmount: (fromAmount || 0) * Math.pow(10, fromAsset?.decimals || 0),
          outAmount:
            (limitRate || 0) *
            (fromAmount || 0) *
            Math.pow(10, toAsset?.decimals || 0),
          inputMint: fromAsset?.address,
          outputMint: toAsset?.address,
          expiredAt: null, // new Date().valueOf() / 1000,
          base: base.publicKey.toString(),
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: 'auto',
          // referralAccount: referralPublicKey,
          // referralName: "Referral Name"
        }),
      })
    ).json();

    const transactionBuf = Buffer.from(tx, 'base64');
    const transaction = VersionedTransaction.deserialize(transactionBuf);

    // construct the priority fee instruction
    const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1000000,
    });

    // get address lookup table accounts
    const addressLookupTableAccounts = await Promise.all(
      transaction.message.addressTableLookups.map(async (lookup) => {
        return new AddressLookupTableAccount({
          key: lookup.accountKey,
          state: AddressLookupTableAccount.deserialize(
            await connection
              .getAccountInfo(lookup.accountKey)
              .then((res) => res!.data)
          ),
        });
      })
    );

    // decompile transaction message and add priority fee instruction
    var message = TransactionMessage.decompile(transaction.message, {
      addressLookupTableAccounts: addressLookupTableAccounts,
    });
    message.instructions.push(addPriorityFee);

    // compile the message and update the transaction
    transaction.message = message.compileToV0Message(
      addressLookupTableAccounts
    );

    transaction.sign([base]);

    // Sign the transaction
    const signedTransaction = await wallet.signTransaction(transaction);

    // We first simulate whether the transaction would be successful
    const { value: simulatedTransactionResponse } =
      await connection.simulateTransaction(transaction, {
        replaceRecentBlockhash: true,
        commitment: 'processed',
      });
    const { err, logs } = simulatedTransactionResponse;

    if (err) {
      // Simulation error, we can check the logs for more details
      // If you are getting an invalid account error, make sure that you have the input mint account to actually swap from.
      console.error('Simulation Error:');
      console.error({ err, logs });
      return;
    }

    const serializedTransaction = Buffer.from(signedTransaction.serialize());
    const latestBlockHash = await connection.getLatestBlockhashAndContext(
      'finalized'
    );
    const blockhash = latestBlockHash.value.blockhash;

    const transactionResponse = await transactionSenderAndConfirmationWaiter({
      connection,
      serializedTransaction,
      blockhashWithExpiryBlockHeight: {
        blockhash,
        lastValidBlockHeight: latestBlockHash.value.lastValidBlockHeight,
      },
    });
    console.log({ transactionResponse });
    // If we are not getting a response back, the transaction has not confirmed.
    if (!transactionResponse) {
      console.error('Transaction not confirmed');
      // return;
    }

    if (transactionResponse?.meta?.err) {
      console.error(transactionResponse.meta?.err);
    }
    setIsLoading(false);

    let hashExpired = false;
    let txSuccess = false;
    while (!hashExpired && !txSuccess) {
      const { value: statuses } = await connection.getSignatureStatuses(
        transactionResponse?.transaction.signatures || []
      );

      if (!statuses || statuses.length === 0) {
        throw new Error('Failed to get signature status');
      }

      const status = statuses[0];

      if (status?.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
      }

      // Break loop if transaction has succeeded
      if (
        status &&
        (status.confirmationStatus === 'confirmed' ||
          status.confirmationStatus === 'finalized')
      ) {
        txSuccess = true;
        const endTime = new Date();
        const elapsed = (endTime.getTime() - START_TIME.getTime()) / 1000;
        console.log(`Transaction Success. Elapsed time: ${elapsed} seconds.`);
        // console.log(`https://explorer.solana.com/tx/${txId}?cluster=devnet`);
        break;
      }

      hashExpired = await isBlockhashExpired(
        connection,
        latestBlockHash.value.lastValidBlockHeight
      );

      // Break loop if blockhash has expired
      if (hashExpired) {
        const endTime = new Date();
        const elapsed = (endTime.getTime() - START_TIME.getTime()) / 1000;
        console.log(`Blockhash has expired. Elapsed time: ${elapsed} seconds.`);
        // (add your own logic to Fetch a new blockhash and resend the transaction or throw an error)
        break;
      }

      // Check again after 2.5 sec
      await sleep(2500);
    }
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
          onClick={signAndSendTransaction}
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
            const inputSymbol = getTokenSymbolFromCA(account.inputMint);
            const outputSymbol = getTokenSymbolFromCA(account.outputMint);
            const inputAmount =
              account.oriInAmount /
              Math.pow(10, getTokenDecimalsFromCA(account.inputMint) || 0);
            const outputAmount =
              account.oriOutAmount /
              Math.pow(10, getTokenDecimalsFromCA(account.outputMint) || 0);
            return (
              <div className="flex flex-wrap justify-between items-center border border-white/10 pb-4 mb-4 rounded-md p-4 font-medium">
                <div className="flex flex-col justify-start">
                  <p className="text-red-800">
                    {`Sell ${inputAmount} ${inputSymbol}`}
                  </p>
                  <p className="text-green-500">{`Buy ${outputAmount} ${outputSymbol}`}</p>
                </div>
                {/* <div>
                  <button
                    className="bg-red-500 text-white px-4 py-2 rounded-md"
                    onClick={() => cancelOrder(publicKey)}
                  >
                    Cancel order
                  </button>
                </div> */}
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
            const inputSymbol = getTokenSymbolFromCA(order.inputMint);
            const outputSymbol = getTokenSymbolFromCA(order.outputMint);
            const inputAmount =
              order.oriInAmount /
              Math.pow(10, getTokenDecimalsFromCA(order.inputMint) || 0);
            const outputAmount =
              order.oriOutAmount /
              Math.pow(10, getTokenDecimalsFromCA(order.outputMint) || 0);
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
