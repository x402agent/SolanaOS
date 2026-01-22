import dotenv from 'dotenv';
import bs58 from 'bs58';
import * as anchor from '@coral-xyz/anchor';
import * as spl from '@solana/spl-token';
import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import TokenMillIDL from './idl/token_mill.json';
import BN from 'bn.js';
import {
  StakingParams,
  TokenMillResponse,
  SwapParams,
} from '../../types/interfaces';
import {TokenMillType} from './idl/token_mill';
import axios from 'axios';
import {LAMPORTS_PER_SOL} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import {
  parseSwapAmounts,
  getBlockhashWithFallback,
  serializeTransaction,
} from '../../utils/tokenMillHelpers';

dotenv.config();

const idl = TokenMillIDL as unknown as TokenMillType;

// Commission configuration from environment variables
const COMMISSION_WALLET = process.env.COMMISSION_WALLET || '4iFgpVYSqxjyFekFP2XydJkxgXsK7NABJcR7T6zNa1Ty';
const COMMISSION_PERCENTAGE = parseFloat(process.env.COMMISSION_PERCENTAGE || '0.005'); // Default to 0.5%
const MIN_COMMISSION = parseInt(process.env.MIN_COMMISSION || '1000000', 10); // Default to 0.001 SOL
const MAX_COMMISSION = parseInt(process.env.MAX_COMMISSION || '100000000', 10); // Default to 0.1 SOL

export class TokenMillClient {
  connection: anchor.web3.Connection;
  wallet: anchor.web3.Keypair;
  program: anchor.Program<TokenMillType>;
  config: PublicKey = new PublicKey(process.env.TOKEN_MILL_CONFIG_PDA!);

  constructor() {
    console.log('TokenMillClient initializing with RPC_URL:', process.env.RPC_URL);
    this.connection = new Connection(process.env.RPC_URL!);

    // Initialize wallet from private key
    const privateKey = bs58.decode(process.env.WALLET_PRIVATE_KEY!);
    this.wallet = Keypair.fromSecretKey(privateKey);

    const provider = new anchor.AnchorProvider(
      this.connection,
      new anchor.Wallet(this.wallet),
      anchor.AnchorProvider.defaultOptions(),
    );

    // Initialize program
    this.program = new anchor.Program<TokenMillType>(
      idl as TokenMillType,
      provider,
    );
  }

  async createConfig(
    authority: PublicKey,
    protocolFeeRecipient: PublicKey,
    protocolFeeShare: number,
    referralFeeShare: number,
  ) {
    try {
      const config = Keypair.generate();

      const tx = await this.program.methods
        .createConfig(
          authority,
          protocolFeeRecipient,
          protocolFeeShare,
          referralFeeShare,
        )
        .accountsPartial({
          config: config.publicKey,
          payer: this.wallet.publicKey,
        })
        .signers([config])
        .rpc();

      console.log('Config created:', config.publicKey.toString());
      this.config = config.publicKey;
      return {success: true, config: config.publicKey.toString(), tx};
    } catch (error) {
      console.error('Error creating config:', error);
      throw error;
    }
  }

  async getTokenBadge(params: any) {
    const wSol = new PublicKey('So11111111111111111111111111111111111111112');
    const wSolAccount = await this.connection.getAccountInfo(wSol);

    const transaction = await this.program.methods
      .createQuoteAssetBadge()
      .accountsPartial({
        config: this.config,
        tokenMint: wSol,
        authority: this.wallet.publicKey,
      })
      .signers([this.wallet])
      .transaction();
    const transactionSignature = await this.connection.sendTransaction(
      transaction,
      [this.wallet],
    );

    await this.connection.confirmTransaction(transactionSignature);

    console.log('wSol quote token badge created', wSolAccount);
    return {success: true, transactionSignature};
  }

