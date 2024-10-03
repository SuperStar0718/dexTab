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
import { Button } from '@/components/ui/button';
import styles from './index.module.scss';
import { transactionSenderAndConfirmationWaiter } from '@/lib/transactionSender';
import {
  createJupiterApiClient,
  QuoteGetRequest,
  QuoteResponse,
} from '@jup-ag/api';

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
  const [quoteResponse, setQuoteResponse] = useState<QuoteResponse | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);

  async function getTokenList() {
    setIsLoading(true);
    const tokenList = await (
      await fetch('https://tokens.jup.ag/tokens?tags=verified')
    ).json();
    setTokenList(tokenList);
    setIsLoading(false);
  }

  useEffect(() => {
    getTokenList();
  }, []);

  useEffect(() => {
    if (tokenList) {
      setFromAsset(tokenList[0]);
      setToAsset(tokenList[1]);
    }
  }, [tokenList]);

  const getOpenOrders = async () => {
    const openOrdersRes = await (
      await fetch(
        `https://jup.ag/api/limit/v1/openOrders?wallet=${wallet.publicKey?.toString()}`
      )
    ).json();
    console.log({ openOrdersRes });
  };

  const getOrderHistory = async () => {
    const orderHistoryRes = await (
      await fetch(
        `https://jup.ag/api/limit/v1/orderHistory?wallet=${wallet.publicKey?.toString()}`
      )
    ).json();
    console.log({ orderHistoryRes });
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

  const debounceQuoteCall = debounce(getQuote, 500);

  useEffect(() => {
    if (fromAmount) {
      debounceQuoteCall(fromAmount);
    }
  }, [fromAmount, debounceQuoteCall]);

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
      const outAmountNumber =
        Number(quote.outAmount) / Math.pow(10, toAsset.decimals);
      setToAmount(outAmountNumber);
    }

    setQuoteResponse(quote);
  }

  async function signAndSendTransaction() {
    if (!wallet.connected || !wallet.signTransaction) {
      console.error(
        'Wallet is not connected or does not support signing transactions'
      );
      return;
    }
    setIsLoading(true);

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
            (toAmount || 0) * Math.pow(10, toAsset?.decimals || 0) * 0.9,
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
      microLamports: 1000,
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
    const latestBlockHash = await connection.getLatestBlockhash();
    const blockhash = latestBlockHash.blockhash;

    const transactionResponse = await transactionSenderAndConfirmationWaiter({
      connection,
      serializedTransaction,
      blockhashWithExpiryBlockHeight: {
        blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      },
    });

    // If we are not getting a response back, the transaction has not confirmed.
    if (!transactionResponse) {
      console.error('Transaction not confirmed');
      // return;
    }

    if (transactionResponse?.meta?.err) {
      console.error(transactionResponse.meta?.err);
    }
    setIsLoading(false);
  }

  // getOpenOrders();
  // getOrderHistory();

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
    </div>
  );
}
