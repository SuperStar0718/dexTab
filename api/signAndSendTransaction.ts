import { Connection, VersionedTransaction } from '@solana/web3.js';
import { WalletContextState } from '@solana/wallet-adapter-react';
import { transactionSenderAndConfirmationWaiter } from '../lib/transactionSender';

/////////////////////////////////////////////////////////////////////////////

type SignAndSendTransactionArgs = {
  tx: string;
  connection: Connection;
  wallet: WalletContextState;
  lastValidBlockHeight?: number;
};

/////////////////////////////////////////////////////////////////////////////

export async function signAndSendTransaction({
  tx,
  connection,
  wallet,
  lastValidBlockHeight,
}: SignAndSendTransactionArgs) {
  if (!wallet.connected || !wallet.signTransaction) {
    console.error(
      'Wallet is not connected or does not support signing transactions'
    );
    return;
  }

  if (!tx) {
    console.error('Transaction is null');
    return;
  }

  try {
    // Serialize the transaction
    const transactionBuf = Buffer.from(tx, 'base64');
    var transaction = VersionedTransaction.deserialize(transactionBuf);

    // TODO: This next step is failing
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
      console.error('Simulation Error:');
      console.error({ err, logs });
      return;
    }
    const serializedTransaction = Buffer.from(signedTransaction.serialize());
    const blockhash = transaction.message.recentBlockhash;
    const latestBlockHash = await connection.getLatestBlockhash();

    const transactionResponse = await transactionSenderAndConfirmationWaiter({
      connection,
      serializedTransaction,
      blockhashWithExpiryBlockHeight: {
        blockhash,
        lastValidBlockHeight:
          lastValidBlockHeight ?? latestBlockHash.lastValidBlockHeight,
      },
    });

    // If we are not getting a response back, the transaction has not confirmed.
    if (!transactionResponse) {
      console.error('Transaction not confirmed');
      return;
    }

    if (transactionResponse.meta?.err) {
      console.error(transactionResponse.meta?.err);
    }
  } catch (error) {
    console.error('Error signing or sending the transaction:', error);
  }
}
