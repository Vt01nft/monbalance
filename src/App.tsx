import React, { useState, useEffect } from 'react';

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

// Helper component for Docs sections
function DocSection({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="glass-card">
      <div className="card-header">
        <h3 className="card-title">
          <span style={{ fontSize: '0.95rem' }}>{icon}</span>
          {title}
        </h3>
      </div>
      <div className="card-body" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.7 }}>
        {children}
      </div>
    </div>
  );
}

export default function App() {
  // Navigation
  const [currentView, setCurrentView] = useState<'dashboard' | 'swap' | 'history' | 'docs'>('dashboard');

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
          <div className={`sidebar-item ${currentView === 'dashboard' ? 'active' : ''}`} onClick={() => setCurrentView('dashboard')} style={{ cursor: 'pointer' }}>
            <svg className="sidebar-item-icon" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            Dashboard
          </div>
          <div className={`sidebar-item ${currentView === 'swap' ? 'active' : ''}`} onClick={() => setCurrentView('swap')} style={{ cursor: 'pointer' }}>
            <svg className="sidebar-item-icon" viewBox="0 0 16 16" fill="none">
              <path d="M2 8h12M8 2l4 6-4 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Swap
          </div>
          <div className={`sidebar-item ${currentView === 'history' ? 'active' : ''}`} onClick={() => setCurrentView('history')} style={{ cursor: 'pointer' }}>
            <svg className="sidebar-item-icon" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            History
          </div>
          <div className={`sidebar-item ${currentView === 'docs' ? 'active' : ''}`} onClick={() => setCurrentView('docs')} style={{ cursor: 'pointer' }}>
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
            <h1>{currentView === 'dashboard' ? 'Portfolio Rebalancer' : currentView === 'swap' ? 'Swap' : currentView === 'history' ? 'Transaction History' : 'Documentation'}</h1>
            <p>{currentView === 'dashboard' ? 'Sweep multiple tokens into MON in one transaction' : currentView === 'swap' ? 'Coming soon — single asset swaps' : currentView === 'history' ? 'Your on-chain activity on Monad Testnet' : 'MonBalance — complete guide from A to Z'}</p>
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

          {/* ── SWAP VIEW ── */}
          {currentView === 'swap' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', textAlign: 'center' }}>
              <div style={{ width: 60, height: 60, background: 'var(--blue-dim)', border: '1px solid var(--blue-border)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M4 12h16M12 4l6 8-6 8" stroke="#23649A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', letterSpacing: '-0.02em' }}>Single-Asset Swap</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: 360, lineHeight: 1.6 }}>Direct token-to-token swaps are coming soon. For now, use the Dashboard to batch-sweep multiple tokens into MON in one transaction.</p>
              <button className="btn btn-primary" onClick={() => setCurrentView('dashboard')} style={{ marginTop: '0.5rem' }}>Go to Dashboard</button>
            </div>
          )}

          {/* ── HISTORY VIEW ── */}
          {currentView === 'history' && (
            <div className="glass-card">
              <div className="card-header">
                <h3 className="card-title">
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/><path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  Transaction History
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{logs.length} record{logs.length !== 1 ? 's' : ''}</span>
              </div>
              {logs.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <div style={{ marginBottom: '0.75rem', opacity: 0.4 }}>No transactions yet</div>
                  <button className="btn btn-primary" onClick={() => setCurrentView('dashboard')} style={{ fontSize: '0.82rem' }}>Go rebalance</button>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: '0 1.25rem', padding: '0.6rem 1.25rem', background: 'var(--bg)', borderBottom: '1px solid var(--border)', fontSize: '0.68rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-faint)' }}>
                    <span>Time</span><span>Details</span><span style={{ textAlign: 'right' }}>Tx Hash</span><span style={{ textAlign: 'right' }}>Explorer</span>
                  </div>
                  {logs.map(log => (
                    <div key={log.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: '0 1.25rem', alignItems: 'center', padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border)', fontSize: '0.82rem', transition: 'background 0.12s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0 }}>{log.time}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{log.details}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{log.txHash.substring(0, 10)}…</span>
                      <a href={`https://testnet.monadscan.com/tx/${log.txHash}`} target="_blank" rel="noopener noreferrer"
                        style={{ color: 'var(--blue)', fontSize: '0.72rem', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>↗ View</a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── DOCS VIEW ── */}
          {currentView === 'docs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 860 }}>

              {/* Hero */}
              <div className="glass-card" style={{ background: 'linear-gradient(135deg, rgba(35,100,154,0.08) 0%, rgba(163,92,68,0.05) 100%)', borderColor: 'var(--blue-border)' }}>
                <div className="card-body">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{ width: 48, height: 48, background: 'var(--blue-dim)', border: '1px solid var(--blue-border)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>⚖️</div>
                    <div>
                      <h2 style={{ fontSize: '1.2rem', fontWeight: '800', letterSpacing: '-0.03em', marginBottom: '0.2rem' }}>MonBalance Documentation</h2>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>One-click portfolio rebalancer on Monad Testnet — complete A to Z guide</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {[['Live App', 'https://monbalance.vercel.app'], ['GitHub', 'https://github.com/Vt01nft/monbalance'], ['MonadScan', 'https://testnet.monadscan.com'], ['Faucet', 'https://faucet.monad.xyz']].map(([label, url]) => (
                      <a key={label} href={url} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.75rem', background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', borderRadius: '5px', color: 'var(--blue)', fontSize: '0.75rem', fontWeight: '600', textDecoration: 'none' }}>
                        {label} ↗
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              {/* What is MonBalance */}
              <DocSection title="What is MonBalance?" icon="📖">
                <p>MonBalance is a <strong>DeFi portfolio rebalancer</strong> built natively on <strong>Monad Testnet</strong>. It lets you convert multiple ERC-20 tokens into MON (Monad's native gas token) in a single on-chain transaction — saving gas and reducing complexity.</p>
                <p style={{ marginTop: '0.75rem' }}>Instead of doing 4 separate swap transactions, MonBalance batches them all through a custom <code>MultiSwapRouter</code> smart contract. You approve once per token, then trigger one transaction that sweeps everything.</p>
              </DocSection>

              {/* How it works */}
              <DocSection title="How It Works" icon="⚙️">
                <ol style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {[
                    ['Connect Wallet', 'Connect MetaMask configured for Monad Testnet (Chain ID 10143). Your MON balance and all ERC-20 tokens are loaded automatically.'],
                    ['Get Testnet Tokens', 'Visit faucet.monad.xyz to get free testnet MON. Use it to interact with MockDEX to get mock tokens (mUSDC, mETH, mWBTC, mLINK).'],
                    ['Set Sweep Percentages', 'Use the sliders on each token row to choose what percentage to convert. Click "Select All" to sweep 100% of every token.'],
                    ['Execute the Sweep', 'Click the Sweep button. MonBalance first checks ERC-20 approvals (requesting any missing ones), then sends a single rebalanceToMON transaction.'],
                    ['Receive MON', 'The MultiSwapRouter executes all swaps atomically through MockDEX. MON is deposited directly into your wallet. View the transaction on MonadScan.'],
                  ].map(([step, desc], i) => (
                    <li key={i}><strong style={{ color: 'var(--blue)' }}>{step}:</strong> <span style={{ color: 'var(--text-secondary)' }}>{desc}</span></li>
                  ))}
                </ol>
              </DocSection>

              {/* Smart Contracts */}
              <DocSection title="Smart Contracts" icon="📜">
                <p style={{ marginBottom: '0.85rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>All contracts are deployed on Monad Testnet (Chain ID 10143) and verified on MonadScan.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {[
                    ['MultiSwapRouter', '0xf87e5B0b21717e818eE96B76e7a2C748cece848B', 'Core batch swap router. Accepts token arrays, executes swaps via MockDEX, returns MON.'],
                    ['MockDEX', '0x7dfe2eB83616C6aC0BA0dC2605E9A3fD80955178', 'Constant-product AMM. Provides swap pricing and execution for mock tokens.'],
                    ['mUSDC', '0x6A534AEa34D039c64d677264f7BD3Ee6F729AfE1', 'Mock USD Coin — 6 decimals, pegged to $1.00'],
                    ['mETH', '0x3A600CCa2A3692b099fC40d75751E09c280527b4', 'Mock Ethereum — 18 decimals, tracks ETH price'],
                    ['mWBTC', '0xB2Ed2BB7A61a0405F27893c5cE04efbac0A438A7', 'Mock Wrapped Bitcoin — 8 decimals, tracks BTC price'],
                    ['mLINK', '0xf49B7540c51430e4ba9E97ee7B82b3626081Ceb0', 'Mock Chainlink — 18 decimals, tracks LINK price'],
                  ].map(([name, addr, desc]) => (
                    <div key={name} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.3rem', flexWrap: 'wrap', gap: '0.3rem' }}>
                        <span style={{ fontWeight: '700', fontSize: '0.875rem', color: 'var(--text-primary)' }}>{name}</span>
                        <a href={`https://testnet.monadscan.com/address/${addr}`} target="_blank" rel="noopener noreferrer"
                          style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--blue)', textDecoration: 'none' }}>{addr.substring(0,10)}… ↗</a>
                      </div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{desc}</p>
                    </div>
                  ))}
                </div>
              </DocSection>

              {/* Network Setup */}
              <DocSection title="Add Monad Testnet to MetaMask" icon="🦊">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {[['Network Name', 'Monad Testnet'], ['RPC URL', 'https://testnet-rpc.monad.xyz'], ['Chain ID', '10143'], ['Currency Symbol', 'MON'], ['Block Explorer', 'https://testnet.monadscan.com']].map(([k, v]) => (
                    <div key={k} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.6rem 0.85rem' }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.2rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{v}</div>
                    </div>
                  ))}
                </div>
              </DocSection>

              {/* Tech Stack */}
              <DocSection title="Tech Stack" icon="🛠️">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.5rem' }}>
                  {[['React + TypeScript', 'Frontend UI'], ['Vite', 'Build tooling'], ['Ethers.js v6', 'Wallet & contract interaction'], ['Solidity 0.8.20', 'Smart contracts'], ['Hardhat', 'Contract compilation & deploy'], ['MonadScan API', 'Token discovery'], ['Vercel', 'Hosting & CI/CD'], ['GitHub Actions', 'Auto-deploy on push']].map(([tech, role]) => (
                    <div key={tech} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.6rem 0.85rem' }}>
                      <div style={{ fontWeight: '600', fontSize: '0.82rem', color: 'var(--text-primary)', marginBottom: '0.15rem' }}>{tech}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{role}</div>
                    </div>
                  ))}
                </div>
              </DocSection>

              {/* FAQ */}
              <DocSection title="FAQ" icon="❓">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {[
                    ['Is this on mainnet?', 'No. MonBalance runs exclusively on Monad Testnet. All tokens are mock tokens with no real value. Use the faucet to get test MON.'],
                    ['Do I need to approve each token?', 'Yes, once per token. MetaMask will prompt you to approve each ERC-20 before it can be swept. Approvals are unlimited, so you only do this once per token.'],
                    ['What slippage protection is there?', 'Currently minAmountsOut is set to 0 (no slippage floor). This is testnet-safe since prices are simulated. Mainnet versions would include configurable slippage.'],
                    ['Can I undo a sweep?', 'No. Blockchain transactions are irreversible. Double-check your percentages before confirming in MetaMask.'],
                    ['Why does the donut chart show $0?', 'You need testnet tokens. Click "Get Testnet MON" to visit the faucet, then interact with MockDEX to acquire mUSDC, mETH, mWBTC, or mLINK.'],
                    ['Can I sweep partial amounts?', 'Yes. Set sliders to any percentage from 1–100. A 50% sweep on mETH converts half your mETH balance to MON.'],
                    ['How do I switch wallets?', 'Click your address pill in the top-right, then choose "Switch Account". This triggers MetaMask\'s account picker.'],
                  ].map(([q, a]) => (
                    <div key={q} style={{ borderLeft: '2px solid var(--blue-border)', paddingLeft: '1rem' }}>
                      <div style={{ fontWeight: '600', fontSize: '0.875rem', marginBottom: '0.3rem', color: 'var(--text-primary)' }}>{q}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.6 }}>{a}</div>
                    </div>
                  ))}
                </div>
              </DocSection>

              {/* Resources */}
              <DocSection title="Resources & Links" icon="🔗">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.65rem' }}>
                  {[
                    ['🌐 Live App', 'https://monbalance.vercel.app', 'The deployed MonBalance interface'],
                    ['📦 GitHub', 'https://github.com/Vt01nft/monbalance', 'Full source code — open source'],
                    ['🚰 Faucet', 'https://faucet.monad.xyz', 'Get free testnet MON'],
                    ['🔍 MonadScan', 'https://testnet.monadscan.com', 'Monad Testnet block explorer'],
                    ['🟣 Monad', 'https://monad.xyz', 'Official Monad website'],
                    ['📖 Monad Docs', 'https://docs.monad.xyz', 'Official Monad developer docs'],
                  ].map(([label, url, desc]) => (
                    <a key={label} href={url} target="_blank" rel="noopener noreferrer"
                      style={{ textDecoration: 'none', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem 1rem', display: 'block', transition: 'border-color 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--blue-border)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                    >
                      <div style={{ fontWeight: '600', fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>{label}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{desc}</div>
                    </a>
                  ))}
                </div>
              </DocSection>
            </div>
          )}

          {/* ── DASHBOARD VIEW ── */}
          {currentView === 'dashboard' && <>

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
          </>
          }
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

