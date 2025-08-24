import {
  Commitment,
  Connection,
  Finality,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
  TransactionMessage,
  VersionedTransaction
} from "@solana/web3.js";
import { Program, Provider } from "@coral-xyz/anchor";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  NATIVE_MINT
} from "@solana/spl-token";
import { PumpSwap, IDL } from "./IDL/index";
import { connection, wallet_1, helius } from './constants';
import { sendNozomiTx } from './nozomi/tx-submission';
import { sendBundle } from './jito';
import {
  getBuyTokenAmount,
  calculateWithSlippageBuy,
  // getPumpSwapPool,
  // getPoolsWithPrices,
  getCoinCreatorVaultAuthorityPda,
  getCoinCreatorVaultAtaPda,
  userVolumeAccumulatorPda,
  globalVolumeAccumulatorPda,
} from "./pool";
import { getSPLBalance } from "./utils";
import { PumpAmmSdk } from "@pump-fun/pump-swap-sdk";

// Define static public keys
const PUMP_AMM_PROGRAM_ID: PublicKey = new PublicKey('pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA');
const ASSOCIATED_TOKEN_PROGRAM_ID: PublicKey = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const TOKEN_PROGRAM_ID: PublicKey = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const WSOL_TOKEN_ACCOUNT: PublicKey = new PublicKey('So11111111111111111111111111111111111111112');
const global = new PublicKey('ADyA8hdefvWN2dbGGWFotbzWxrAvLW83WG6QCVXvJKqw');
const eventAuthority = new PublicKey('GS4CU59F31iL7aR2Q8zVS8DRrcRnXX1yjQ66TqNVQnaR');
const feeRecipient = new PublicKey('62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV');
const feeRecipientAta = new PublicKey('94qWNrtmfn42h3ZjUZwWvK1MEo9uVmmrBPd2hpNjYDjb');
const BUY_DISCRIMINATOR: Uint8Array = new Uint8Array([102, 6, 61, 18, 1, 218, 235, 234]);
const SELL_DISCRIMINATOR: Uint8Array = new Uint8Array([51, 230, 133, 164, 1, 127, 131, 173]);


export const DEFAULT_DECIMALS = 6;

export class PumpSwapSDK {
  public program: Program<PumpSwap>;
  public connection: Connection;
  constructor() {
    // this.program = new Program<PumpSwap>(IDL as PumpSwap, provider);
    // this.connection = this.program.provider.connection;
  }
  public async buy(mint: PublicKey, poolId: PublicKey, solToBuy: number,
    user: PublicKey = wallet_1.publicKey) {
    const slippage = 0.5; // Default: 50%
    const bought_token_amount = await getBuyTokenAmount(BigInt(solToBuy * LAMPORTS_PER_SOL), poolId);
    // logger.info(
    //   {
    //     status:`finding pumpswap pool for ${mint}`
    //   }
    // )
    // const pool = await getPumpSwapPool(mint)
    const pumpswap_buy_tx = await this.createBuyInstruction(poolId, user, mint, bought_token_amount.pool.coinCreator, bought_token_amount.amount_to_be_purchased, BigInt(Math.floor(solToBuy * (1 + slippage) * LAMPORTS_PER_SOL)));
    const ata = getAssociatedTokenAddressSync(mint, user);
    const ix_list: any[] = [
      ...[
        ComputeBudgetProgram.setComputeUnitLimit({
          units: 700000,
        }),
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 696969
        })
      ],

