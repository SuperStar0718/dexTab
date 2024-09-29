'use client';
import React, { useState, useEffect } from 'react';
import { VersionedTransaction, Connection } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import styles from './swap.module.scss';

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

export default function Swap() {
  const wallet = useWallet();
  const connection = new Connection(
    'https://fabled-green-frog.solana-mainnet.quiknode.pro/f7944976a48ec80e8628553e4636a3adff6c1ca5'
  );

  const [tokenList, setTokenList] = useState<Token[] | undefined>([]);
  const [fromAsset, setFromAsset] = useState<Token | undefined>(undefined);
  const [toAsset, setToAsset] = useState<Token | undefined>(undefined);
  const [fromAmount, setFromAmount] = useState<number | undefined>();
  const [toAmount, setToAmount] = useState<number | undefined>();
  const [quoteResponse, setQuoteResponse] = useState(null);

  async function getTokenList() {
    const tokenList = await (
      await fetch('https://tokens.jup.ag/tokens?tags=verified')
    ).json();

    setTokenList(tokenList);
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
  // console.log(tokenList);

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

    const quote = await (
      await fetch(
        `https://quote-api.jup.ag/v6/quote
        ?inputMint=${fromAsset.address}
        &outputMint=${toAsset.address}
        &amount=${currentAmount * Math.pow(10, fromAsset.decimals)}
        &slippage=0.5`
      )
    ).json();

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

    const { swapTransaction } = await (
      await fetch('https://quote-api.jup.ag/v6/swap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quoteResponse,
          userPublicKey: wallet.publicKey?.toString(),
          wrapAndUnwrapSol: true,
          // feeAccount is optional. Use if you want to charge a fee.  feeBps must have been passed in /quote API.
          // feeAccount: "fee_account_public_key"
        }),
      })
    ).json();

    try {
      const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
      const signedTransaction = await wallet.signTransaction(transaction);

      const rawTransaction = signedTransaction.serialize();
      const txid = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: true,
        maxRetries: 2,
      });

      const latestBlockHash = await connection.getLatestBlockhash();
      await connection.confirmTransaction(
        {
          blockhash: latestBlockHash.blockhash,
          lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
          signature: txid,
        },
        'confirmed'
      );

      // console.log(`https://solscan.io/tx/${txid}`);
    } catch (error) {
      console.error('Error signing or sending the transaction:', error);
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
        <button
          onClick={signAndSendTransaction}
          className={styles.button}
          disabled={toAsset?.address === fromAsset?.address}
        >
          Swap
        </button>
      </div>
    </div>
  );
}
