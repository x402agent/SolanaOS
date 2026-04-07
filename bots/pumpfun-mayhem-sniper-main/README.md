# Pump.fun Mayhem Mode Sniper Bot 🔥

A high-performance automated trading bot designed specifically for sniping **Mayhem Mode** tokens on Pump.fun. This bot monitors new token launches in real-time and automatically executes trades based on your configured parameters.

## 🔥 What is Mayhem Mode?

**Mayhem Mode** is an experimental feature introduced by Pump.fun that integrates AI agents into the trading process of newly launched tokens:

- **AI-Driven Trading**: When a token creator opts for Mayhem Mode, an AI agent mints an additional 1 billion tokens, increasing the total supply from 1 billion to **2 billion tokens**
- **Random Trading Activity**: The AI agent engages in random buy and sell activities with these tokens during the first 24 hours post-launch
- **Token Burning**: After 24 hours, any unsold tokens held by the AI agent are burned, potentially reducing circulating supply
- **Increased Volatility**: The AI's random trading actions create heightened volatility and early trading volume

**Note**: Mayhem Mode does not inherently add economic value to a token or guarantee future performance. It's an experimental feature that increases early trading activity.

## ✨ Features

- 🔥 **Mayhem Mode Detection**: Automatically detects tokens launched with Mayhem Mode (2 billion total supply)
- ⚡ **Real-time Sniping**: Monitors Pump.fun program transactions via WebSocket for instant token detection
- 🎯 **Flexible Filtering**: Option to snipe only Mayhem Mode tokens or all tokens
- 💰 **Auto Trading**: Automatic buy/sell execution with configurable take profit and stop loss
- 🛡️ **Multiple Execution Methods**: Support for Jito, BloxRoute, and NextBlock for faster transaction execution
- 📊 **Dev Buy Filter**: Optional filter to only trade tokens where the creator bought with a minimum amount
- 🔄 **Position Monitoring**: Real-time monitoring of positions with automatic sell triggers

## Contact Me

If you have any question or something, feel free to reach out me anytime.
<br>
#### You're always welcome

