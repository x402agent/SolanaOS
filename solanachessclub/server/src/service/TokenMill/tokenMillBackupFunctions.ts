import dotenv from 'dotenv';
import bs58 from 'bs58';
import * as anchor from '@coral-xyz/anchor';
import * as spl from '@solana/spl-token';
import {
  Connection,
  PublicKey,
  Keypair,
} from '@solana/web3.js';
import TokenMillIDL from './idl/token_mill.json';
import BN from 'bn.js';
import {
  StakingParams,
  VestingParams,
  TokenMillResponse,
  SwapParams,
} from '../../types/interfaces';
import {TokenMillType} from './idl/token_mill';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';

dotenv.config();
const idl = TokenMillIDL as unknown as TokenMillType;

/**
 * TokenMillClientBackup contains additional functions that are currently not used in index.ts.
 */
export class TokenMillClientBackup {
  connection: anchor.web3.Connection;
  wallet: anchor.web3.Keypair;
  program: anchor.Program<TokenMillType>;
  config: PublicKey = new PublicKey(process.env.TOKEN_MILL_CONFIG_PDA!);

  constructor() {
    this.connection = new Connection(process.env.RPC_URL!);
    const privateKey = bs58.decode(process.env.WALLET_PRIVATE_KEY!);
    this.wallet = Keypair.fromSecretKey(privateKey);
    const provider = new anchor.AnchorProvider(
      this.connection,
      new anchor.Wallet(this.wallet),
      anchor.AnchorProvider.defaultOptions(),
    );
    this.program = new anchor.Program<TokenMillType>(
      idl as TokenMillType,
      provider,
    );
  }

  /**
   * Locks a market with the given swap authority.
   */
  async lockMarket(market: PublicKey, swapAuthority: PublicKey) {
    try {
      const transaction = await this.program.methods
        .lockMarket(swapAuthority)
        .accountsPartial({
          market,
          creator: this.wallet.publicKey,
        })
        .signers([this.wallet])
        .transaction();

      const transactionSignature = await this.connection.sendTransaction(
        transaction,
        [this.wallet],
      );
      const result = await this.connection.confirmTransaction(
        transactionSignature,
      );

      if (result.value.err) {
        console.log('Market lock failed:', result.value.err);
        throw new Error(`Market lock failed: ${result.value.err}`);
      }

      console.log(
        'Market locked successfully with authority:',
        swapAuthority.toString(),
      );
      return transactionSignature;
    } catch (error: any) {
      console.error('Error locking market:', error);
      throw error;
    }
  }

