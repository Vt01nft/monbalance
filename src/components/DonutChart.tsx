import React, { useState } from 'react';

interface ChartItem {
  symbol: string;
  name: string;
  value: number; // Token balance or USD value
  color: string;
}

interface DonutChartProps {
  items: ChartItem[];
}

export const DonutChart: React.FC<DonutChartProps> = ({ items }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const total = items.reduce((sum, item) => sum + item.value, 0);

  // If total is zero, render a gray empty circle placeholder
  if (total === 0) {
    return (
      <div style={{ position: 'relative', width: '200px', height: '200px', margin: '0 auto' }}>
        <svg width="100%" height="100%" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="38"
            fill="transparent"
            stroke="rgba(255, 255, 255, 0.05)"
            strokeWidth="8"
          />
        </svg>
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none'
        }}>
          <span style={{ fontSize: '0.8rem', color: '#6C6682' }}>Empty Portfolio</span>
        </div>
      </div>
    );
  }

  // Draw sectors
  let accumulatedAngle = 0;
  const radius = 38;
  const cx = 50;
  const cy = 50;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;

  const sectors = items.map((item, index) => {
    const percentage = item.value / total;
    const strokeLength = percentage * circumference;
    const strokeOffset = circumference - accumulatedAngle;
    accumulatedAngle += strokeLength;

    const isHovered = hoveredIndex === index;

    return (
      <circle
        key={item.symbol}
        cx={cx}
        cy={cy}
        r={radius}
        fill="transparent"
        stroke={item.color}
        strokeWidth={isHovered ? strokeWidth + 2 : strokeWidth}
        strokeDasharray={`${strokeLength} ${circumference - strokeLength}`}
        strokeDashoffset={strokeOffset}
        strokeLinecap="round"
        transform="rotate(-90 50 50)" // Start from top
        style={{
          cursor: 'pointer',
          transition: 'stroke-width 0.2s, filter 0.2s',
          filter: isHovered ? `drop-shadow(0 0 8px ${item.color})` : 'none'
        }}
        onMouseEnter={() => setHoveredIndex(index)}
        onMouseLeave={() => setHoveredIndex(null)}
      />
    );
  });

  // Determine what text to show in the center
  const centerItem = hoveredIndex !== null ? items[hoveredIndex] : null;
  const centerPercent = centerItem ? ((centerItem.value / total) * 100).toFixed(1) : '100';
  const centerLabel = centerItem ? centerItem.symbol : 'Total';
  const centerValue = centerItem 
    ? `$${centerItem.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
    : `$${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div style={{ position: 'relative', width: '220px', height: '220px', margin: '0 auto' }}>
      <svg width="100%" height="100%" viewBox="0 0 100 100">
        {sectors}
      </svg>
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none'
      }}>
        <span style={{ fontSize: '0.75rem', color: '#A6A0BB', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {centerLabel}
        </span>
        <span style={{ fontSize: '1.2rem', fontWeight: '700', color: '#F3F1F6', margin: '0.2rem 0' }}>
          {centerValue}
        </span>
        <span style={{ fontSize: '0.75rem', color: centerItem ? centerItem.color : '#8B75FF', fontWeight: '600' }}>
          {centerItem ? `${centerPercent}%` : 'Allocation'}
        </span>
      </div>
    </div>
  );
};
