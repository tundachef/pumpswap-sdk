import {
  PublicKey, TransactionInstruction, SystemProgram, LAMPORTS_PER_SOL, TransactionMessage,
  ComputeBudgetProgram,
  VersionedTransaction,
} from '@solana/web3.js';
import { connection, wallet_1 } from './constants';
import { AnchorProvider } from "@coral-xyz/anchor";
import { PumpSwapSDK } from './pumpswap';

async function buy_example() {

  const pumpswap_sdk = new PumpSwapSDK();

  pumpswap_sdk.buy(new PublicKey("AjgSvYmJLhvt3FteiyTqQf8XBj1SVs6T6AmSUfkHpump"),
    new PublicKey("9bGYzUG6Mpuy8dHuJaSkbguW87GZk7A8YgPgCSVANGpx"),
    0.05); // 0.22 sol

}
buy_example();