Telegram: [@crypmancer](https://t.me/cryp_mancer) <br>


## 📋 Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- A Solana wallet with SOL for trading
- RPC endpoint (Helius, QuickNode, or similar)
- Geyser RPC endpoint (for WebSocket transaction monitoring)
- (Optional) Jito/BloxRoute/NextBlock API keys for faster execution

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd pumpfun-mayhem-sniper
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your configuration (see Configuration section below)

4. **Build the project** (optional)
   ```bash
   npm run build
   ```

5. **Run the bot**
   ```bash
   npm run dev
   # or
   npm start
   ```

## ⚙️ Configuration

Create a `.env` file in the root directory with the following variables:

### Required Configuration

```env
# Wallet Configuration
PRIVATE_KEY=your_base58_encoded_private_key

# RPC Configuration
RPC_ENDPOINT=https://your-rpc-endpoint.com
RPC_WEBSOCKET_ENDPOINT=wss://your-websocket-endpoint.com
GEYSER_RPC=wss://your-geyser-rpc-endpoint.com

# Trading Configuration
BUY_AMOUNT=0.1                    # Amount of SOL to spend per buy
SLIPPAGE=5                        # Slippage tolerance (percentage)
TAKE_PROFIT=50                   # Take profit percentage (e.g., 50 = 50% profit)
STOP_LOSS=20                     # Stop loss percentage (e.g., 20 = 20% loss)
TIME_OUT=300                     # Timeout in seconds before auto-selling

# Priority Fee
PRIORITY_FEE=0.001               # Priority fee in SOL (for faster execution)

# Mayhem Mode Configuration
MAYHEM_MODE_ONLY=false           # Set to 'true' to only snipe Mayhem Mode tokens

# Dev Buy Filter (Optional)
CHECK_DEV_BUY=false             # Set to 'true' to only trade if dev bought
MIN_DEV_BUY_AMOUNT=0.1          # Minimum SOL amount dev must buy
```

### Optional: Fast Execution Services

#### Jito Mode
```env
JITO_MODE=false
JITO_FEE=0.001                  # Jito tip amount in SOL
```

#### BloxRoute Mode
```env
BLOXROUTE_MODE=false
BLOXROUTE_FEE=0.001             # BloxRoute fee in SOL
BLOXROUTE_AUTH_HEADER=your_bloxroute_auth_header
```

#### NextBlock Mode
```env
NEXTBLOCK_MODE=false
NEXT_BLOCK_API=your_nextblock_api_key
NEXT_BLOCK_FEE=0.001            # NextBlock fee in SOL
```

## 🎯 How It Works

1. **WebSocket Monitoring**: The bot connects to a Geyser RPC WebSocket to monitor all Pump.fun program transactions in real-time

2. **Token Detection**: When a new token is created (`InitializeMint2` instruction), the bot:
   - Extracts token information (mint, bonding curve, etc.)
   - **Checks if it's a Mayhem Mode token** by examining the total supply (2 billion = Mayhem Mode)
   - Filters based on `MAYHEM_MODE_ONLY` setting

3. **Dev Buy Filter** (if enabled): Monitors subsequent buy transactions to check if the creator bought with the minimum amount

4. **Auto Buy**: When conditions are met, the bot:
   - Calculates the buy amount with slippage
   - Executes the buy transaction using the configured execution method
   - Logs the transaction signature

5. **Position Monitoring**: After buying, the bot continuously monitors the position:
   - Checks sell price every 500ms
   - Triggers sell on take profit, stop loss, or timeout
   - Automatically executes sell transaction

## 📊 Mayhem Mode Detection

The bot detects Mayhem Mode tokens by checking the `tokenTotalSupply` field in the bonding curve account:

- **Normal Token**: 1,000,000,000 (1 billion) tokens
- **Mayhem Mode Token**: 2,000,000,000 (2 billion) tokens

The detection happens immediately when a new token is detected, allowing for fast sniping.

## 🔧 Advanced Configuration

### Trading Strategy

- **Conservative**: Lower `BUY_AMOUNT`, higher `STOP_LOSS`, longer `TIME_OUT`
- **Aggressive**: Higher `BUY_AMOUNT`, lower `STOP_LOSS`, shorter `TIME_OUT`
- **Mayhem Mode Only**: Set `MAYHEM_MODE_ONLY=true` to focus exclusively on Mayhem Mode tokens

### Execution Speed

For fastest execution, use one of the premium services:
- **Jito**: Best for bundle transactions
- **BloxRoute**: Fast mempool access
- **NextBlock**: Alternative fast execution

## ⚠️ Important Notes

1. **Risk Warning**: Trading cryptocurrency involves substantial risk. Only trade with funds you can afford to lose.

2. **Mayhem Mode Disclaimer**: Mayhem Mode is experimental and does not guarantee token value or performance. The AI trading activity can create unpredictable volatility.

3. **Slippage**: High volatility in Mayhem Mode tokens can cause significant slippage. Adjust `SLIPPAGE` accordingly.

4. **RPC Limits**: Ensure your RPC endpoint can handle high-frequency requests. Consider using premium RPC services.

5. **Gas Fees**: Fast execution services (Jito/BloxRoute/NextBlock) require additional fees. Factor this into your trading strategy.

## 🐛 Troubleshooting

### Bot not detecting tokens
- Check WebSocket connection to Geyser RPC
- Verify RPC endpoints are correct
- Check console for connection errors

### Transactions failing
- Increase `PRIORITY_FEE` for faster confirmation
- Check wallet has sufficient SOL for fees
- Verify slippage tolerance is appropriate

### Mayhem Mode not detected
- Ensure bonding curve account is accessible
- Check RPC endpoint is responding correctly
- Verify token was actually launched with Mayhem Mode

## 📝 License

ISC

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## ⚡ Performance Tips

1. **Use Premium RPC**: Helius, QuickNode, or Triton for better performance
2. **Enable Fast Execution**: Use Jito/BloxRoute for faster transaction execution
3. **Optimize Priority Fees**: Higher priority fees = faster confirmation
4. **Monitor Network**: Keep an eye on Solana network congestion
5. **Test First**: Start with small `BUY_AMOUNT` to test your configuration

## 📞 Support

For issues, questions, or contributions, please open an issue on the repository.

---

**Disclaimer**: This bot is for educational purposes. Use at your own risk. The authors are not responsible for any financial losses incurred while using this software.