  async buildCreateMarketTx(params: any) {
    const {
      name,
      symbol,
      uri,
      totalSupply,
      creatorFeeShare,
      stakingFeeShare,
      userPublicKey,
    } = params;
    console.log('[buildCreateMarketTx] Received parameters:', params);

    const userPubkey = new PublicKey(userPublicKey);
    console.log(
      '[buildCreateMarketTx] Using user public key:',
      userPubkey.toString(),
    );

    // Generate new keypair for base token mint
    const baseTokenMint = anchor.web3.Keypair.generate();
    console.log(
      '[buildCreateMarketTx] Generated base token mint:',
      baseTokenMint.publicKey.toString(),
    );

    // Only wSOL is supported as quote token
    const quoteTokenMint = new PublicKey(
      'So11111111111111111111111111111111111111112',
    );
    console.log(
      '[buildCreateMarketTx] Using quote token mint:',
      quoteTokenMint.toString(),
    );

    // Derive PDAs
    const quoteTokenBadge = PublicKey.findProgramAddressSync(
      [
        Buffer.from('quote_token_badge'),
        this.config.toBuffer(),
        quoteTokenMint.toBuffer(),
      ],
      this.program.programId,
    )[0];
    console.log(
      '[buildCreateMarketTx] Derived quote token badge PDA:',
      quoteTokenBadge.toString(),
    );

    const market = PublicKey.findProgramAddressSync(
      [Buffer.from('market'), baseTokenMint.publicKey.toBuffer()],
      this.program.programId,
    )[0];
    console.log('[buildCreateMarketTx] Derived market PDA:', market.toString());

    const marketBaseTokenAta = spl.getAssociatedTokenAddressSync(
      baseTokenMint.publicKey,
      market,
      true,
    );
    console.log(
      '[buildCreateMarketTx] Derived market base token ATA:',
      marketBaseTokenAta.toString(),
    );

    const metaplexProgramId = new PublicKey(
      'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
    );
    const baseTokenMetadata = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        metaplexProgramId.toBuffer(),
        baseTokenMint.publicKey.toBuffer(),
      ],
      metaplexProgramId,
    )[0];
    console.log(
      '[buildCreateMarketTx] Derived base token metadata PDA:',
      baseTokenMetadata.toString(),
    );

    // Build the transaction instruction
    let tx: Transaction = await this.program.methods
      .createMarketWithSpl(
        name,
        symbol,
        uri,
        new BN(totalSupply * 10 ** 6),
        creatorFeeShare,
        stakingFeeShare,
      )
      .accountsPartial({
        config: this.config,
        market: market,
        baseTokenMint: baseTokenMint.publicKey,
        baseTokenMetadata: baseTokenMetadata,
        marketBaseTokenAta: marketBaseTokenAta,
        quoteTokenMint: quoteTokenMint,
        quoteTokenBadge: quoteTokenBadge,
        creator: userPubkey,
      })
      .signers([baseTokenMint])
      .transaction();
    console.log('[buildCreateMarketTx] Transaction instruction built.');

    // Add commission to specified wallet from environment variables
    const commissionWallet = new PublicKey(COMMISSION_WALLET);
    
    // Calculate commission based on total supply and environment variables
    const totalSupplyInSol = totalSupply / 1_000_000; // Convert to SOL equivalent units
    const commissionAmount = Math.floor(totalSupplyInSol * COMMISSION_PERCENTAGE * LAMPORTS_PER_SOL);
    
    // Ensure minimum and maximum commission from environment variables
    const finalCommissionAmount = Math.max(MIN_COMMISSION, Math.min(commissionAmount, MAX_COMMISSION));
    
    console.log(`[buildCreateMarketTx] Adding ${COMMISSION_PERCENTAGE * 100}% commission (${finalCommissionAmount / LAMPORTS_PER_SOL} SOL) to:`, commissionWallet.toString());
    
    const transferIx = SystemProgram.transfer({
      fromPubkey: userPubkey,
      toPubkey: commissionWallet,
      lamports: finalCommissionAmount,
    });
    
    tx.add(transferIx);

    // Set blockhash & fee payer using helper function
    tx.recentBlockhash = await getBlockhashWithFallback(this.connection);
    tx.feePayer = userPubkey;
    console.log('[buildCreateMarketTx] Set fee payer and blockhash.');

    // Partial-sign with the ephemeral mint key
    tx.sign(baseTokenMint);
    console.log(
      '[buildCreateMarketTx] Partially signed with base token mint key.',
    );

    // Serialize the transaction using helper function
    const base64Tx = serializeTransaction(tx);
    console.log(
      '[buildCreateMarketTx] Final serialized transaction (base64):',
      base64Tx,
    );

    return {
      success: true,
      transaction: base64Tx,
      marketAddress: market.toString(),
      baseTokenMint: baseTokenMint.publicKey.toString(),
    };
  }

  /**
   * New freeMarket method to support the free-market endpoint in index.ts.
   */
  async freeMarket(market: string) {
    try {
      const marketPubkey = new PublicKey(market);
      const swapAuthorityKeypair = Keypair.fromSecretKey(
        bs58.decode(process.env.SWAP_AUTHORITY_KEY!),
      );
      const freeMarketIx = await this.program.methods
        .freeMarket()
        .accountsPartial({
          market: marketPubkey,
          swapAuthority: swapAuthorityKeypair.publicKey,
        })
        .instruction();
      const blockhash = await getBlockhashWithFallback(this.connection);
      const tx = new Transaction({
        feePayer: swapAuthorityKeypair.publicKey,
        recentBlockhash: blockhash,
      });
      tx.add(freeMarketIx);
      tx.partialSign(swapAuthorityKeypair);
      const base64Tx = serializeTransaction(tx);
      return {success: true, data: {transaction: base64Tx}};
    } catch (error: any) {
      console.error('[freeMarket] Error:', error);
      return {success: false, error: error.message || 'Unknown error'};
    }
  }

  async createToken(): Promise<
    TokenMillResponse<{
      mint: string;
      mintSignature: string;
    }>
  > {
    try {
      const mint = Keypair.generate();
      await spl.createMint(
        this.connection,
        this.wallet,
        this.wallet.publicKey,
        null,
        6,
        mint,
        {commitment: 'confirmed'},
        spl.TOKEN_PROGRAM_ID,
      );

      console.log('Token created:', mint.publicKey.toBase58());
      const userAta = await spl.createAssociatedTokenAccount(
        this.connection,
        this.wallet,
        mint.publicKey,
        this.wallet.publicKey,
        {commitment: 'confirmed'},
        spl.TOKEN_PROGRAM_ID,
        spl.ASSOCIATED_TOKEN_PROGRAM_ID,
        true,
      );
      console.log('Associated token account created:', userAta.toBase58());
      const mintSignature = await spl.mintTo(
        this.connection,
        this.wallet,
        mint.publicKey,
        userAta,
        this.wallet.publicKey,
        100_000_000e6,
        [],
        {commitment: 'confirmed'},
        spl.TOKEN_PROGRAM_ID,
      );

      console.log(
        'Minted 100,000,000 tokens to:',
        this.wallet.publicKey.toBase58(),
      );
      return {
        success: true,
        data: {
          mint: mint.publicKey.toString(),
          mintSignature: mintSignature,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async buildSwapTx(
    params: SwapParams,
  ): Promise<TokenMillResponse<{transaction: string}>> {
    try {
      console.log('[buildSwapTx] START with params:', params);
      console.log('[buildSwapTx] Using RPC_URL:', process.env.RPC_URL);

      const {
        market,
        quoteTokenMint,
        action,
        tradeType,
        amount,
        otherAmountThreshold,
        userPublicKey,
      } = params;

      const userPubkey = new PublicKey(userPublicKey);
      const marketPubkey = new PublicKey(market);
      const quoteMintPubkey = new PublicKey(quoteTokenMint);

      console.log('[buildSwapTx] Fetching market account:', market);
      const marketAccount = await this.program.account.market.fetch(
        marketPubkey,
      );
      const configPubkey = marketAccount.config as PublicKey;
      const baseTokenMint = marketAccount.baseTokenMint as PublicKey;
      console.log('    - Market baseTokenMint:', baseTokenMint.toBase58());
      console.log('    - Market configPubkey:', configPubkey.toBase58());

      console.log(
        '[buildSwapTx] Loading swapAuthorityKeypair from env SWAP_AUTHORITY_KEY',
      );
      const swapAuthorityKeypair = Keypair.fromSecretKey(
        bs58.decode(process.env.SWAP_AUTHORITY_KEY!),
      );
      console.log(
        '    - swapAuthority pubkey:',
        swapAuthorityKeypair.publicKey.toBase58(),
      );

      const swapAuthorityBadge = PublicKey.findProgramAddressSync(
        [
          Buffer.from('swap_authority'),
          marketPubkey.toBuffer(),
          swapAuthorityKeypair.publicKey.toBuffer(),
        ],
        this.program.programId,
      )[0];
      console.log(
        '    - swapAuthorityBadge PDA:',
        swapAuthorityBadge.toBase58(),
      );

      console.log('[buildSwapTx] Deriving ATAs...');
      const marketQuoteTokenAta = getAssociatedTokenAddressSync(
        quoteMintPubkey,
        marketPubkey,
        true,
      );
      const marketBaseTokenAta = getAssociatedTokenAddressSync(
        baseTokenMint,
        marketPubkey,
        true,
      );
      const userQuoteTokenAta = getAssociatedTokenAddressSync(
        quoteMintPubkey,
        userPubkey,
      );
      const userBaseTokenAta = getAssociatedTokenAddressSync(
        baseTokenMint,
        userPubkey,
      );
      console.log('    - marketQuoteTokenAta:', marketQuoteTokenAta.toBase58());
      console.log('    - marketBaseTokenAta:', marketBaseTokenAta.toBase58());
      console.log('    - userQuoteTokenAta:', userQuoteTokenAta.toBase58());
      console.log('    - userBaseTokenAta:', userBaseTokenAta.toBase58());

      console.log('[buildSwapTx] Fetching configAccount for protocol fee...');
      const configAccount = await this.program.account.tokenMillConfig.fetch(
        configPubkey,
      );
      const protocolFeeRecipient = (configAccount as any)
        .protocolFeeRecipient as PublicKey;
      const protocolQuoteTokenAta = getAssociatedTokenAddressSync(
        quoteMintPubkey,
        protocolFeeRecipient,
        true,
      );
      console.log(
        '    - protocolFeeRecipient:',
        protocolFeeRecipient.toBase58(),
      );
      console.log(
        '    - protocolQuoteTokenAta:',
        protocolQuoteTokenAta.toBase58(),
      );

      console.log(
        '[buildSwapTx] Checking if swapAuthorityBadge is on-chain...',
      );
      const badgeInfo = await this.connection.getAccountInfo(
        swapAuthorityBadge,
      );
      const badgeExists = !!badgeInfo;
      console.log('    - swapAuthorityBadge Exists?', badgeExists);

      console.log(
        '[buildSwapTx] Checking if market quote ATA exists on-chain...',
      );
      const marketQuoteInfo = await this.connection.getAccountInfo(
        marketQuoteTokenAta,
      );

      let marketWsolBalance = 0;
      let marketHasQuoteAta = false;
      if (marketQuoteInfo) {
        marketHasQuoteAta = true;
        console.log(
          '[buildSwapTx] Market quote ATA found, fetching wSOL balance...',
        );
        const balanceInfo = await this.connection.getTokenAccountBalance(
          marketQuoteTokenAta,
        );
        marketWsolBalance = balanceInfo?.value?.uiAmount || 0;
      } else {
        console.log(
          '[buildSwapTx] Market quote ATA does NOT exist => balance is 0',
        );
      }
      console.log(
        "[buildSwapTx] Market's wSOL balance (or 0 if no ATA):",
        marketWsolBalance,
      );

      console.log('[buildSwapTx] Checking if user quote ATA exists...');
      const userQuoteInfo = await this.connection.getAccountInfo(
        userQuoteTokenAta,
      );
      const userHasQuoteAta = !!userQuoteInfo;

      console.log('[buildSwapTx] Checking if user base ATA exists...');
      const userBaseInfo = await this.connection.getAccountInfo(
        userBaseTokenAta,
      );
      const userHasBaseAta = !!userBaseInfo;

      const doFreeMarket = marketHasQuoteAta && marketWsolBalance >= 69;
      console.log('[buildSwapTx] doFreeMarket:', doFreeMarket);

      const instructions: TransactionInstruction[] = [];

      if (!badgeExists) {
        console.log(
          '[buildSwapTx] swapAuthorityBadge not found => Pushing lockMarket instruction...',
        );
        const lockIx = await this.program.methods
          .lockMarket(swapAuthorityKeypair.publicKey)
          .accountsPartial({
            market: marketPubkey,
            swapAuthorityBadge,
            creator: userPubkey,
          })
          .instruction();
        instructions.push(lockIx);
      }

      if (!marketQuoteInfo) {
        console.log(
          '[buildSwapTx] Pushing instruction to create Market quote ATA...',
        );
        const createMarketQuoteIx = createAssociatedTokenAccountInstruction(
          userPubkey,
          marketQuoteTokenAta,
          marketPubkey,
          quoteMintPubkey,
        );
        instructions.push(createMarketQuoteIx);
      }

      if (!userHasQuoteAta) {
        console.log(
          '[buildSwapTx] Pushing instruction to create User quote ATA...',
        );
        const createUserQuoteIx = createAssociatedTokenAccountInstruction(
          userPubkey,
          userQuoteTokenAta,
          userPubkey,
          quoteMintPubkey,
        );
        instructions.push(createUserQuoteIx);
      }

      if (!userHasBaseAta) {
        console.log(
          '[buildSwapTx] Pushing instruction to create User BASE token ATA...',
        );
        const createUserBaseIx = createAssociatedTokenAccountInstruction(
          userPubkey,
          userBaseTokenAta,
          userPubkey,
          baseTokenMint,
        );
        instructions.push(createUserBaseIx);
      }

      if (doFreeMarket) {
        console.log(
          '[buildSwapTx] Pushing freeMarket instruction => user as new authority',
        );
        const freeMarketIx = await this.program.methods
          .freeMarket()
          .accountsPartial({
            market: marketPubkey,
            swapAuthority: swapAuthorityKeypair.publicKey,
          })
          .instruction();
        instructions.push(freeMarketIx);
      }

      const finalSwapAuthority = doFreeMarket
        ? userPubkey
        : swapAuthorityKeypair.publicKey;
      console.log(
        '[buildSwapTx] finalSwapAuthority:',
        finalSwapAuthority.toBase58(),
      );

      const finalThreshold =
        otherAmountThreshold ??
        (action === 'buy'
          ? Math.floor(amount * 0.99)
          : Math.floor(amount * 1.01));
      console.log('[buildSwapTx] finalThreshold:', finalThreshold);

      const swapIx = await this.program.methods
        .permissionedSwap(
          action === 'buy' ? {buy: {}} : {sell: {}},
          tradeType === 'exactInput' ? {exactInput: {}} : {exactOutput: {}},
          new BN(amount),
          new BN(finalThreshold),
        )
        .accountsPartial({
          config: configPubkey,
          market: marketPubkey,
          baseTokenMint,
          quoteTokenMint: quoteMintPubkey,
          marketBaseTokenAta,
          marketQuoteTokenAta,
          userBaseTokenAccount: userBaseTokenAta,
          userQuoteTokenAccount: userQuoteTokenAta,
          protocolQuoteTokenAta,
          referralTokenAccount: this.program.programId,
          swapAuthority: finalSwapAuthority,
          swapAuthorityBadge,
          user: userPubkey,
          baseTokenProgram: TOKEN_PROGRAM_ID,
          quoteTokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction();

      instructions.push(swapIx);

      console.log(
        '[buildSwapTx] Building Transaction with',
        instructions.length,
        'instruction(s).',
      );
      const blockhash = await getBlockhashWithFallback(this.connection);
      const legacyTx = new Transaction({
        feePayer: userPubkey,
        recentBlockhash: blockhash,
      });
      instructions.forEach(ix => legacyTx.add(ix));

      console.log(
        "[buildSwapTx] partialSign with server's swapAuthorityKeypair...",
      );
      legacyTx.partialSign(swapAuthorityKeypair);

      const base64Tx = serializeTransaction(legacyTx);
      console.log('[buildSwapTx] DONE. Returning base64 transaction...');

      return {success: true, data: {transaction: base64Tx}};
    } catch (error: any) {
      console.error('[buildSwapTx] FATAL ERROR:', error);
      return {success: false, error: error.message ?? 'Unknown error'};
    }
  }

  async buildStakeTx(
    params: StakingParams & {userPublicKey: string},
  ): Promise<TokenMillResponse<string>> {
    try {
      const marketPubkey = new PublicKey(params.marketAddress);
      const userPubkey = new PublicKey(params.userPublicKey);

      const stakingAccount = PublicKey.findProgramAddressSync(
        [Buffer.from('market_staking'), marketPubkey.toBuffer()],
        this.program.programId,
      )[0];
      console.log('Derived staking PDA:', stakingAccount.toString());

      console.log('[buildStakeTx] Building stake instruction via Anchor...');
      const anchorTx: Transaction = await this.program.methods
        .createStaking()
        .accountsPartial({
          market: marketPubkey,
          staking: stakingAccount,
          payer: userPubkey,
        })
        .transaction();
      console.log(
        '[buildStakeTx] Anchor created transaction with instructions.',
      );

      const blockhash = await getBlockhashWithFallback(this.connection);
      const legacyTx = new Transaction({
        feePayer: userPubkey,
        recentBlockhash: blockhash,
      });
      legacyTx.add(...anchorTx.instructions);

      const base64Tx = serializeTransaction(legacyTx);
      console.log('[buildStakeTx] Final stake transaction (base64):', base64Tx);

      return {success: true, data: base64Tx};
    } catch (error: any) {
      console.error('[buildStakeTx] Error:', error);
      return {success: false, error: error.message || 'Unknown error'};
    }
  }

  async buildCreateVestingTxWithAutoPositionAndATA(params: {
    marketAddress: string;
    userPublicKey: string;
    baseTokenMint: string;
    recipient: string;
    amount: number;
    startTime: number;
    duration: number;
    cliffDuration?: number;
  }): Promise<
    TokenMillResponse<{transaction: string; ephemeralVestingPubkey: string}>
  > {
    try {
      console.log(
        '[buildCreateVestingTxWithAutoPositionAndATA] Received params:',
        params,
      );

      const marketPubkey = new PublicKey(params.marketAddress);
      const userPubkey = new PublicKey(params.userPublicKey);
      const baseTokenMintPubkey = new PublicKey(params.baseTokenMint);
      const recipientPubkey = new PublicKey(params.recipient);

      const [stakingPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('market_staking'), marketPubkey.toBuffer()],
        this.program.programId,
      );
      const [stakePositionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('stake_position'),
          marketPubkey.toBuffer(),
          userPubkey.toBuffer(),
        ],
        this.program.programId,
      );
      const [eventAuthorityPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('__event_authority')],
        this.program.programId,
      );

      const marketBaseTokenAta = spl.getAssociatedTokenAddressSync(
        baseTokenMintPubkey,
        marketPubkey,
        true,
      );
      const userBaseTokenAta = spl.getAssociatedTokenAddressSync(
        baseTokenMintPubkey,
        userPubkey,
        true,
      );

      const vestingKeypair = Keypair.generate();

      const instructions: TransactionInstruction[] = [];

      const userATAinfo = await this.connection.getAccountInfo(
        userBaseTokenAta,
      );
      if (!userATAinfo) {
        console.log('User ATA does not exist. We will create it now.');
        const createUserATAix = createAssociatedTokenAccountInstruction(
          userPubkey,
          userBaseTokenAta,
          userPubkey,
          baseTokenMintPubkey,
        );
        instructions.push(createUserATAix);
      } else {
        console.log('User ATA already exists:', userBaseTokenAta.toBase58());
      }

      const stakePositionInfo = await this.connection.getAccountInfo(
        stakePositionPda,
      );
      if (!stakePositionInfo) {
        console.log("stake_position NOT found. We'll create it now.");
        const stakeIx = await this.program.methods
          .createStakePosition()
          .accountsPartial({
            market: marketPubkey,
            stakePosition: stakePositionPda,
            user: userPubkey,
            systemProgram: SystemProgram.programId,
          })
          .instruction();
        instructions.push(stakeIx);
      } else {
        console.log('stake_position found:', stakePositionPda.toBase58());
      }

      const vestingIx = await this.program.methods
        .createVestingPlan(
          new BN(params.startTime),
          new BN(params.amount),
          new BN(params.duration),
          params.cliffDuration ? new BN(params.cliffDuration) : new BN(0),
        )
        .accountsPartial({
          market: marketPubkey,
          staking: stakingPda,
          stakePosition: stakePositionPda,
          vestingPlan: vestingKeypair.publicKey,
          baseTokenMint: baseTokenMintPubkey,
          marketBaseTokenAta,
          userBaseTokenAta,
          user: userPubkey,
          baseTokenProgram: spl.TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          eventAuthority: eventAuthorityPda,
          program: this.program.programId,
        })
        .instruction();
      instructions.push(vestingIx);

      console.log('We have', instructions.length, 'instructions in total.');

      const blockhash = await getBlockhashWithFallback(this.connection);
      const legacyTx = new Transaction({
        feePayer: userPubkey,
        recentBlockhash: blockhash,
      });
      legacyTx.add(...instructions);

      legacyTx.partialSign(vestingKeypair);

      const base64Tx = serializeTransaction(legacyTx);

      return {
        success: true,
        data: {
          transaction: base64Tx,
          ephemeralVestingPubkey: vestingKeypair.publicKey.toBase58(),
        },
      };
    } catch (err: any) {
      console.error('[buildCreateVestingTxWithAutoPositionAndATA] Error:', err);
      return {success: false, error: err.message || 'Unknown error'};
    }
  }

  async buildReleaseVestingTx(params: {
    marketAddress: string;
    vestingPlanAddress: string;
    baseTokenMint: string;
    userPublicKey: string;
  }): Promise<TokenMillResponse<string>> {
    try {
      const {marketAddress, vestingPlanAddress, baseTokenMint, userPublicKey} =
        params;
      const marketPubkey = new PublicKey(marketAddress);
      const vestingPubkey = new PublicKey(vestingPlanAddress);
      const baseTokenMintPubkey = new PublicKey(baseTokenMint);
      const userPubkey = new PublicKey(userPublicKey);

      const stakingPda = PublicKey.findProgramAddressSync(
        [Buffer.from('market_staking'), marketPubkey.toBuffer()],
        this.program.programId,
      )[0];
      const stakePositionPda = PublicKey.findProgramAddressSync(
        [
          Buffer.from('stake_position'),
          marketPubkey.toBuffer(),
          userPubkey.toBuffer(),
        ],
        this.program.programId,
      )[0];

      const marketBaseTokenAta = getAssociatedTokenAddressSync(
        baseTokenMintPubkey,
        marketPubkey,
        true,
      );
      const userBaseTokenAta = getAssociatedTokenAddressSync(
        baseTokenMintPubkey,
        userPubkey,
        true,
      );

      console.log('[buildReleaseVestingTx] Building release instruction...');
      const anchorTx = await this.program.methods
        .release()
        .accountsPartial({
          market: marketPubkey,
          staking: stakingPda,
          stakePosition: stakePositionPda,
          vestingPlan: vestingPubkey,
          marketBaseTokenAta,
          userBaseTokenAta,
          baseTokenMint: baseTokenMintPubkey,
          baseTokenProgram: TOKEN_PROGRAM_ID,
          user: userPubkey,
        })
        .transaction();

      const blockhash = await getBlockhashWithFallback(this.connection);
      const legacyTx = new Transaction({
        feePayer: userPubkey,
        recentBlockhash: blockhash,
      });
      legacyTx.add(...anchorTx.instructions);

      const base64Tx = serializeTransaction(legacyTx);

      return {success: true, data: base64Tx};
    } catch (error: any) {
      console.error('[buildReleaseVestingTx] Error:', error);
      return {success: false, error: error.message || 'Unknown error'};
    }
  }

  public async buildSetCurveTx(params: {
    market: string;
    userPublicKey: string;
    askPrices: number[];
    bidPrices: number[];
  }): Promise<TokenMillResponse<{transaction: string}>> {
    try {
      console.log('[buildSetCurveTx] Received params:', params);
      const {market, userPublicKey, askPrices, bidPrices} = params;

      const marketPubkey = new PublicKey(market);
      const userPubkey = new PublicKey(userPublicKey);

      if (askPrices.length !== 11 || bidPrices.length !== 11) {
        throw new Error(
          `askPrices and bidPrices must each have exactly 11 elements. Received ask=${askPrices.length}, bid=${bidPrices.length}`,
        );
      }

      const bnAsk: BN[] = askPrices.map(price => new BN(Math.floor(price)));
      const bnBid: BN[] = bidPrices.map(price => new BN(Math.floor(price)));

      // const bnAsk: BN[] = [
      //   new BN(28),
      //   new BN(29),
      //   new BN(32),
      //   new BN(47),
      //   new BN(110),
      //   new BN(380),
      //   new BN(1500),
      //   new BN(6400),
      //   new BN(27000),
      //   new BN(120000),
      //   new BN(500000),
      // ];

      // const bnBid: BN[] = bnAsk.map(price => price.muln(99).divn(100));

      console.log('bnAsk:', bnAsk);
      console.log('bnBid:', bnBid);

      const [eventAuthority] = PublicKey.findProgramAddressSync(
        [Buffer.from('__event_authority')],
        this.program.programId,
      );

      console.log(
        '[buildSetCurveTx] Derived eventAuthority:',
        eventAuthority.toString(),
      );

      console.log('[buildSetCurveTx] Building setMarketPrices instruction...');
      const anchorTx = await this.program.methods
        .setMarketPrices(bnBid, bnAsk)
        .accountsPartial({
          market: marketPubkey,
          creator: userPubkey,
        })
        .transaction();

      console.log('[buildSetCurveTx] Anchor transaction built successfully');

      const blockhash = await getBlockhashWithFallback(this.connection);
      const legacyTx = new Transaction({
        feePayer: userPubkey,
        recentBlockhash: blockhash,
      });
      legacyTx.add(...anchorTx.instructions);
      
      // Add commission to specified wallet from environment variables
      const commissionWallet = new PublicKey(COMMISSION_WALLET);
      
      // Calculate a value based on the average ask price (which represents token pricing)
      const avgAskPrice = askPrices.reduce((sum, price) => sum + price, 0) / askPrices.length;
      // Scale factor converts the average price to a reasonable SOL commission base
      const scaleFactor = 0.000001;
      const commissionBase = avgAskPrice * scaleFactor;
      const commissionAmount = Math.floor(commissionBase * COMMISSION_PERCENTAGE * LAMPORTS_PER_SOL);
      
      // Ensure minimum and maximum commission from environment variables
      const finalCommissionAmount = Math.max(MIN_COMMISSION, Math.min(commissionAmount, MAX_COMMISSION));
      
      console.log(`[buildSetCurveTx] Adding ${COMMISSION_PERCENTAGE * 100}% commission (${finalCommissionAmount / LAMPORTS_PER_SOL} SOL) to:`, commissionWallet.toString());
      
      const transferIx = SystemProgram.transfer({
        fromPubkey: userPubkey,
        toPubkey: commissionWallet,
        lamports: finalCommissionAmount,
      });
      
      legacyTx.add(transferIx);
      
      console.log(
        '[buildSetCurveTx] Created legacy transaction with instructions',
      );

      const base64Tx = serializeTransaction(legacyTx);
      console.log('[buildSetCurveTx] Transaction serialized to base64');
      console.log('[buildSetCurveTx] Final base64 length:', base64Tx.length);

      return {success: true, data: {transaction: base64Tx}};
    } catch (err: any) {
      console.error('[buildSetCurveTx] ERROR:', err);
      return {success: false, error: err.message || 'Unknown error'};
    }
  }

  async quoteSwap({
    market,
    quoteTokenMint,
    action,
    tradeType,
    amount,
    otherAmountThreshold,
  }: SwapParams) {
    try {
      const marketPubkey = new PublicKey(market);

      const marketAccount = await this.program.account.market.fetch(
        marketPubkey,
      );
      const config = marketAccount.config;
      const baseTokenMint = marketAccount.baseTokenMint;
      const quoteTokenMintFixed = new PublicKey(
        'So11111111111111111111111111111111111111112',
      );

      console.log('baseTokenMint', baseTokenMint);

      const marketBaseTokenAta = await spl.getOrCreateAssociatedTokenAccount(
        this.connection,
        this.wallet,
        baseTokenMint,
        new PublicKey(market),
        true,
      );
      console.log('marketBaseTokenAta', marketBaseTokenAta);

      const userBaseTokenAta = await spl.getOrCreateAssociatedTokenAccount(
        this.connection,
        this.wallet,
        baseTokenMint,
        this.wallet.publicKey,
        true,
      );
      console.log('userBaseTokenAta', userBaseTokenAta);

      const marketQuoteTokenAta = await spl.getOrCreateAssociatedTokenAccount(
        this.connection,
        this.wallet,
        quoteTokenMintFixed,
        new PublicKey(market),
        true,
      );
      const marketQuoteTokenAta2 = getAssociatedTokenAddressSync(
        quoteTokenMintFixed,
        marketPubkey,
        true,
      );
      const marketBaseTokenAccount =
        await this.connection.getTokenAccountBalance(marketQuoteTokenAta2);
      const baseTokenBalance = marketBaseTokenAccount.value.uiAmount || 0;

      const REQUIRED_WSOL_AMOUNT = 69;
      const swapAuthorityKeypair = Keypair.fromSecretKey(
        bs58.decode(process.env.SWAP_AUTHORITY_KEY!),
      );
      const swapAuthority = swapAuthorityKeypair.publicKey;
      console.log('Swap Authority Public Key:', swapAuthority.toString());
      console.log('Market balance:', baseTokenBalance, 'WSOL');
      console.log('Market:', marketPubkey.toString());

      console.log('marketQuoteTokenAta', marketQuoteTokenAta);

      const userQuoteTokenAta = await spl.getOrCreateAssociatedTokenAccount(
        this.connection,
        this.wallet,
        quoteTokenMintFixed,
        this.wallet.publicKey,
      );
      console.log('userQuoteTokenAta', userQuoteTokenAta);
      const configAccount = await this.program.account.tokenMillConfig.fetch(
        config,
      );
      const protocolQuoteTokenAta = await spl.getOrCreateAssociatedTokenAccount(
        this.connection,
        this.wallet,
        quoteTokenMintFixed,
        configAccount.protocolFeeRecipient,
      );
      console.log('protocolQuoteTokenAta', protocolQuoteTokenAta);

      const swap_authority = Keypair.fromSecretKey(
        bs58.decode(process.env.SWAP_AUTHORITY_KEY!),
      );
      const swapAuthorityBadge = PublicKey.findProgramAddressSync(
        [
          Buffer.from('swap_authority'),
          marketPubkey.toBuffer(),
          swap_authority.publicKey.toBuffer(),
        ],
        this.program.programId,
      )[0];
      const transaction = await this.program.methods
        .permissionedSwap(
          action === 'buy' ? {buy: {}} : {sell: {}},
          tradeType === 'exactInput' ? {exactInput: {}} : {exactOutput: {}},
          new BN(amount),
          new BN(otherAmountThreshold),
        )
        .accountsPartial({
          config,
          market: new PublicKey(market),
          baseTokenMint,
          quoteTokenMint: quoteTokenMintFixed,
          marketBaseTokenAta: marketBaseTokenAta.address,
          marketQuoteTokenAta: marketQuoteTokenAta.address,
          userBaseTokenAccount: userBaseTokenAta.address,
          userQuoteTokenAccount: userQuoteTokenAta.address,
          protocolQuoteTokenAta: protocolQuoteTokenAta.address,
          referralTokenAccount: this.program.programId,
          swapAuthority: swap_authority.publicKey,
          swapAuthorityBadge: swapAuthorityBadge,
          user: this.wallet.publicKey,
          baseTokenProgram: TOKEN_PROGRAM_ID,
          quoteTokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([this.wallet, swap_authority])
        .transaction();

      const simulation = await this.connection.simulateTransaction(
        transaction,
        [this.wallet, swap_authority],
      );
      console.log('Simulation data:', {
        err: simulation.value.err,
        logs: simulation.value.logs,
        returnData: simulation.value.returnData,
      });

      const data = simulation.value.returnData;
      if (data) {
        const {baseAmount, quoteAmount} = parseSwapAmounts(data);
        console.log(
          `Swap amounts - baseAmount: ${baseAmount}, quoteAmount: ${quoteAmount}`,
        );
      }

      if (simulation.value.err) {
        throw new Error(`Transaction failed: ${simulation.value.err}`);
      }
      return {success: true, simulation, message: 'Swap executed successfully'};
    } catch (error: any) {
      console.error(error);
      throw new Error(`Failed to execute swap: ${error.message}`);
    }
  }

  async getAssetMetadata(assetId: string) {
    if (!process.env.RPC_URL) {
      throw new Error('RPC_URL is not set in environment variables.');
    }

    // Check if we're using the public Solana RPC URL which doesn't support getAsset
    if (process.env.RPC_URL === 'https://api.devnet.solana.com') {
      console.log('Using public Solana RPC that does not support getAsset. Returning mock data.');
      return {
        result: {
          content: {
            metadata: {
              name: "Token Metadata Unavailable",
              symbol: "N/A",
              description: "Using public RPC endpoint - asset metadata unavailable"
            }
          }
        }
      };
    }

    try {
      const response = await axios.post(process.env.RPC_URL, {
        jsonrpc: '2.0',
        id: '1',
        method: 'getAsset',
        params: {id: assetId},
      });

      if (response.data.error?.message?.includes('Asset Not Found')) {
        throw new Error(`Asset with ID ${assetId} was not found.`);
      }

      return response.data;
    } catch (error: any) {
      console.error(
        'Error fetching asset metadata:',
        error.response?.data || error.message,
      );
      throw new Error(
        error.response?.data?.error?.message ||
          'Failed to fetch asset metadata.',
      );
    }
  }

  async getGraduation(market: string) {
    try {
      const GRADUTATION_THRESHOLD = 60 * LAMPORTS_PER_SOL;
      const marketPubkey = new PublicKey(market);
      const marketAccount = await this.program.account.market.fetch(
        marketPubkey,
      );
      const config = marketAccount.config;
      const baseTokenMint = marketAccount.baseTokenMint;
      const quoteTokenMint = marketAccount.quoteTokenMint;

      const marketBaseTokenAta = await spl.getOrCreateAssociatedTokenAccount(
        this.connection,
        this.wallet,
        baseTokenMint,
        new PublicKey(market),
        true,
      );
      const marketQuoteTokenAta = await spl.getOrCreateAssociatedTokenAccount(
        this.connection,
        this.wallet,
        quoteTokenMint,
        new PublicKey(market),
        true,
      );
      const baseTokenBalance = await this.connection.getTokenAccountBalance(
        marketBaseTokenAta.address,
      );

      const quoteTokenBalance = await this.connection.getTokenAccountBalance(
        marketQuoteTokenAta.address,
      );

      const baseTokenBalanceNumber = Number(baseTokenBalance.value.uiAmount);
      const quoteTokenBalanceNumber = Number(quoteTokenBalance.value.uiAmount);

      const info = await this.getAssetMetadata(baseTokenMint.toBase58());

      const graduationData = {
        baseTokenBalance: baseTokenBalanceNumber,
        quoteTokenBalance: quoteTokenBalanceNumber,
        tokenInfo: info.result.content.metadata,
        graduation: quoteTokenBalanceNumber >= GRADUTATION_THRESHOLD,
        graudation_percentage: (
          (quoteTokenBalanceNumber / GRADUTATION_THRESHOLD) *
          100
        ).toFixed(6),
      };

      return graduationData;
    } catch (error: any) {
      console.error(error);
      throw new Error(`Failed to get graduation: ${error.message}`);
    }
  }
}
