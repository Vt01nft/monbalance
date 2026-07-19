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
    const isCompleted = steps.every(s => s.status === 'success');
    if (isCompleted && isOpen) {
      const colors = ['#23649A', '#87AE99', '#C3CCB0', '#A35C44', '#D7D8D7'];
      const arr = Array.from({ length: 36 }).map((_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 1.8}s`,
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

        {/* Confetti */}
        {isCompleted && confetti.map(c => (
          <div
            key={c.id}
            className="confetti"
            style={{
              left: c.left,
              animationDelay: c.delay,
              backgroundColor: c.color,
              top: '-8px',
            }}
          />
        ))}

        {/* Header */}
        <div className="modal-header">
          {isCompleted
            ? 'Rebalance Complete'
            : hasFailed
            ? 'Transaction Failed'
            : 'Executing Rebalance'}
        </div>

        {/* Error box */}
        {error && (
          <div style={{
            background: 'rgba(163, 92, 68, 0.08)',
            border: '1px solid rgba(163, 92, 68, 0.3)',
            borderRadius: '8px',
            padding: '0.85rem 1rem',
            marginBottom: '1.25rem',
            fontSize: '0.8rem',
            color: '#A35C44',
            fontFamily: 'var(--font-mono)',
            wordBreak: 'break-all',
            lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}

        {/* Steps */}
        <div className="step-list">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`step-item ${step.status === 'active' ? 'active' : ''} ${step.status === 'success' ? 'success' : ''}`}
            >
              <div className="step-icon">
                {step.status === 'success'
                  ? '✓'
                  : step.status === 'failed'
                  ? '✕'
                  : step.status === 'active'
                  ? '●'
                  : '○'}
              </div>
              <div className="step-text">
                {step.name}
              </div>
            </div>
          ))}
        </div>

        {/* Success info */}
        {isCompleted && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div className="gas-saved-badge">
              <span>Gas saved:</span>
              <span>{gasSaved}</span>
            </div>

            {txHash && (
              <div style={{ fontSize: '0.78rem', color: '#6A6769', textAlign: 'center' }}>
                <span style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '500' }}>Transaction</span>
                <a
                  href={`https://testnet.monadscan.com/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: '#23649A',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    textDecoration: 'none',
                    borderBottom: '1px solid rgba(35,100,154,0.3)',
                    paddingBottom: '1px',
                  }}
                >
                  {txHash.substring(0, 18)}…{txHash.substring(txHash.length - 10)}
                </a>
              </div>
            )}
          </div>
        )}

        {/* Footer button / waiting message */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {(isCompleted || hasFailed) ? (
            <button
              className="btn btn-primary"
              onClick={onClose}
              style={{ width: '100%' }}
            >
              Close
            </button>
          ) : (
            <div style={{
              fontSize: '0.82rem',
              color: '#6A6769',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontFamily: 'var(--font-mono)',
            }}>
              <div className="step-icon" style={{ border: 'none', animation: 'pulse 1s infinite' }}>⧗</div>
              Waiting for wallet confirmation…
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
