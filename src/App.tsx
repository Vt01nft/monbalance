import { useState, useEffect } from 'react';

import { WalletConnect } from './components/WalletConnect';
import { DonutChart } from './components/DonutChart';
import { Sparkline } from './components/Sparkline';
import { RebalanceModal, ModalStep } from './components/RebalanceModal';
import { ethers } from 'ethers';

// Contracts will be compiled and addresses will be updated after deployment
const MOCK_ADDRESSES = {
  router: "0xf87e5B0b21717e818eE96B76e7a2C748cece848B",
  dex: "0x7dfe2eB83616C6aC0BA0dC2605E9A3fD80955178",
  tokens: {
    mUSDC: "0x6A534AEa34D039c64d677264f7BD3Ee6F729AfE1",
    mETH: "0x3A600CCa2A3692b099fC40d75751E09c280527b4",
    mWBTC: "0xB2Ed2BB7A61a0405F27893c5cE04efbac0A438A7",
    mLINK: "0xf49B7540c51430e4ba9E97ee7B82b3626081Ceb0"
  }
};

const TOKEN_METADATA = [
  { symbol: 'mUSDC', name: 'Mock USD Coin', color: '#87AE99', icon: '💵', decimals: 6 },
  { symbol: 'mETH',  name: 'Mock Ethereum',  color: '#23649A', icon: '🔷', decimals: 18 },
  { symbol: 'mWBTC', name: 'Mock Wrapped Bitcoin', color: '#A35C44', icon: '₿', decimals: 8 },
  { symbol: 'mLINK', name: 'Mock Chainlink', color: '#C3CCB0', icon: '🔗', decimals: 18 }
];

// ABI templates
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function approve(address, uint256) returns (bool)",
  "function allowance(address, address) view returns (uint256)",
  "function mint(address, uint256)"
];

const ROUTER_ABI = [
  "function rebalanceToMON(address[], uint256[], uint256[]) returns (uint256)"
];

