import React, { useEffect, useRef, useMemo } from 'react';

interface Particle {
  angle: number;
  radius: number;
  speed: number;
  decay: number;
  size: number;
  opacity: number;
  color: string;
}

interface AccretionDiskProps {
  size: number;
  color: string;
  particleCount?: number;
  className?: string;
}

export const AccretionDisk: React.FC<AccretionDiskProps> = ({ 
  size, 
  color, 
  particleCount = 120,
  className = ""
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const innerRadius = size / 2;
  const outerRadius = size * 1.4;

  const particles = useMemo(() => {
    const p: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = innerRadius + Math.random() * (outerRadius - innerRadius);
      p.push({
        angle,
        radius,
        speed: (0.005 + Math.random() * 0.015) * (Math.random() > 0.5 ? 1 : -1),
        decay: 0.02 + Math.random() * 0.05,
        size: 0.4 + Math.random() * 1.2,
        opacity: 0.2 + Math.random() * 0.6,
        color: color
      });
    }
    return p;
  }, [size, color, particleCount, innerRadius, outerRadius]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      particles.forEach(p => {
        // Spiral motion
        p.angle += p.speed;
        
        // Decaying orbit: move towards center
        p.radius -= p.decay;

        // Reset particle if it hits the "event horizon" (the button edge)
        if (p.radius < innerRadius) {
          p.radius = outerRadius;
          p.angle = Math.random() * Math.PI * 2;
        }

        const x = centerX + Math.cos(p.angle) * p.radius;
        const y = centerY + Math.sin(p.angle) * p.radius;

        // Fade out as it gets closer to the center
        const distanceFade = Math.min(1, (p.radius - innerRadius) / (outerRadius - innerRadius));
        
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity * distanceFade;
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [particles, innerRadius, outerRadius]);

  return (
    <canvas
      ref={canvasRef}
      width={size * 3}
      height={size * 3}
      className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0 ${className}`}
      style={{
        maskImage: `radial-gradient(circle, transparent ${innerRadius - 2}px, black ${innerRadius + 2}px)`,
        WebkitMaskImage: `radial-gradient(circle, transparent ${innerRadius - 2}px, black ${innerRadius + 2}px)`,
      }}
    />
  );
};
