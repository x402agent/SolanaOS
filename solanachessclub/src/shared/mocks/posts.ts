// FILE: src/mocks/allposts.ts
import {ThreadPost} from '@/core/thread/components/thread.types';

export const allposts: ThreadPost[] = [
  // ====== DUMMY NFT POST 1: NFT Listing ======
  {
    id: 'dummy-nft-1',
    user: {
      id: 'demo-user-1',
      username: 'NFTCollector',
      handle: '@nftcollector_demo',
      avatar: require('@/assets/images/User.png'),
      verified: true,
    },
    createdAt: '2025-01-15T10:00:00Z',
    parentId: undefined,
    sections: [
      {
        id: 'section-nft-1',
        type: 'NFT_LISTING',
        text: "🎨 [DEMO POST] Rare digital art piece for sale! This is dummy data for testing purposes.",
        listingData: {
          mint: 'DemoNFT1111111111111111111111111111111111',
          owner: 'demo-user-1',
          name: 'Cosmic Cat #42',
          image: 'https://placekitten.com/300/300',
          priceSol: 5.2,
        },
      },
    ],
    replies: [],
    reactionCount: 15,
    retweetCount: 3,
    quoteCount: 2,
  },

  // ====== DUMMY TRADE POST 1: SOL to USDC Swap ======
  {
    id: 'dummy-trade-1',
    user: {
      id: 'demo-user-2',
      username: 'CryptoTrader',
      handle: '@cryptotrader_demo',
      avatar: require('@/assets/images/User2.png'),
      verified: false,
    },
    createdAt: '2025-01-15T09:30:00Z',
    parentId: undefined,
    sections: [
      {
        id: 'section-trade-1',
        type: 'TEXT_TRADE',
        text: '💰 [DEMO POST] Just swapped some SOL for USDC! This is sample trade data for demonstration.',
        tradeData: {
          inputMint: 'So11111111111111111111111111111111111111112',
          outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          aggregator: 'Jupiter',
          inputSymbol: 'SOL',
          inputQuantity: '2.5',
          inputUsdValue: '$625.00',
          outputSymbol: 'USDC',
          outputQuantity: '625.00',
          outputUsdValue: '$625.00',
        },
      },
    ],
    replies: [],
    reactionCount: 8,
    retweetCount: 1,
    quoteCount: 0,
  },

  // ====== DUMMY MESSAGE POST 1: Simple Text ======
  {
    id: 'dummy-message-1',
    user: {
      id: 'demo-user-3',
      username: 'SolanaFan',
      handle: '@solanafan_demo',
      avatar: require('@/assets/images/User3.png'),
      verified: true,
    },
    createdAt: '2025-01-15T09:00:00Z',
    parentId: undefined,
    sections: [
      {
        id: 'section-message-1',
        type: 'TEXT_ONLY',
        text: '🚀 [DEMO POST] GM Solana community! Excited about the future of Web3. This is dummy content for app testing.',
      },
    ],
    replies: [],
    reactionCount: 42,
    retweetCount: 12,
    quoteCount: 5,
  },

  // ====== DUMMY NFT POST 2: Another NFT Listing ======
  {
    id: 'dummy-nft-2',
    user: {
      id: 'demo-user-4',
      username: 'DigitalArtist',
      handle: '@digitalartist_demo',
      avatar: require('@/assets/images/user5.png'),
      verified: true,
    },
    createdAt: '2025-01-15T08:45:00Z',
    parentId: undefined,
    sections: [
      {
        id: 'section-nft-2',
        type: 'NFT_LISTING',
        text: "✨ [DEMO POST] New generative art drop! Limited edition. This is sample NFT data for testing.",
        listingData: {
          mint: 'DemoNFT2222222222222222222222222222222222',
          owner: 'demo-user-4',
          name: 'Abstract Dreams #127',
          image: 'https://picsum.photos/300/300?random=1',
          priceSol: 1.8,
        },
      },
    ],
    replies: [],
    reactionCount: 23,
    retweetCount: 7,
    quoteCount: 3,
  },

  // ====== DUMMY TRADE POST 2: SEND Token Swap ======
  {
    id: 'dummy-trade-2',
    user: {
      id: 'demo-user-5',
      username: 'DeFiExplorer',
      handle: '@defiexplorer_demo',
      avatar: require('@/assets/images/User2.png'),
      verified: false,
    },
    createdAt: '2025-01-15T08:15:00Z',
    parentId: undefined,
    sections: [
      {
        id: 'section-trade-2',
        type: 'TEXT_TRADE',
        text: '🔄 [DEMO POST] Swapped SOL for SEND tokens! Bullish on this project. Sample trade for demo purposes.',
        tradeData: {
          inputMint: 'So11111111111111111111111111111111111111112',
          outputMint: 'SENDdRQtYMWaQrBroBrJ2Q53fgVuq95CV9UPGEvpCxa',
          aggregator: 'Jupiter',
          inputSymbol: 'SOL',
          inputQuantity: '1.0',
          inputUsdValue: '$250.00',
          outputSymbol: 'SEND',
          outputQuantity: '7,812.5',
          outputUsdValue: '$250.00',
        },
      },
    ],
    replies: [],
    reactionCount: 18,
    retweetCount: 4,
    quoteCount: 1,
  },

  // ====== DUMMY MESSAGE POST 2: Community Update ======
  {
    id: 'dummy-message-2',
    user: {
      id: 'demo-user-6',
      username: 'CommunityMod',
      handle: '@communitymod_demo',
      avatar: require('@/assets/images/User.png'),
      verified: true,
    },
    createdAt: '2025-01-15T07:30:00Z',
    parentId: undefined,
    sections: [
      {
        id: 'section-message-2',
        type: 'TEXT_ONLY',
        text: '📢 [DEMO POST] Weekly community update: New features coming soon! This is placeholder content for app demonstration.',
      },
    ],
    replies: [],
    reactionCount: 67,
    retweetCount: 25,
    quoteCount: 8,
  },

  // ====== DUMMY NFT POST 3: Gaming NFT ======
  {
    id: 'dummy-nft-3',
    user: {
      id: 'demo-user-7',
      username: 'GameDev',
      handle: '@gamedev_demo',
      avatar: require('@/assets/images/User3.png'),
      verified: false,
    },
    createdAt: '2025-01-15T07:00:00Z',
    parentId: undefined,
    sections: [
      {
        id: 'section-nft-3',
        type: 'NFT_LISTING',
        text: "🎮 [DEMO POST] Rare gaming weapon NFT! Perfect for collectors. This is mock gaming NFT data.",
        listingData: {
          mint: 'DemoNFT3333333333333333333333333333333333',
          owner: 'demo-user-7',
          name: 'Legendary Sword #001',
          image: 'https://picsum.photos/300/300?random=2',
          priceSol: 12.5,
        },
      },
    ],
    replies: [],
    reactionCount: 31,
    retweetCount: 9,
    quoteCount: 4,
  },

  // ====== DUMMY MESSAGE POST 3: Technical Discussion ======
  {
    id: 'dummy-message-3',
    user: {
      id: 'demo-user-8',
      username: 'TechAnalyst',
      handle: '@techanalyst_demo',
      avatar: require('@/assets/images/User2.png'),
      verified: true,
    },
    createdAt: '2025-01-15T06:45:00Z',
    parentId: undefined,
    sections: [
      {
        id: 'section-message-3',
        type: 'TEXT_ONLY',
        text: '🔧 [DEMO POST] Analyzing the latest Solana network upgrades. Impressive TPS improvements! This is sample technical content.',
      },
    ],
    replies: [],
    reactionCount: 89,
    retweetCount: 34,
    quoteCount: 12,
  },

  // ====== DUMMY TRADE POST 3: Multi-token Swap ======
  {
    id: 'dummy-trade-3',
    user: {
      id: 'demo-user-9',
      username: 'YieldFarmer',
      handle: '@yieldfarmer_demo',
      avatar: require('@/assets/images/User.png'),
      verified: false,
    },
    createdAt: '2025-01-15T06:00:00Z',
    parentId: undefined,
    sections: [
      {
        id: 'section-trade-3',
        type: 'TEXT_TRADE',
        text: '🌾 [DEMO POST] Diversifying my portfolio with this swap! Demo trade data for testing purposes.',
        tradeData: {
          inputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          outputMint: 'So11111111111111111111111111111111111111112',
          aggregator: 'Jupiter',
          inputSymbol: 'USDC',
          inputQuantity: '1,000.00',
          inputUsdValue: '$1,000.00',
          outputSymbol: 'SOL',
          outputQuantity: '4.0',
          outputUsdValue: '$1,000.00',
        },
      },
    ],
    replies: [],
    reactionCount: 12,
    retweetCount: 2,
    quoteCount: 1,
  },
];