export default function App() {
  // Wallet State
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>("0.0");
  const [chainId, setChainId] = useState<number | null>(null);

  // Asset Balances (native MON + mock tokens)
  const [tokenBalances, setTokenBalances] = useState<Record<string, string>>({
    mUSDC: "0",
    mETH: "0",
    mWBTC: "0",
    mLINK: "0"
  });

  // Rebalancing Slider Percentages (0 to 100)
  const [percentages, setPercentages] = useState<Record<string, number>>({
    mUSDC: 0,
    mETH: 0,
    mWBTC: 0,
    mLINK: 0
  });

  // Price States
  const [prices, setPrices] = useState<Record<string, number>>({
    MON: 1.85,
    mUSDC: 1.00,
    mETH: 3420.00,
    mWBTC: 62500.00,
    mLINK: 14.50
  });

  // Price Trend History (for Sparklines)
  const [priceHistories, setPriceHistories] = useState<Record<string, number[]>>({
    MON: [1.80, 1.82, 1.83, 1.81, 1.86, 1.85],
    mUSDC: [1.00, 1.00, 1.00, 1.00, 1.00, 1.00],
    mETH: [3380, 3450, 3400, 3410, 3430, 3420],
    mWBTC: [61900, 62100, 63000, 62400, 62700, 62500],
    mLINK: [14.10, 14.30, 14.60, 14.20, 14.40, 14.50]
  });

  // Transaction Logs
  const [logs, setLogs] = useState<{ id: string; time: string; details: string; txHash: string }[]>([]);

  // Modal / Transaction Progress States
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [modalSteps, setModalSteps] = useState<ModalStep[]>([]);
  const [gasSaved, setGasSaved] = useState<string>("0");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);


  // Discovered ERC-20 tokens from MonadScan when in real wallet mode
  type DiscoveredToken = { contractAddress: string; symbol: string; name: string; balance: string; decimals: string };
  const [walletTokens, setWalletTokens] = useState<DiscoveredToken[]>([]);
  const [tokensFetching, setTokensFetching] = useState<boolean>(false);

  // Initialize simulated price fluctuations
  useEffect(() => {
    const interval = setInterval(() => {
      setPrices(prev => {
        const next: Record<string, number> = { ...prev };
        const nextHist = { ...priceHistories };

        Object.keys(prev).forEach(key => {
          if (key === 'mUSDC') return; // Stablecoin
          const pct = (Math.random() - 0.5) * 0.008; // Max +/- 0.4% change
          next[key] = parseFloat((prev[key] * (1 + pct)).toFixed(2));

          // Append to history and shift
          const history = [...(nextHist[key] || [prev[key]])];
          history.push(next[key]);
          if (history.length > 8) history.shift();
          nextHist[key] = history;
        });

        setPriceHistories(nextHist);
        return next;
      });
    }, 6000);

    return () => clearInterval(interval);
  }, [priceHistories]);

  // Connect to MetaMask
  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const network = await provider.getNetwork();
        
        setAddress(accounts[0]);
        setChainId(Number(network.chainId));
        updateRealBalances(accounts[0], provider);
      } catch (err) {
        console.error("User rejected wallet connection", err);
      }
    } else {
      alert("No Ethereum wallet detected. Please install MetaMask.");
    }
  };

  // Disconnect: clear all wallet state
  const disconnectWallet = () => {
    setAddress(null);
    setBalance("0.0");
    setChainId(null);
    setTokenBalances({ mUSDC: "0", mETH: "0", mWBTC: "0", mLINK: "0" });
    setWalletTokens([]);
    setLogs([]);
  };

  // Switch account: re-request MetaMask accounts (opens picker in some wallets)
  const switchAccount = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        // Step 1: Revoke existing permissions so MetaMask forgets this site is connected.
        // Without this, wallet_requestPermissions is silently ignored when already connected.
        try {
          await window.ethereum.request({
            method: 'wallet_revokePermissions',
            params: [{ eth_accounts: {} }],
          });
        } catch {
          // wallet_revokePermissions may not be available in older MetaMask versions — that's ok
        }

        // Step 2: Request permissions again — this now reliably opens the account picker
        await window.ethereum.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }],
        });

        // Step 3: Get the newly selected account and update state
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        const network = await provider.getNetwork();
        if (accounts.length > 0) {
          setAddress(accounts[0]);
          setChainId(Number(network.chainId));
          updateRealBalances(accounts[0], provider);
        }
      } catch (err) {
        console.error("Account switch cancelled or rejected", err);
      }
    }
  };

  // Listen to network/account changes in real wallet mode
  useEffect(() => {
    if (typeof window.ethereum !== 'undefined') {
      const handleAccounts = (accounts: string[]) => {
        if (accounts.length === 0) {
          // Disconnected
          setAddress(null);
          setBalance("0.0");
        } else {
          setAddress(accounts[0]);
          const provider = new ethers.BrowserProvider(window.ethereum);
          updateRealBalances(accounts[0], provider);
        }
      };

      const handleChainChanged = (chainIdHex: string) => {
        setChainId(Number(chainIdHex));
        if (address) {
          const provider = new ethers.BrowserProvider(window.ethereum);
          updateRealBalances(address, provider);
        }
      };

      window.ethereum.on('accountsChanged', handleAccounts);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccounts);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, [address]);

  // Read real contract balances
  const updateRealBalances = async (userAddress: string, provider: ethers.BrowserProvider) => {
    try {
      const rawBalance = await provider.getBalance(userAddress);
      setBalance(ethers.formatEther(rawBalance));

      const updatedBalances: Record<string, string> = {};
      for (const token of TOKEN_METADATA) {
        const contractAddress = MOCK_ADDRESSES.tokens[token.symbol as keyof typeof MOCK_ADDRESSES.tokens];
        const contract = new ethers.Contract(contractAddress, ERC20_ABI, provider);
        const bal = await contract.balanceOf(userAddress);
        updatedBalances[token.symbol] = ethers.formatUnits(bal, token.decimals);
      }
      setTokenBalances(updatedBalances);
    } catch (err) {
      console.error("Error reading blockchain balances:", err);
    }
    // Also fetch all ERC-20 tokens from MonadScan
    fetchWalletTokens(userAddress);
  };

  // Fetch all ERC-20 token balances for an address using MonadScan API
  const fetchWalletTokens = async (userAddress: string) => {
    setTokensFetching(true);
    try {
      // MonadScan Etherscan-compatible API: get token list
      const url = `https://testnet.monadscan.com/api?module=account&action=tokenlist&address=${userAddress}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === '1' && Array.isArray(data.result)) {
        // Filter out zero-balance tokens and format
        const tokens = (data.result as any[])
          .filter((t: any) => t.balance && t.balance !== '0')
          .map((t: any) => ({
            contractAddress: t.contractAddress,
            symbol: t.symbol,
            name: t.name,
            decimals: t.decimals || '18',
            balance: ethers.formatUnits(t.balance, parseInt(t.decimals || '18'))
          }));
        setWalletTokens(tokens);
      } else {
        setWalletTokens([]);
      }
    } catch (err) {
      console.error('Failed to fetch wallet tokens from MonadScan:', err);
      setWalletTokens([]);
    } finally {
      setTokensFetching(false);
    }
  };

  // Trigger Faucet — always redirects to official Monad Testnet Faucet
  const handleFaucetMint = () => {
    window.open("https://faucet.monad.xyz/", "_blank", "noopener,noreferrer");
  };

  // Rebalance execution logic
  const handleRebalance = async () => {
    // Collect assets that have percentage > 0 selected
    const swapTargets = TOKEN_METADATA.filter(t => percentages[t.symbol] > 0);
    if (swapTargets.length === 0) {
      alert("Please choose at least one token to rebalance.");
      return;
    }

    setTxHash(null);
    setModalError(null);
    setModalOpen(true);

    // Build steps lists
    const approvalSteps = swapTargets.map(t => ({
      id: `approve-${t.symbol}`,
      name: `Approve Router to spend ${percentages[t.symbol]}% of ${t.symbol}`,
      status: 'pending' as const
    }));

    const executionStep = {
      id: 'execute-swap',
      name: `Execute batch rebalance of ${swapTargets.length} tokens into MON`,
      status: 'pending' as const
    };

    const finalSteps = [...approvalSteps, executionStep];
    setModalSteps(finalSteps);

    // Calculate Gas Saved: (~65,000 gas * (numTokens - 1))
    const saved = swapTargets.length > 1 
      ? `${((swapTargets.length - 1) * 65000).toLocaleString()} gas (~${((swapTargets.length - 1) * 0.0019).toFixed(4)} MON)`
      : "0 (Single asset swap)";
    setGasSaved(saved);

    {
      // Real Blockchain Swaps
      try {
        if (!address) throw new Error("Wallet not connected");
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        const tokensIn: string[] = [];
        const amountsIn: bigint[] = [];
        const minAmountsOut: bigint[] = [];

        // Sequential Approvals
        for (let i = 0; i < swapTargets.length; i++) {
          const t = swapTargets[i];
          const stepId = `approve-${t.symbol}`;
          
          const contractAddress = MOCK_ADDRESSES.tokens[t.symbol as keyof typeof MOCK_ADDRESSES.tokens];
          const contract = new ethers.Contract(contractAddress, ERC20_ABI, signer);
          
          const rawBalance = ethers.parseUnits(tokenBalances[t.symbol], t.decimals);
          const amountToSwap = (rawBalance * BigInt(percentages[t.symbol])) / BigInt(100);

          tokensIn.push(contractAddress);
          amountsIn.push(amountToSwap);
          minAmountsOut.push(0n); // Slip limit (0 for test simplicity)

          // Perform Approval transaction if allowance is insufficient
          const allowance = await contract.allowance(address, MOCK_ADDRESSES.router);
          if (allowance < amountToSwap) {
            // Set step status to active only if we are actually requesting approval
            setModalSteps(prev => prev.map(s => s.id === stepId ? { ...s, status: 'active' } : s));
            const approveTx = await contract.approve(MOCK_ADDRESSES.router, ethers.MaxUint256);
            await approveTx.wait();
          }

          setModalSteps(prev => prev.map(s => s.id === stepId ? { ...s, status: 'success' } : s));
        }

        // Executing Rebalance Swap via Router
        setModalSteps(prev => prev.map(s => s.id === 'execute-swap' ? { ...s, status: 'active' } : s));

        const routerContract = new ethers.Contract(MOCK_ADDRESSES.router, ROUTER_ABI, signer);
        const tx = await routerContract.rebalanceToMON(tokensIn, amountsIn, minAmountsOut);
        
        setTxHash(tx.hash);
        await tx.wait();

        setModalSteps(prev => prev.map(s => s.id === 'execute-swap' ? { ...s, status: 'success' } : s));
        await updateRealBalances(address, provider);

        // Log the completed transaction to the Activity section
        const swappedSymbols = swapTargets.map(t => `${percentages[t.symbol]}% ${t.symbol}`).join(', ');
        setLogs(prev => [{
          id: tx.hash,
          time: new Date().toLocaleTimeString(),
          details: `Swept ${swappedSymbols} → MON`,
          txHash: tx.hash
        }, ...prev]);

        // Clear sliders
        setPercentages({
          mUSDC: 0,
          mETH: 0,
          mWBTC: 0,
          mLINK: 0
        });

      } catch (err: any) {
        console.error("On-chain rebalance failed:", err);
        setModalError(err?.reason || err?.message || "Transaction reverted or rejected.");
        setModalSteps(prev => prev.map(s => s.status === 'active' ? { ...s, status: 'failed' } : s));
      }
    }
  };

  const handleSwitchNetwork = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x279f' }], // 10143 in hex is 0x279f
      });
    } catch (switchError: any) {
      // 4902 error code indicates the chain has not been added to the wallet
      if (switchError.code === 4902 || (switchError.data && switchError.data.originalError && switchError.data.originalError.code === 4902)) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x279f',
              chainName: 'Monad Testnet',
              nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
              rpcUrls: ['https://testnet-rpc.monad.xyz'],
              blockExplorerUrls: ['https://testnet.monadscan.com/']
            }],
          });
        } catch (addError) {
          console.error("Could not add Monad Testnet to wallet", addError);
        }
      } else {
        console.error("Failed to switch network", switchError);
      }
    }
  };

  // Convert allocations for Chart display
  const chartItems = TOKEN_METADATA.map(t => ({
    symbol: t.symbol,
    name: t.name,
    value: parseFloat(tokenBalances[t.symbol]) * prices[t.symbol],
    color: t.color
  }));

  // Calculate total USD value
  const totalUSD = chartItems.reduce((a, b) => a + b.value, 0) + (parseFloat(balance) * prices.MON);
  const selectedCount = TOKEN_METADATA.filter(t => percentages[t.symbol] > 0).length;
  const sweepValue = TOKEN_METADATA.reduce((sum, t) => {
    const bal = parseFloat(tokenBalances[t.symbol] || '0');
    const pct = percentages[t.symbol] / 100;
    return sum + bal * pct * prices[t.symbol];
  }, 0);

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">⚖️</div>
          <span className="sidebar-logo-text">Mon<span>Balance</span></span>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-item active">
            <svg className="sidebar-item-icon" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            Dashboard
          </div>
          <div className="sidebar-item">
            <svg className="sidebar-item-icon" viewBox="0 0 16 16" fill="none">
              <path d="M2 8h12M8 2l4 6-4 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Swap
          </div>
          <div className="sidebar-item">
            <svg className="sidebar-item-icon" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            History
          </div>
          <div className="sidebar-item">
            <svg className="sidebar-item-icon" viewBox="0 0 16 16" fill="none">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1z" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Docs
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="network-badge">
            <div className="network-dot" />
            Monad Testnet
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <h1>Portfolio Rebalancer</h1>
            <p>Sweep multiple tokens into MON in one transaction</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Faucet link */}
            <button
              className="btn btn-secondary"
              onClick={handleFaucetMint}
              style={{ fontSize: '0.78rem', padding: '0.45rem 0.85rem', color: 'var(--terra)', borderColor: 'var(--terra-border)' }}
            >
              Get Testnet MON
            </button>
            <WalletConnect
              address={address}
              balance={balance}
              chainId={chainId}
              onConnect={connectWallet}
              onSwitchNetwork={handleSwitchNetwork}
              onDisconnect={disconnectWallet}
              onSwitchAccount={switchAccount}
            />
          </div>
        </header>

        <div className="page-body">

          {/* KPI Stat Row */}
          <div className="stat-row">
            <div className="stat-card">
              <div className="stat-label">
                <svg className="stat-label-icon" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M7 4v3l2 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                Portfolio Value
              </div>
              <div className="stat-value">
                ${totalUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="stat-sub">
                <span className="stat-pill green">Live</span>
                across {TOKEN_METADATA.filter(t => parseFloat(tokenBalances[t.symbol] || '0') > 0).length + 1} assets
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-label">
                <svg className="stat-label-icon" viewBox="0 0 14 14" fill="none">
                  <path d="M2 10L7 4l3 4 2-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                MON Balance
              </div>
              <div className="stat-value">{parseFloat(balance).toFixed(4)}</div>
              <div className="stat-sub">
                <span className="stat-pill blue">MON</span>
                ${(parseFloat(balance) * prices.MON).toFixed(2)} USD
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-label">
                <svg className="stat-label-icon" viewBox="0 0 14 14" fill="none">
                  <rect x="2" y="6" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M5 6V4a2 2 0 014 0v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                Sweep Value
              </div>
              <div className="stat-value">${sweepValue.toFixed(2)}</div>
              <div className="stat-sub">
                <span className="stat-pill olive">{selectedCount} selected</span>
                to convert
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-label">
                <svg className="stat-label-icon" viewBox="0 0 14 14" fill="none">
                  <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                Gas Savings
              </div>
              <div className="stat-value" style={{ fontSize: selectedCount > 1 ? '1rem' : '1.35rem' }}>
                {selectedCount > 1
                  ? `~${((selectedCount - 1) * 0.0019).toFixed(4)} MON`
                  : '—'}
              </div>
              <div className="stat-sub">
                vs {selectedCount > 1 ? selectedCount : '—'} separate txns
              </div>
            </div>
          </div>

          {/* Main Grid */}
          <div className="dashboard-grid">

            {/* LEFT: Asset Table */}
            <div className="glass-card">
              <div className="card-header">
                <h3 className="card-title">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M1 4h14M1 8h14M1 12h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  Wallet Assets
                </h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => {
                      const next: Record<string, number> = {};
                      TOKEN_METADATA.forEach(t => {
                        next[t.symbol] = parseFloat(tokenBalances[t.symbol] || '0') > 0 ? 100 : 0;
                      });
                      setPercentages(next);
                    }}
                    style={{
                      background: 'var(--blue-dim)', border: '1px solid var(--blue-border)',
                      color: 'var(--blue)', borderRadius: '5px', padding: '0.28rem 0.65rem',
                      fontSize: '0.72rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s',
                      fontFamily: 'var(--font-sans)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(35,100,154,0.22)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--blue-dim)')}
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setPercentages({ mUSDC: 0, mETH: 0, mWBTC: 0, mLINK: 0 })}
                    style={{
                      background: 'transparent', border: '1px solid var(--border-mid)',
                      color: 'var(--text-muted)', borderRadius: '5px', padding: '0.28rem 0.65rem',
                      fontSize: '0.72rem', cursor: 'pointer', transition: 'all 0.15s',
                      fontFamily: 'var(--font-sans)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <table className="assets-table">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Trend</th>
                    <th style={{ textAlign: 'right' }}>Balance</th>
                    <th>Sweep %</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Native MON */}
                  <tr className="asset-row">
                    <td>
                      <div className="asset-info">
                        <span className="asset-icon" style={{ background: 'rgba(35,100,154,0.1)', color: 'var(--blue)', border: '1px solid var(--blue-border)', fontSize: '0.68rem' }}>MON</span>
                        <div className="asset-name-col">
                          <span className="asset-symbol">MON</span>
                          <span className="asset-fullname">Monad Native</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>${prices.MON.toFixed(2)}</span>
                        <Sparkline data={priceHistories.MON} color="#23649A" />
                      </div>
                    </td>
                    <td className="asset-balance">
                      <div>{parseFloat(balance).toFixed(4)}</div>
                      <div className="asset-value">${(parseFloat(balance) * prices.MON).toFixed(2)}</div>
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: '1.25rem' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: '600', color: 'var(--sage)', background: 'var(--sage-dim)', border: '1px solid rgba(135,174,153,0.2)', padding: '0.18rem 0.5rem', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>
                        TARGET
                      </span>
                    </td>
                  </tr>

                  {/* ERC-20 tokens */}
                  {TOKEN_METADATA.map((token) => {
                    const bal = tokenBalances[token.symbol] || '0';
                    const isZeroBal = parseFloat(bal) === 0;
                    return (
                      <tr key={token.symbol} className="asset-row">
                        <td>
                          <div className="asset-info">
                            <span className="asset-icon" style={{ background: token.color + '15', color: token.color, border: `1px solid ${token.color}30` }}>
                              {token.icon}
                            </span>
                            <div className="asset-name-col">
                              <span className="asset-symbol">{token.symbol}</span>
                              <span className="asset-fullname">{token.name}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>${prices[token.symbol].toFixed(token.symbol === 'mWBTC' ? 0 : 2)}</span>
                            <Sparkline data={priceHistories[token.symbol]} color={token.color} />
                          </div>
                        </td>
                        <td className="asset-balance">
                          <div style={{ color: isZeroBal ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                            {parseFloat(bal).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                          </div>
                          <div className="asset-value">${(parseFloat(bal) * prices[token.symbol]).toFixed(2)}</div>
                        </td>
                        <td>
                          <div className="slider-container">
                            <input
                              type="range" min="0" max="100"
                              value={percentages[token.symbol] || 0}
                              onChange={e => setPercentages(prev => ({ ...prev, [token.symbol]: parseInt(e.target.value) }))}
                              className="custom-slider"
                              disabled={isZeroBal}
                              style={{ opacity: isZeroBal ? 0.2 : 1 }}
                            />
                            <span className="percentage-badge" style={{ background: token.color + '15', color: isZeroBal ? 'var(--text-faint)' : token.color, borderColor: token.color + '35' }}>
                              {percentages[token.symbol]}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* RIGHT: Allocation + Sweep */}
            <div className="right-panel">
              {/* Donut Chart */}
              <div className="glass-card">
                <div className="card-header">
                  <h3 className="card-title">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
                      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                    Allocation
                  </h3>
                </div>
                <div className="allocation-donut-wrap">
                  <DonutChart items={chartItems} />
                </div>
                <div style={{ padding: '0 1.25rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '500' }}>Total Value</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', fontSize: '0.95rem', color: 'var(--off-white)' }}>
                    ${totalUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Sweep Panel */}
              <div className="glass-card" style={{ borderColor: selectedCount > 0 ? 'var(--blue-border)' : 'var(--border)' }}>
                <div className="card-header">
                  <h3 className="card-title">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                      <path d="M3 13L13 3M13 3H7M13 3v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Sweep to MON
                  </h3>
                </div>

                <div className="sweep-meta">
                  <div className="sweep-row">
                    <span className="sweep-label">Assets</span>
                    <span className="sweep-value">{selectedCount} / {TOKEN_METADATA.length}</span>
                  </div>
                  <div className="sweep-row">
                    <span className="sweep-label">Est. Receive</span>
                    <span className="sweep-value" style={{ color: 'var(--blue)' }}>
                      ~{(sweepValue / prices.MON).toFixed(4)} MON
                    </span>
                  </div>
                  <div className="sweep-row">
                    <span className="sweep-label">Value</span>
                    <span className="sweep-value">${sweepValue.toFixed(2)}</span>
                  </div>
                </div>

                <div className="sweep-action">
                  <button
                    className="btn btn-glow"
                    onClick={handleRebalance}
                    style={{ width: '100%' }}
                    disabled={selectedCount === 0 || !address}
                  >
                    {!address ? 'Connect Wallet First' : selectedCount === 0 ? 'Select Assets Above' : `Sweep ${selectedCount} Asset${selectedCount > 1 ? 's' : ''} → MON`}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Transaction Logs */}
          {logs.length > 0 && (
            <div className="glass-card">
              <div className="card-header">
                <h3 className="card-title">
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <path d="M2 4h12M2 8h8M2 12h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  Activity
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{logs.length} transaction{logs.length > 1 ? 's' : ''}</span>
              </div>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {logs.map(log => (
                  <div key={log.id} className="log-row">
                    <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-faint)', flexShrink: 0 }}>{log.time}</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{log.details}</span>
                    </div>
                    <a
                      href={`https://testnet.monadscan.com/tx/${log.txHash}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--blue)', textDecoration: 'none', flexShrink: 0 }}
                    >
                      {log.txHash.substring(0, 8)}… ↗
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Wallet Token Discovery */}
          {address && (
            <div className="glass-card">
              <div className="card-header">
                <h3 className="card-title">
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  All Wallet Tokens
                </h3>
                <button
                  onClick={() => address && fetchWalletTokens(address)}
                  disabled={tokensFetching}
                  style={{
                    background: 'transparent', border: '1px solid var(--border-mid)',
                    color: 'var(--text-muted)', borderRadius: '5px',
                    padding: '0.25rem 0.6rem', fontSize: '0.72rem',
                    cursor: tokensFetching ? 'not-allowed' : 'pointer', fontWeight: '500',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {tokensFetching ? 'Scanning…' : 'Refresh'}
                </button>
              </div>
              <div className="card-body">
                {tokensFetching && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '0.5rem 0' }}>
                    Scanning MonadScan for tokens…
                  </p>
                )}
                {!tokensFetching && walletTokens.length === 0 && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '0.5rem 0' }}>
                    No ERC-20 tokens found. Click Refresh or check{' '}
                    <a href={`https://testnet.monadscan.com/address/${address}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', textDecoration: 'none' }}>MonadScan</a>.
                  </p>
                )}
                {walletTokens.length > 0 && (
                  <div className="token-grid">
                    {walletTokens.map(tok => (
                      <a key={tok.contractAddress} href={`https://testnet.monadscan.com/token/${tok.contractAddress}?a=${address}`} target="_blank" rel="noopener noreferrer" className="token-tile">
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '0.82rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{tok.symbol}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.1rem', maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tok.name}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--off-white)' }}>
                            {parseFloat(tok.balance).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                          </div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--blue)', marginTop: '0.1rem' }}>↗</div>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transaction Progress Modal */}
      <RebalanceModal
        isOpen={modalOpen}
        steps={modalSteps}
        gasSaved={gasSaved}
        txHash={txHash}
        error={modalError}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}