  /**
   * Creates a market using the TokenMill program.
   */
  async createMarket(params: any) {
    const {name, symbol, uri, totalSupply, creatorFeeShare, stakingFeeShare} =
      params;
    console.log('Wallet:', this.wallet.publicKey.toString());
    const quoteTokenMint = new PublicKey(
      'So11111111111111111111111111111111111111112',
    );

    try {
      const baseTokenMint = Keypair.generate();

      const quoteTokenBadge = PublicKey.findProgramAddressSync(
        [
          Buffer.from('quote_token_badge'),
          this.config.toBuffer(),
          quoteTokenMint.toBuffer(),
        ],
        this.program.programId,
      )[0];

      const market = PublicKey.findProgramAddressSync(
        [Buffer.from('market'), baseTokenMint.publicKey.toBuffer()],
        this.program.programId,
      )[0];

      console.log('Market:', market.toString());
      console.log('Base Token Mint:', baseTokenMint.publicKey.toString());
      console.log('Quote Token Badge:', quoteTokenBadge.toString());

      const marketBaseTokenAta = spl.getAssociatedTokenAddressSync(
        baseTokenMint.publicKey,
        market,
        true,
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

      const tx = await this.program.methods
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
          creator: this.wallet.publicKey,
        })
        .signers([baseTokenMint, this.wallet])
        .rpc({
          commitment: 'finalized',
        });

      console.log('Market created:', market.toString());

      const swapAuthority = Keypair.fromSecretKey(
        bs58.decode(process.env.SWAP_AUTHORITY_KEY!),
      );

      const swapAuthorityBadge = PublicKey.findProgramAddressSync(
        [
          Buffer.from('swap_authority'),
          market.toBuffer(),
          swapAuthority.publicKey.toBuffer(),
        ],
        this.program.programId,
      )[0];

      const lockTX = await this.program.methods
        .lockMarket(swapAuthority.publicKey)
        .accountsPartial({
          market: market,
          swapAuthorityBadge: swapAuthorityBadge,
          creator: this.wallet.publicKey,
        })
        .signers([this.wallet])
        .transaction();

      const lockSignature = await this.connection.sendTransaction(lockTX, [
        this.wallet,
      ]);

      const lockResult = await this.connection.confirmTransaction(
        lockSignature,
      );

      if (lockResult.value.err) {
        console.log('Market lock failed:', lockResult.value.err);
        throw new Error(`Market lock failed: ${lockResult.value.err}`);
      }

      console.log(
        'Market locked successfully with authority:',
        swapAuthority.publicKey.toString(),
      );

      await this.setPrices(market);

      return {
        success: true,
        marketAddress: market.toString(),
        baseTokenMint: baseTokenMint.publicKey.toString(),
        signature: tx,
      };
    } catch (error: any) {
      console.error('Error creating market:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Sets the prices for a given market.
   */
  async setPrices(market: PublicKey) {
    const askPrices: BN[] = [
      new BN(28),
      new BN(29),
      new BN(32),
      new BN(47),
      new BN(110),
      new BN(380),
      new BN(1500),
      new BN(6400),
      new BN(27000),
      new BN(120000),
      new BN(500000),
    ];
    const bidPrices: BN[] = askPrices.map(price => price.muln(99).divn(100));

    const transaction = await this.program.methods
      .setMarketPrices(bidPrices, askPrices)
      .accountsPartial({
        market: market,
        creator: this.wallet.publicKey,
      })
      .signers([this.wallet])
      .transaction();

    const transactionSignature = await this.connection.sendTransaction(
      transaction,
      [this.wallet],
    );
    const result = await this.connection.confirmTransaction(
      transactionSignature,
    );

    console.log('Prices set successfully');

    if (result.value.err) {
      console.log('Set prices failed:', result.value.err);
      process.exit(1);
    }
  }

  /**
   * Creates a new staking position.
   */
  async stake(
    params: StakingParams,
  ): Promise<TokenMillResponse<{signature: string}>> {
    try {
      const marketPubkey = new PublicKey(params.marketAddress);
      const market = await this.program.account.market.fetch(marketPubkey);

      const stakingAccount = await this.getStakingAccount(
        marketPubkey,
        this.wallet.publicKey,
      );

      const tx = await this.program.methods
        .createStaking()
        .accountsPartial({
          market: marketPubkey,
          staking: stakingAccount,
          payer: this.wallet.publicKey,
        })
        .signers([this.wallet])
        .rpc();

      return {
        success: true,
        data: {signature: tx},
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Helper method to derive the staking account PDA.
   */
  private async getStakingAccount(
    market: PublicKey,
    user: PublicKey,
  ): Promise<PublicKey> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('market_staking'), market.toBuffer()],
      this.program.programId,
    )[0];
  }

  /**
   * Creates a new vesting plan.
   */
  async createVesting(
    params: VestingParams,
  ): Promise<TokenMillResponse<{vestingAccount: string; signature: string}>> {
    try {
      const marketPubkey = new PublicKey(params.marketAddress);
      const recipientPubkey = new PublicKey(params.recipient);
      const vestingAccount = Keypair.generate();

      const marketAccount = await this.program.account.market.fetch(
        marketPubkey,
      );
      const baseTokenMint = marketAccount.baseTokenMint;

      console.log('Base Token Mint:', baseTokenMint.toString());

      // Get ATAs
      const userBaseTokenAta = spl.getAssociatedTokenAddressSync(
        baseTokenMint,
        this.wallet.publicKey,
        true,
        spl.TOKEN_2022_PROGRAM_ID,
        spl.ASSOCIATED_TOKEN_PROGRAM_ID,
      );

      const userBaseTokenBalance = await this.connection.getTokenAccountBalance(
        userBaseTokenAta,
      );
      console.log(
        'User Base Token Balance:',
        userBaseTokenBalance.value.uiAmount,
      );

      const marketBaseTokenAta = spl.getAssociatedTokenAddressSync(
        baseTokenMint,
        marketPubkey,
        true,
        spl.TOKEN_2022_PROGRAM_ID,
        spl.ASSOCIATED_TOKEN_PROGRAM_ID,
      );

      // Create user ATA if needed
      const doesUserHaveBaseTokenATA = await this.connection.getAccountInfo(
        userBaseTokenAta,
      );
      console.log('Does User Have Base Token ATA:', doesUserHaveBaseTokenATA);
      if (!doesUserHaveBaseTokenATA) {
        await spl.createAssociatedTokenAccount(
          this.connection,
          this.wallet,
          baseTokenMint,
          this.wallet.publicKey,
          {commitment: 'confirmed'},
          spl.TOKEN_2022_PROGRAM_ID,
          spl.ASSOCIATED_TOKEN_PROGRAM_ID,
          true,
        );
      }

      // Setup staking if needed
      const staking = PublicKey.findProgramAddressSync(
        [Buffer.from('market_staking'), marketPubkey.toBuffer()],
        this.program.programId,
      )[0];

      const stakePositionAccountInfo = await this.connection.getAccountInfo(
        staking,
      );
      console.log('Stake Position Account Info:', stakePositionAccountInfo);

      await this.setupStakingIfNeeded(staking, marketPubkey);
      await this.setupStakePositionIfNeeded(marketPubkey);

      const tx = await this.program.methods
        .createVestingPlan(
          new BN(Date.now() / 1000),
          new BN(params.amount),
          new BN(params.duration),
          params.cliffDuration ? new BN(params.cliffDuration) : new BN(0),
        )
        .accountsPartial({
          market: marketPubkey,
          staking,
          stakePosition: await this.getStakePositionAddress(marketPubkey),
          vestingPlan: vestingAccount.publicKey,
          marketBaseTokenAta,
          userBaseTokenAta,
          baseTokenMint: baseTokenMint,
          baseTokenProgram: spl.TOKEN_2022_PROGRAM_ID,
          user: this.wallet.publicKey,
        })
        .signers([vestingAccount])
        .rpc();

      return {
        success: true,
        data: {
          vestingAccount: vestingAccount.toString(),
          signature: tx,
        },
      };
    } catch (error) {
      console.error('Error creating vesting:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Sets up staking for a market if not already configured.
   */
  private async setupStakingIfNeeded(
    staking: PublicKey,
    market: PublicKey,
  ): Promise<void> {
    const stakingAccountInfo = await this.connection.getAccountInfo(staking);
    if (!stakingAccountInfo) {
      const transaction = await this.program.methods
        .createStaking()
        .accountsPartial({
          market,
          staking,
          payer: this.wallet.publicKey,
        })
        .signers([this.wallet])
        .transaction();

      const signature = await this.connection.sendTransaction(transaction, [
        this.wallet,
      ]);
      const result = await this.connection.confirmTransaction(signature);

      if (result.value.err) {
        throw new Error(`Staking activation failed: ${result.value.err}`);
      }
    }
  }

  /**
   * Sets up the stake position for the current user if not already configured.
   */
  private async setupStakePositionIfNeeded(market: PublicKey): Promise<void> {
    const stakePosition = await this.getStakePositionAddress(market);
    const stakePositionInfo = await this.connection.getAccountInfo(
      stakePosition,
    );

    if (!stakePositionInfo) {
      const transaction = await this.program.methods
        .createStakePosition()
        .accountsPartial({
          market,
          stakePosition,
          user: this.wallet.publicKey,
        })
        .signers([this.wallet])
        .transaction();

      const signature = await this.connection.sendTransaction(transaction, [
        this.wallet,
      ]);
      const result = await this.connection.confirmTransaction(signature);

      if (result.value.err) {
        throw new Error(`Stake position creation failed: ${result.value.err}`);
      }
    }
  }

  /**
   * Derives the stake position address for the current user and market.
   */
  private async getStakePositionAddress(market: PublicKey): Promise<PublicKey> {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('stake_position'),
        market.toBuffer(),
        this.wallet.publicKey.toBuffer(),
      ],
      this.program.programId,
    )[0];
  }

  /**
   * Releases vested tokens.
   */
  async releaseVesting(params: {
    marketAddress: string;
    stakingAddress: string;
    stakePositionAddress: string;
    vestingPlanAddress: string;
    baseTokenMint: string;
  }): Promise<TokenMillResponse<{signature: string}>> {
    try {
      const marketPubkey = new PublicKey(params.marketAddress);
      const baseTokenMintPubkey = new PublicKey(params.baseTokenMint);
      const vestingPlanPubkey = new PublicKey(params.vestingPlanAddress);

      const marketBaseTokenAta = getAssociatedTokenAddressSync(
        baseTokenMintPubkey,
        marketPubkey,
        true,
        spl.TOKEN_PROGRAM_ID,
      );
      const userBaseTokenAta = getAssociatedTokenAddressSync(
        baseTokenMintPubkey,
        this.wallet.publicKey,
        true,
        spl.TOKEN_PROGRAM_ID,
      );

      // Wait for a minute (if needed)
      await new Promise(resolve => setTimeout(resolve, 60_000));

      const transaction = await this.program.methods
        .release()
        .accountsPartial({
          market: marketPubkey,
          staking: new PublicKey(params.stakingAddress),
          stakePosition: new PublicKey(params.stakePositionAddress),
          vestingPlan: vestingPlanPubkey,
          marketBaseTokenAta,
          userBaseTokenAta,
          baseTokenMint: baseTokenMintPubkey,
          baseTokenProgram: TOKEN_PROGRAM_ID,
          user: this.wallet.publicKey,
        })
        .transaction();

      const transactionSignature = await this.connection.sendTransaction(
        transaction,
        [this.wallet],
      );
      const confirmation = await this.connection.confirmTransaction(
        transactionSignature,
      );

      if (confirmation.value.err) {
        throw new Error(`Release failed: ${confirmation.value.err}`);
      }

      return {success: true, data: {signature: transactionSignature}};
    } catch (error: any) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Retrieves the PDA for the configuration account.
   */
  async getConfigPDA(): Promise<PublicKey> {
    try {
      const [configPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('config')],
        this.program.programId,
      );
      return configPDA;
    } catch (error) {
      console.error('Error calculating config PDA:', error);
      throw new Error('Failed to calculate config PDA');
    }
  }

  /**
   * Executes a swap using the TokenMill program.
   */
  async executeSwap({
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

      if (baseTokenBalance < REQUIRED_WSOL_AMOUNT) {
        console.log(
          `Market lock with Authority. Current balance: ${baseTokenBalance} WSOL. Required: ${REQUIRED_WSOL_AMOUNT} WSOL`,
        );
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

        const signature = await this.connection.sendTransaction(transaction, [
          this.wallet,
          swap_authority,
        ]);
        const confirmation = await this.connection.confirmTransaction(
          signature,
        );

        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${confirmation.value.err}`);
        }
        return {
          success: true,
          signature,
          message: 'Swap executed successfully',
        };
      } else {
        const transaction = await this.program.methods
          .freeMarket()
          .accountsPartial({
            market,
            swapAuthority: swapAuthority,
          })
          .signers([this.wallet, swapAuthorityKeypair])
          .transaction();

        const signature = await this.connection.sendTransaction(transaction, [
          this.wallet,
          swapAuthorityKeypair,
        ]);
        const freeconfirmation = await this.connection.confirmTransaction(
          signature,
        );

        if (freeconfirmation.value.err) {
          throw new Error(`Transaction failed: ${freeconfirmation.value.err}`);
        }
        console.log('Market Free');
        const freetransaction = await this.program.methods
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
            swapAuthority: this.wallet.publicKey,
            user: this.wallet.publicKey,
            baseTokenProgram: TOKEN_PROGRAM_ID,
            quoteTokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([this.wallet])
          .transaction();

        const freesignature = await this.connection.sendTransaction(
          freetransaction,
          [this.wallet],
        );
        const confirmation = await this.connection.confirmTransaction(
          freesignature,
        );

        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${confirmation.value.err}`);
        }

        return {
          success: true,
          signature,
          message: 'Swap executed successfully',
        };
      }
    } catch (error: any) {
      console.error(error);
      throw new Error(`Failed to execute swap: ${error.message}`);
    }
  }
}