      createAssociatedTokenAccountIdempotentInstruction(
        wallet_1.publicKey,
        ata,
        wallet_1.publicKey,
        mint
      ),
      pumpswap_buy_tx
    ]

    const latestBlockhash = await connection.getLatestBlockhash();

    const messageV0 = new TransactionMessage({
      payerKey: wallet_1.publicKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: ix_list,
    }).compileToV0Message();
    const transaction = new VersionedTransaction(messageV0);
    transaction.sign([wallet_1]);
    // three different ways to send a transaction
    //sendNozomiTx(ix_list, wallet_1, latestBlockhash, "PumpSwap", "buy");
    //sendBundle(false, latestBlockhash.blockhash, transaction, pool, wallet_1)
    console.log("sending transaction to helius");
    const transactionSignature = await helius.rpc.sendTransaction(transaction);
    console.log(`Successful buy: ${transactionSignature}`);
  }

  public async sell_exactAmount(mint: PublicKey, poolId: PublicKey, coin_creator: PublicKey, tokenAmount: number,
    user: PublicKey = wallet_1.publicKey) {
    const sell_token_amount = tokenAmount;
    // logger.info(
    //   {
    //     status:`finding pumpswap pool for ${mint}`
    //   }
    // )
    // const pool = await getPumpSwapPool(mint);
    const pumpswap_buy_tx = await this.createSellInstruction(poolId, user, mint, coin_creator, BigInt(Math.floor(sell_token_amount * 10 ** 6)), BigInt(0));
    const ata = getAssociatedTokenAddressSync(mint, user);
    const ix_list: any[] = [
      ...[
        ComputeBudgetProgram.setComputeUnitLimit({
          units: 100000,
        }),
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 696969
        })
      ],

      createAssociatedTokenAccountIdempotentInstruction(
        wallet_1.publicKey,
        ata,
        wallet_1.publicKey,
        mint
      ),
      pumpswap_buy_tx
    ]

    const latestBlockhash = await connection.getLatestBlockhash();
    const messageV0 = new TransactionMessage({
      payerKey: wallet_1.publicKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: ix_list,
    }).compileToV0Message();
    const transaction = new VersionedTransaction(messageV0);
    transaction.sign([wallet_1]);
    // three different ways to send a transaction
    //sendNozomiTx(ix_list, wallet_1, latestBlockhash, "PumpSwap", "sell");
    //sendBundle(false, latestBlockhash.blockhash, transaction, pool, wallet_1)
    console.log("sending transaction to helius");
    const transactionSignature = await helius.rpc.sendTransaction(transaction);
    console.log(`Successful sell: ${transactionSignature}`);
  }
  public async sell_percentage(mint: PublicKey, poolId: PublicKey, coin_creator: PublicKey, user: PublicKey = wallet_1.publicKey, percentage_to_sell: number) {
    const holding_token_amount = await getSPLBalance(connection, mint, user);
    const sell_token_amount = percentage_to_sell * holding_token_amount;
    // logger.info(
    //   {
    //     status:`finding pumpswap pool for ${mint}`
    //   }
    // )
    // const pool = await getPumpSwapPool(mint);
    const pumpswap_buy_tx = await this.createSellInstruction(poolId, user, mint, coin_creator, BigInt(Math.floor(sell_token_amount * 10 ** 6)), BigInt(0));
    const ata = getAssociatedTokenAddressSync(mint, user);
    const ix_list: any[] = [
      ...[
        ComputeBudgetProgram.setComputeUnitLimit({
          units: 100000,
        }),
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 696969
        })
      ],

      createAssociatedTokenAccountIdempotentInstruction(
        wallet_1.publicKey,
        ata,
        wallet_1.publicKey,
        mint
      ),
      pumpswap_buy_tx
    ]

    const latestBlockhash = await connection.getLatestBlockhash();
    const messageV0 = new TransactionMessage({
      payerKey: wallet_1.publicKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: ix_list,
    }).compileToV0Message();
    const transaction = new VersionedTransaction(messageV0);
    transaction.sign([wallet_1]);
    // three different ways to send a transaction
    //sendNozomiTx(ix_list, wallet_1, latestBlockhash, "PumpSwap", "sell");
    //sendBundle(false, latestBlockhash.blockhash, transaction, pool, wallet_1)
    console.log("sending transaction to helius");
    const transactionSignature = await helius.rpc.sendTransaction(transaction);
    console.log(`Successful sell: ${transactionSignature}`);
  }
  async createBuyInstruction(
    poolId: PublicKey,
    user: PublicKey,
    mint: PublicKey,
    coinCreator: PublicKey,
    baseAmountOut: bigint, // Use bigint for u64
    maxQuoteAmountIn: bigint // Use bigint for u64
  ): Promise<TransactionInstruction> {


    const pumpAmmSdk = new PumpAmmSdk(connection);
    const poolKey = new PublicKey(poolId);
    const swapState = await pumpAmmSdk.swapSolanaState(poolKey, user);
    const { globalConfig, pool, poolBaseAmount, poolQuoteAmount } = swapState;
    const baseMint = pool.baseMint;
    const qouteMint = pool.quoteMint;
    // Compute associated token account addresses
    const userBaseTokenAccount = await getAssociatedTokenAddress(baseMint, user);
    const userQuoteTokenAccount = await getAssociatedTokenAddress(qouteMint, user);
    const poolBaseTokenAccount = await getAssociatedTokenAddress(baseMint, poolId, true);

    const poolQuoteTokenAccount = await getAssociatedTokenAddress(qouteMint, poolId, true);

    // const pool_detail = await getPoolsWithPrices(mint);
    const coin_creator_vault_authority_data = getCoinCreatorVaultAuthorityPda(coinCreator, PUMP_AMM_PROGRAM_ID);
    console.log("coin_creator_vault_authority: ", coin_creator_vault_authority_data[0].toBase58());
    const coin_creator_vault_authority = coin_creator_vault_authority_data[0];
    const coin_creator_vault_ata_data = getCoinCreatorVaultAtaPda(coin_creator_vault_authority, TOKEN_PROGRAM_ID, NATIVE_MINT);
    console.log("coin_creator_vault_ata: ", coin_creator_vault_ata_data[0].toBase58());
    const coin_creator_vault_ata = coin_creator_vault_ata_data[0];
    const global_volume_accumulator = globalVolumeAccumulatorPda(PUMP_AMM_PROGRAM_ID);
    const user_volume_accumulator = userVolumeAccumulatorPda(user, PUMP_AMM_PROGRAM_ID);
    console.log("global_volume_accumulator: ", global_volume_accumulator[0].toBase58());
    console.log("user_volume_accumulator: ", user_volume_accumulator[0].toBase58());
    // Define the accounts for the instruction
    const accounts = [
      { pubkey: poolId, isSigner: false, isWritable: false }, // pool_id (readonly)
      { pubkey: user, isSigner: true, isWritable: true }, // user (signer)
      { pubkey: global, isSigner: false, isWritable: false }, // global (readonly)
      { pubkey: mint, isSigner: false, isWritable: false }, // mint (readonly)
      { pubkey: WSOL_TOKEN_ACCOUNT, isSigner: false, isWritable: false }, // WSOL_TOKEN_ACCOUNT (readonly)
      { pubkey: userBaseTokenAccount, isSigner: false, isWritable: true }, // user_base_token_account
      { pubkey: userQuoteTokenAccount, isSigner: false, isWritable: true }, // user_quote_token_account
      { pubkey: poolBaseTokenAccount, isSigner: false, isWritable: true }, // pool_base_token_account
      { pubkey: poolQuoteTokenAccount, isSigner: false, isWritable: true }, // pool_quote_token_account
      { pubkey: feeRecipient, isSigner: false, isWritable: false }, // fee_recipient (readonly)
      { pubkey: feeRecipientAta, isSigner: false, isWritable: true }, // fee_recipient_ata
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // TOKEN_PROGRAM_ID (readonly)
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // TOKEN_PROGRAM_ID (readonly, duplicated as in Rust)
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System Program (readonly)
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // ASSOCIATED_TOKEN_PROGRAM_ID (readonly)
      { pubkey: eventAuthority, isSigner: false, isWritable: false }, // event_authority (readonly)
      { pubkey: PUMP_AMM_PROGRAM_ID, isSigner: false, isWritable: false }, // PUMP_AMM_PROGRAM_ID (readonly)
      { pubkey: coin_creator_vault_ata, isSigner: false, isWritable: true }, // coin_creator_vault_ata (writable)
      { pubkey: coin_creator_vault_authority, isSigner: false, isWritable: false }, // coin_creator_vault_authority (readonly)
      { pubkey: global_volume_accumulator, isSigner: false, isWritable: true }, // global_volume_accumulator (writable)
      { pubkey: user_volume_accumulator, isSigner: false, isWritable: true }, // user_volume_accumulator (writable)
    ];

    // Pack the instruction data: discriminator (8 bytes) + base_amount_in (8 bytes) + min_quote_amount_out (8 bytes)
    const data = Buffer.alloc(8 + 8 + 8); // 24 bytes total
    data.set(BUY_DISCRIMINATOR, 0);
    data.writeBigUInt64LE(BigInt(baseAmountOut), 8); // Write base_amount_in as little-endian u64
    data.writeBigUInt64LE(BigInt(maxQuoteAmountIn), 16); // Write min_quote_amount_out as little-endian u64

    // Create the transaction instruction
    return new TransactionInstruction({
      keys: accounts.map(({ pubkey, isSigner, isWritable }) => ({
        pubkey: Array.isArray(pubkey) ? pubkey[0] : pubkey,
        isSigner,
        isWritable,
      })),
      programId: PUMP_AMM_PROGRAM_ID,
      data: data,
    });
  }

  async createSellInstruction(
    poolId: PublicKey,
    user: PublicKey,
    mint: PublicKey,
    coin_creator: PublicKey,
    baseAmountIn: bigint, // Use bigint for u64
    minQuoteAmountOut: bigint // Use bigint for u64
  ): Promise<TransactionInstruction> {
    // Compute associated token account addresses
    const userBaseTokenAccount = await getAssociatedTokenAddress(mint, user);
    const userQuoteTokenAccount = await getAssociatedTokenAddress(WSOL_TOKEN_ACCOUNT, user);
    const poolBaseTokenAccount = await getAssociatedTokenAddress(mint, poolId, true);
    const poolQuoteTokenAccount = await getAssociatedTokenAddress(WSOL_TOKEN_ACCOUNT, poolId, true);

    // const pool_detail = await getPoolsWithPrices(mint);
    const coin_creator_vault_authority_data = getCoinCreatorVaultAuthorityPda(coin_creator, PUMP_AMM_PROGRAM_ID);
    console.log("coin_creator_vault_authority: ", coin_creator_vault_authority_data[0].toBase58());
    const coin_creator_vault_authority = coin_creator_vault_authority_data[0];
    const coin_creator_vault_ata_data = getCoinCreatorVaultAtaPda(coin_creator_vault_authority, TOKEN_PROGRAM_ID, NATIVE_MINT);
    console.log("coin_creator_vault_ata: ", coin_creator_vault_ata_data[0].toBase58());
    const coin_creator_vault_ata = coin_creator_vault_ata_data[0];
    const global_volume_accumulator = globalVolumeAccumulatorPda(PUMP_AMM_PROGRAM_ID);
    const user_volume_accumulator = userVolumeAccumulatorPda(user, PUMP_AMM_PROGRAM_ID);
    console.log("global_volume_accumulator: ", global_volume_accumulator[0].toBase58());
    console.log("user_volume_accumulator: ", user_volume_accumulator[0].toBase58());
    // Define the accounts for the instruction
    const accounts = [
      { pubkey: poolId, isSigner: false, isWritable: false }, // pool_id (readonly)
      { pubkey: user, isSigner: true, isWritable: true }, // user (signer)
      { pubkey: global, isSigner: false, isWritable: false }, // global (readonly)
      { pubkey: mint, isSigner: false, isWritable: false }, // mint (readonly)
      { pubkey: WSOL_TOKEN_ACCOUNT, isSigner: false, isWritable: false }, // WSOL_TOKEN_ACCOUNT (readonly)
      { pubkey: userBaseTokenAccount, isSigner: false, isWritable: true }, // user_base_token_account
      { pubkey: userQuoteTokenAccount, isSigner: false, isWritable: true }, // user_quote_token_account
      { pubkey: poolBaseTokenAccount, isSigner: false, isWritable: true }, // pool_base_token_account
      { pubkey: poolQuoteTokenAccount, isSigner: false, isWritable: true }, // pool_quote_token_account
      { pubkey: feeRecipient, isSigner: false, isWritable: false }, // fee_recipient (readonly)
      { pubkey: feeRecipientAta, isSigner: false, isWritable: true }, // fee_recipient_ata
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // TOKEN_PROGRAM_ID (readonly)
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // TOKEN_PROGRAM_ID (readonly, duplicated as in Rust)
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System Program (readonly)
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // ASSOCIATED_TOKEN_PROGRAM_ID (readonly)
      { pubkey: eventAuthority, isSigner: false, isWritable: false }, // event_authority (readonly)
      { pubkey: PUMP_AMM_PROGRAM_ID, isSigner: false, isWritable: false }, // PUMP_AMM_PROGRAM_ID (readonly)
      { pubkey: coin_creator_vault_ata, isSigner: false, isWritable: true }, // coin_creator_vault_ata (writable)
      { pubkey: coin_creator_vault_authority, isSigner: false, isWritable: false }, // coin_creator_vault_authority (readonly)
      { pubkey: global_volume_accumulator, isSigner: false, isWritable: true }, // global_volume_accumulator (writable)
      { pubkey: user_volume_accumulator, isSigner: false, isWritable: true }, // user_volume_accumulator (writable)
    ];

    // Pack the instruction data: discriminator (8 bytes) + base_amount_in (8 bytes) + min_quote_amount_out (8 bytes)
    const data = Buffer.alloc(8 + 8 + 8); // 24 bytes total
    data.set(SELL_DISCRIMINATOR, 0);
    data.writeBigUInt64LE(BigInt(baseAmountIn), 8); // Write base_amount_in as little-endian u64
    data.writeBigUInt64LE(BigInt(minQuoteAmountOut), 16); // Write min_quote_amount_out as little-endian u64

    // Create the transaction instruction
    return new TransactionInstruction({
      keys: accounts.map(({ pubkey, isSigner, isWritable }) => ({
        pubkey: Array.isArray(pubkey) ? pubkey[0] : pubkey,
        isSigner,
        isWritable,
      })),
      programId: PUMP_AMM_PROGRAM_ID,
      data: data,
    });
  }
}