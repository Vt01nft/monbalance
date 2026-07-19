import React, { useEffect, useRef } from 'react';

interface SparklineProps {
  data: number[];
  color?: string;
}

export const Sparkline: React.FC<SparklineProps> = ({ data, color = '#8B75FF' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear previous drawing
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (data.length < 2) return;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min === 0 ? 1 : max - min;

    // Configure high-DPI rendering if needed, or simple drawing
    const width = canvas.width;
    const height = canvas.height;

    const resolvedColor = color.startsWith('var(') ? '#8B75FF' : color;

    ctx.strokeStyle = resolvedColor;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = (i / (data.length - 1)) * width;
      // Flip y-axis since canvas (0,0) is top-left
      const y = height - 2 - ((data[i] - min) / range) * (height - 4);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Create subtle gradient area under the line
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, resolvedColor + '20'); // 12% opacity
    gradient.addColorStop(1, resolvedColor + '00'); // 0% opacity
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

  }, [data, color]);

  return (
    <canvas 
      ref={canvasRef} 
      width={70} 
      height={26} 
      className="sparkline-canvas"
      style={{ display: 'block' }}
    />
  );
};
