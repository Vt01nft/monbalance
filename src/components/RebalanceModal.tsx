import React, { useEffect, useState } from 'react';

export interface ModalStep {
  id: string;
  name: string;
  status: 'pending' | 'active' | 'success' | 'failed';
}

interface RebalanceModalProps {
  isOpen: boolean;
  steps: ModalStep[];
  gasSaved: string;
  txHash: string | null;
  onClose: () => void;
  error: string | null;
}

export const RebalanceModal: React.FC<RebalanceModalProps> = ({
  isOpen,
  steps,
  gasSaved,
  txHash,
  onClose,
  error
}) => {
  const [confetti, setConfetti] = useState<{ id: number; left: string; delay: string; color: string }[]>([]);

  useEffect(() => {
    // Generate confetti details when rebalancing is successful
    const isCompleted = steps.every(s => s.status === 'success');
    if (isCompleted && isOpen) {
      const colors = ['#8B75FF', '#FF6B00', '#00E5FF', '#00E676', '#FFFF00'];
      const arr = Array.from({ length: 40 }).map((_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 2}s`,
        color: colors[Math.floor(Math.random() * colors.length)]
      }));
      setConfetti(arr);
    } else {
      setConfetti([]);
    }
  }, [steps, isOpen]);

  if (!isOpen) return null;

  const isCompleted = steps.every(s => s.status === 'success');
  const hasFailed = steps.some(s => s.status === 'failed') || error !== null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ position: 'relative' }}>
        {/* Render Confetti */}
        {isCompleted && confetti.map(c => (
          <div 
            key={c.id} 
            className="confetti" 
            style={{ 
              left: c.left, 
              animationDelay: c.delay,
              backgroundColor: c.color,
              top: '-10px'
            }}
          />
        ))}

        <div className="modal-header">
          {isCompleted ? '🎉 Rebalance Complete!' : hasFailed ? '❌ Rebalance Failed' : '⚖️ Executing Rebalance'}
        </div>

        {error && (
          <div style={{
            background: 'rgba(212, 96, 95, 0.1)',
            border: '1px solid #d4605f',
            borderRadius: '12px',
            padding: '1rem',
            marginBottom: '1.5rem',
            fontSize: '0.85rem',
            color: '#F48FB1',
            fontFamily: 'var(--font-mono)',
            wordBreak: 'break-all'
          }}>
            {error}
          </div>
        )}

        <div className="step-list">
          {steps.map((step) => (
            <div 
              key={step.id} 
              className={`step-item ${step.status === 'active' ? 'active' : ''} ${step.status === 'success' ? 'success' : ''}`}
            >
              <div className="step-icon">
                {step.status === 'success' ? '✓' : step.status === 'active' ? '●' : '○'}
              </div>
              <div className="step-text" style={{ color: step.status === 'pending' ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                {step.name}
              </div>
            </div>
          ))}
        </div>

        {isCompleted && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div className="gas-saved-badge">
              <span>🚀 Gas Saved:</span>
              <span>{gasSaved}</span>
            </div>
            
            {txHash && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                <span style={{ display: 'block', marginBottom: '0.2rem' }}>Transaction Hash:</span>
                <a 
                  href={`https://testnet.monadscan.com/tx/${txHash}`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', textDecoration: 'underline' }}
                >
                  {txHash.substring(0, 18)}...{txHash.substring(txHash.length - 12)}
                </a>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {(isCompleted || hasFailed) ? (
            <button className="btn btn-primary" onClick={onClose} style={{ width: '100%' }}>
              Close Window
            </button>
          ) : (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div className="step-icon" style={{ animation: 'pulse 1s infinite', border: 'none' }}>⌛</div>
              Confirming transaction(s) in wallet...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
