import {
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  Connection,
  Keypair,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { WalletContextState } from '@solana/wallet-adapter-react';
import { transactionSenderAndConfirmationWaiter } from '../lib/transactionSender';
import { isBlockhashExpired } from '@/lib/utils';
import { wait } from '@/lib/utils';

/////////////////////////////////////////////////////////////////////////////

type SignAndSendTransactionArgs = {
  inAmount: number;
  outAmount: number;
  inputMint: string;
  outputMint: string;
  connection: Connection;
  wallet: WalletContextState;
};

/////////////////////////////////////////////////////////////////////////////

export async function signAndSendLimitTransaction({
  inAmount,
  outAmount,
  inputMint,
  outputMint,
  connection,
  wallet,
}: SignAndSendTransactionArgs) {
  const base = Keypair.generate();

  if (!wallet.connected || !wallet.signTransaction) {
    console.error(
      'Wallet is not connected or does not support signing transactions'
    );
    return;
  }

  const START_TIME = new Date();

  const { tx } = await (
    await fetch('https://jup.ag/api/limit/v1/createOrder', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        owner: wallet.publicKey?.toString(),
        inAmount,
        outAmount,
        inputMint,
        outputMint,
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
  transaction.message = message.compileToV0Message(addressLookupTableAccounts);

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

  // If we are not getting a response back, the transaction has not confirmed.
  if (!transactionResponse) {
    console.error('Transaction not confirmed');
    // return;
  }

  if (transactionResponse?.meta?.err) {
    console.error(transactionResponse.meta?.err);
  }

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
    await wait(2500);
  }
}
