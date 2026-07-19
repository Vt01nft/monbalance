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
    `${addr.substring(0, 6)}…${addr.substring(addr.length - 4)}`;

  const isWrongNetwork = address && chainId !== null && chainId !== 10143 && chainId !== 5042002;

  if (!address) {
    return (
      <button className="btn btn-primary" onClick={onConnect}>
        Connect Wallet
      </button>
    );
  }

  if (isWrongNetwork) {
    return (
      <button
        className="btn btn-primary"
        onClick={onSwitchNetwork}
        style={{ background: '#A35C44', borderColor: '#A35C44' }}
      >
        Switch to Monad Testnet
      </button>
    );
  }

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      {/* Pill button */}
      <button
        onClick={() => setMenuOpen(prev => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.4rem 0.85rem',
          background: '#181616',
          border: `1px solid ${menuOpen ? '#4B4649' : '#2A2828'}`,
          borderRadius: '8px',
          cursor: 'pointer',
          outline: 'none',
          transition: 'border-color 0.18s, background 0.18s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = '#4B4649';
          e.currentTarget.style.background = '#1e1c1c';
        }}
        onMouseLeave={e => {
          if (!menuOpen) {
            e.currentTarget.style.borderColor = '#2A2828';
            e.currentTarget.style.background = '#181616';
          }
        }}
      >
        {/* Status dot */}
        <div style={{
          width: '7px', height: '7px', borderRadius: '50%',
          background: '#87AE99',
          flexShrink: 0,
        }} />

        {/* Address */}
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.82rem',
          fontWeight: '600',
          color: '#D7D8D7',
          letterSpacing: '-0.01em',
        }}>
          {formatAddress(address)}
        </span>

        {/* Divider */}
        <span style={{ color: '#2A2828', fontSize: '0.85rem', userSelect: 'none' }}>│</span>

        {/* Balance — compact */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            fontWeight: '600',
            color: '#23649A',
          }}>
            {parseFloat(balance).toFixed(3)}
          </span>
          <span style={{ fontSize: '0.6rem', color: '#6A6769', letterSpacing: '0.04em', fontFamily: 'var(--font-mono)' }}>MON</span>
        </div>

        {/* Chevron */}
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none"
          style={{ transition: 'transform 0.18s', transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0, marginLeft: '0.1rem' }}
        >
          <path d="M2 4L6 8L10 4" stroke="#6A6769" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown */}
      {menuOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          minWidth: '220px',
          background: '#181616',
          border: '1px solid #2A2828',
          borderRadius: '10px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.55)',
          zIndex: 1000,
          overflow: 'hidden',
        }}>
          {/* Header info */}
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #2A2828' }}>
            <div style={{ fontSize: '0.67rem', color: '#6A6769', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '0.35rem', fontWeight: '600' }}>
              Connected
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#ADADAE', marginBottom: '0.2rem' }}>
              {formatAddress(address)}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: '700', color: '#23649A' }}>
              {parseFloat(balance).toFixed(6)} <span style={{ color: '#6A6769', fontSize: '0.72rem' }}>MON</span>
            </div>
          </div>

          {/* View on Explorer */}
          <a
            href={`https://testnet.monadscan.com/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMenuOpen(false)}
            style={menuItemStyle}
            onMouseEnter={e => (e.currentTarget.style.background = '#1e1c1c')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <path d="M7 3H3a1 1 0 00-1 1v9a1 1 0 001 1h9a1 1 0 001-1V9" stroke="#ADADAE" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M10 2h4v4M14 2L8 8" stroke="#ADADAE" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>View on MonadScan</span>
          </a>

          {/* Switch Account */}
          <button
            onClick={() => { setMenuOpen(false); onSwitchAccount(); }}
            style={{ ...menuItemStyle as React.CSSProperties, width: '100%', border: 'none', textAlign: 'left', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#1e1c1c')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <path d="M1 8a7 7 0 1114 0A7 7 0 011 8z" stroke="#ADADAE" strokeWidth="1.5"/>
              <path d="M6 6l-2 2 2 2M10 6l2 2-2 2" stroke="#ADADAE" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Switch Account</span>
          </button>

          {/* Divider */}
          <div style={{ height: '1px', background: '#2A2828' }} />

          {/* Disconnect */}
          <button
            onClick={() => { setMenuOpen(false); onDisconnect(); }}
            style={{ ...menuItemStyle as React.CSSProperties, width: '100%', border: 'none', textAlign: 'left', cursor: 'pointer', color: '#A35C44' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(163,92,68,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 11l3-3-3-3M13 8H6" stroke="#A35C44" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Disconnect</span>
          </button>
        </div>
      )}
    </div>
  );
};

const menuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.6rem',
  padding: '0.65rem 1rem',
  color: '#ADADAE',
  fontSize: '0.835rem',
  textDecoration: 'none',
  background: 'transparent',
  transition: 'background 0.12s',
  fontFamily: 'var(--font-sans)',
  fontWeight: '500',
};
