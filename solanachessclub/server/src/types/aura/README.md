# Aura DAS API Backend

The Aura DAS (Digital Asset Standard) API Backend is a server-side implementation that interacts with Metaplex’s **Aura** to fetch, search, and manage digital assets on the **Solana blockchain**. This backend enables querying for assets, owners, token accounts, and batch asset retrieval via REST APIs.

## Overview

The **Aura DAS API Backend** is an **Express.js** server that interacts with **Metaplex Aura’s DAS APIs**, providing RESTful endpoints for:
- Fetching assets by ID
- Searching assets with filters
- Retrieving assets owned by a wallet
- Querying token accounts
- Fetching asset proofs
- Batch fetching assets

## Prerequisites

- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **Solana CLI** (installed and configured)
- **A Solana wallet** with SOL for transactions (if required for any extended features)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd aura-das-api
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory and add the required environment variables:
```env
PORT=3000
RPC_URL=https://api.mainnet-beta.solana.com
```

## Development

Start the development server:
```bash
npm run dev
```

Build the project:
```bash
npm run build
```

## API Endpoints

### **Fetching Assets**
- **`POST /api/asset`** - Fetches an assets by ID
  - **Request Body:** `{ "id": "asset_id" }`

- **`POST /api/assets/batch`** - Fetches a batch of assets by IDs
  - **Request Body:** `{ "assetIds": ["asset1", "asset2"] }`

- **`POST /api/assets/proof/batch`** - Fetches multiple assets proof by their IDs
  - **Request Body:** `{ "assetIds": ["asset1", "asset2"] }`

- **`POST /api/assets/authority`** - Fetches a list of assets with a specific authority
  - **Request Body:** `{ "auhtorityAddress": "wallet_pubkey", "limit": 10, "page": 1, "sortBy": { "sort_by": "updated", "sort_direction": "desc" } }`

- **`POST /api/assets/owner`** - Retrieves assets owned by a wallet
  - **Request Body:** `{ "ownerAddress": "wallet_pubkey", "limit": 10, "page": 1, "sortBy": { "sort_by": "updated", "sort_direction": "desc" } }`

- **`POST /api/assets/group`** - Retrieves list of assets by group key and group value
  - **Request Body:** `{ "groupKey": "group_key", "groupValue": "group_pubkey", "limit": 10, "page": 1, "sortBy": { "sort_by": "updated", "sort_direction": "desc" } }`

- **`POST /api/assets/creator`** - Retrieves list of assets created by an address
  - **Request Body:** `{ "creatorAddress": "wallet_pubkey", "onlyVerified": "true", "limit": 10, "page": 1, "sortBy": { "sort_by": "updated", "sort_direction": "desc" } }`

- **`POST /api/assets/signatures`** - Retrieves list of signature related to a compressed asset
  - **Request Body:** `{ "id": "pubKey", "limit": 10, "page": 1}`

### **Searching Assets**
- **`POST /api/assets/search`** - Searches assets with filters
  - **Request Body:** `{ "ownerAddress": "wallet_pubkey", "compressed": true, "sortBy": { "sort_by": "updatedAt", "sort_direction": "desc" } }`

### **Token Accounts**
- **`POST /api/token/accounts`** - Retrieves token accounts for a given mint or owner
  - **Request Body:** `{ "mint": "mint_pubkey", "owner": "wallet_pubkey", "limit": 10, "page": 1 }`

### **Fetching Asset Proofs**
- **`POST /api/assets/proof`** - Retrieves proof of an asset’s existence
  - **Request Body:** `{ "id": "asset_pubkey" }`

## Project Structure

```
aura-das-api/
├── dist/              # Compiled JavaScript output
├── node_modules/      # Installed dependencies
├── src/
│   ├── interface.ts   # TypeScript interface definitions
│   ├── server.ts      # Main server file
├── .env               # Environment variables
├── .gitignore         # Git ignore file
├── package-lock.json  # Lock file for package manager
├── package.json       # Dependencies and scripts
├── README.md          # Documentation
├── tsconfig.json      # TypeScript configuration
```

## Dependencies

- **`express`** - Web server framework
- **`dotenv`** - Environment variable management
- **`axios`** - Making HTTP requests to the Aura DAS API
- **`typescript`** - Type safety and better development experience

## Troubleshooting

- **Error: `RecordNotFound Error: Asset Not Found`**
  - Ensure the asset ID exists on Solana Mainnet or Devnet.
  - Double-check the network endpoint (`mainnet-beta` or `devnet`).

- **Error: `Invalid params: missing field 'sortBy'`**
  - Ensure `sortBy` follows the correct structure: `{ "sort_by": "updatedAt", "sort_direction": "desc" }`

- **Error: `Invalid params: unknown field`**
  - Check the request body for invalid fields; refer to Aura DAS API documentation.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit changes (`git commit -m 'Added new feature'`)
4. Push to the branch (`git push origin feature/new-feature`)
5. Open a Pull Request

## License

MIT License

## Support

For support, open an issue in the repository or contact the maintainers.

