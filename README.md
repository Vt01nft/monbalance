# ⚖️ MonBalance

> **One-click portfolio rebalancer on Monad Testnet** - sweep multiple ERC-20 tokens into MON in a single on-chain transaction.

🌐 **Live Demo:** [monbalance.vercel.app](https://monbalance.vercel.app)

---

## ✨ Features

- **One-Click Batch Swap** - Select any combination of tokens and swap them all into MON in a single transaction
- **⚡ Select All** - Set all token sliders to 100% in one click
- **Real Wallet Integration** - Connect MetaMask, switch accounts, disconnect cleanly
- **Balance Display** - MON balance shown right next to your address in the header
- **All Wallet Tokens** - Automatically discovers every ERC-20 token in your wallet via MonadScan API
- **Activity Log** - Every completed swap is logged with a clickable MonadScan transaction link
- **Gas Savings Tracker** - Shows estimated gas saved vs doing each swap individually
- **Live Price Sparklines** - Animated price trend charts for each asset
- **Portfolio Donut Chart** - Real-time allocation visualization
- **Monad Testnet Faucet** - One-click link to get free testnet MON
- **Fully Responsive** - Works on mobile, tablet, and desktop

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite |
| Styling | Vanilla CSS (glassmorphism dark theme) |
| Web3 | ethers.js v6 |
| Smart Contracts | Solidity 0.8.20 + Hardhat |
| Explorer | MonadScan (Etherscan-compatible API) |
| Deployment | Vercel + GitHub |

---

## 📦 Smart Contracts (Monad Testnet)

| Contract | Address |
|---|---|
| MultiSwapRouter | `0xf87e5B0b21717e818eE96B76e7a2C748cece848B` |
| MockDEX | `0x7dfe2eB83616C6aC0BA0dC2605E9A3fD80955178` |
| mUSDC | `0x6A534AEa34D039c64d677264f7BD3Ee6F729AfE1` |
| mETH | `0x3A600CCa2A3692b099fC40d75751E09c280527b4` |
| mWBTC | `0xB2Ed2BB7A61a0405F27893c5cE04efbac0A438A7` |
| mLINK | `0xf49B7540c51430e4ba9E97ee7B82b3626081Ceb0` |

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v18+
- [MetaMask](https://metamask.io/) browser extension
- Monad Testnet configured in MetaMask

### Add Monad Testnet to MetaMask
| Field | Value |
|---|---|
| Network Name | Monad Testnet |
| RPC URL | `https://testnet-rpc.monad.xyz` |
| Chain ID | `10143` |
| Symbol | `MON` |
| Explorer | `https://testnet.monadscan.com` |

### Run Locally

```bash
# Clone the repo
git clone https://github.com/Vt01nft/monbalance.git
cd monbalance

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```bash
npm run build
```

---

## 🔄 How It Works

1. **Connect** your MetaMask wallet on Monad Testnet
2. **Get testnet tokens** from the [Monad Faucet](https://faucet.monad.xyz/)
3. **Set percentages** - drag sliders or click ⚡ Select All 100%
4. **Click "One-Click Sweep to MON"** - the app:
   - Checks and requests ERC-20 approvals (if needed)
   - Sends a single `rebalanceToMON` transaction to the router contract
   - The router batch-swaps all selected tokens through the MockDEX
   - MON is returned to your wallet in one tx
5. **View your transaction** on [MonadScan](https://testnet.monadscan.com)

---

## 📁 Project Structure

```
monbalance/
├── contracts/
│   ├── MockToken.sol          # ERC-20 mock tokens (mUSDC, mETH, mWBTC, mLINK)
│   ├── MockDEX.sol            # Constant-product AMM pool
│   └── MultiSwapRouter.sol    # Batch swap router
├── scripts/
│   └── deploy.cjs             # Hardhat deployment script
├── src/
│   ├── components/
│   │   ├── WalletConnect.tsx  # Wallet pill with dropdown menu
│   │   ├── DonutChart.tsx     # SVG portfolio allocation chart
│   │   ├── Sparkline.tsx      # Price trend sparklines
│   │   └── RebalanceModal.tsx # Step-by-step swap progress modal
│   ├── App.tsx                # Main dashboard logic & state
│   ├── index.css              # Design system (dark mode, Monad palette)
│   └── main.tsx               # React entry point
├── index.html                 # SEO-optimized HTML shell
├── vercel.json                # Vercel SPA routing config
└── hardhat.config.cjs         # Hardhat + Monad Testnet config
```

---

## 🔗 Links

- 🌐 **Live App:** [monbalance.vercel.app](https://monbalance.vercel.app)
- 🔍 **Explorer:** [testnet.monadscan.com](https://testnet.monadscan.com)
- 🚰 **Faucet:** [faucet.monad.xyz](https://faucet.monad.xyz)
- 🟣 **Monad:** [monad.xyz](https://monad.xyz)

---

## 📄 License

MIT
