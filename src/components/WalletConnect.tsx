import React, { useState, useRef, useEffect } from 'react';

interface WalletConnectProps {
  address: string | null;
  balance: string;
  chainId: number | null;
  onConnect: () => void;
  onSwitchNetwork: () => void;
  onDisconnect: () => void;
  onSwitchAccount: () => void;
}

export const WalletConnect: React.FC<WalletConnectProps> = ({
  address,
  balance,
  chainId,
  onConnect,
  onSwitchNetwork,
  onDisconnect,
  onSwitchAccount,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const formatAddress = (addr: string) =>
    `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;

  const isWrongNetwork = address && chainId !== null && chainId !== 10143 && chainId !== 5042002;

  // Not connected at all
  if (!address) {
    return (
      <button className="btn btn-primary btn-glow" onClick={onConnect}>
        🔌 Connect Wallet
      </button>
    );
  }

  // Wrong network
  if (isWrongNetwork) {
    return (
      <button
        className="btn btn-primary"
        onClick={onSwitchNetwork}
        style={{ background: 'var(--accent-orange)', boxShadow: '0 4px 15px rgba(255, 107, 0, 0.3)' }}
      >
        ⚠️ Switch to Monad Testnet
      </button>
    );
  }

  // Connected + correct network — show pill with dropdown
  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setMenuOpen(prev => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.45rem 0.9rem',
          background: 'rgba(139, 117, 255, 0.06)',
          border: '1px solid rgba(139, 117, 255, 0.28)',
          borderRadius: '12px',
          cursor: 'pointer',
          outline: 'none',
          transition: 'border-color 0.2s, background 0.2s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'rgba(139, 117, 255, 0.55)';
          e.currentTarget.style.background = 'rgba(139, 117, 255, 0.10)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'rgba(139, 117, 255, 0.28)';
          e.currentTarget.style.background = 'rgba(139, 117, 255, 0.06)';
        }}
      >
        {/* Green dot */}
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: 'var(--accent-green)',
          boxShadow: '0 0 8px var(--accent-green)',
          flexShrink: 0,
        }} />

        {/* Address */}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>
          {formatAddress(address)}
        </span>

        {/* Separator */}
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.85rem' }}>│</span>

        {/* Balance — stacked */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.2 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: '700', color: 'var(--accent-purple)' }}>
            {parseFloat(balance).toFixed(4)}
          </span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.03em' }}>MON</span>
        </div>

        {/* Chevron */}
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none"
          style={{ transition: 'transform 0.2s', transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}
        >
          <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown */}
      {menuOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 10px)',
          right: 0,
          minWidth: '230px',
          background: 'rgba(8, 8, 24, 0.97)',
          border: '1px solid rgba(139, 117, 255, 0.22)',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(139,117,255,0.06)',
          backdropFilter: 'blur(24px)',
          zIndex: 1000,
          overflow: 'hidden',
          padding: '0.5rem 0',
        }}>
          {/* Header */}
          <div style={{ padding: '0.65rem 1rem 0.6rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
              Connected Wallet
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.83rem', color: 'var(--accent-cyan)', marginBottom: '0.15rem' }}>
              {formatAddress(address)}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--accent-purple)', fontWeight: '700' }}>
              {parseFloat(balance).toFixed(6)} MON
            </div>
          </div>

          {/* View on Explorer */}
          <a
            href={`https://testnet.monadscan.com/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMenuOpen(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.7rem 1rem', color: 'var(--text-secondary)', fontSize: '0.875rem', textDecoration: 'none', transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,229,255,0.06)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ fontSize: '1rem' }}>↗</span>
            <span>View on MonadScan</span>
          </a>

          {/* Switch Account */}
          <button
            onClick={() => { setMenuOpen(false); onSwitchAccount(); }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', width: '100%', padding: '0.7rem 1rem', background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '0.875rem', cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(139,117,255,0.07)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ fontSize: '1rem' }}>🔄</span>
            <span>Switch Account</span>
          </button>

          {/* Divider */}
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '0.3rem 0' }} />

          {/* Disconnect */}
          <button
            onClick={() => { setMenuOpen(false); onDisconnect(); }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', width: '100%', padding: '0.7rem 1rem', background: 'transparent', border: 'none', color: '#FF6B6B', fontSize: '0.875rem', cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,107,107,0.07)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ fontSize: '1rem' }}>⏏</span>
            <span>Disconnect Wallet</span>
          </button>
        </div>
      )}
    </div>
  );
};
