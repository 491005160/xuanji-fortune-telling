import React, { useEffect, useRef } from 'react';

export const Starfield: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let stars: { x: number; y: number; z: number; pz: number }[] = [];
    const numStars = 400;
    const speed = 1.5;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    const initStars = () => {
      stars = [];
      for (let i = 0; i < numStars; i++) {
        stars.push({
          x: Math.random() * canvas.width * 2 - canvas.width,
          y: Math.random() * canvas.height * 2 - canvas.height,
          z: Math.random() * canvas.width,
          pz: Math.random() * canvas.width,
        });
      }
    };
    initStars();

    const draw = () => {
      // Create a slight trailing effect to simulate speed
      ctx.fillStyle = 'rgba(12, 12, 14, 0.3)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      for (let i = 0; i < numStars; i++) {
        const star = stars[i];

        star.pz = star.z;
        star.z -= speed;

        if (star.z < 1) {
          star.x = Math.random() * canvas.width * 2 - canvas.width;
          star.y = Math.random() * canvas.height * 2 - canvas.height;
          star.z = canvas.width;
          star.pz = canvas.width;
        }

        const sx = cx + (star.x / star.z) * cx;
        const sy = cy + (star.y / star.z) * cy;

        const px = cx + (star.x / star.pz) * cx;
        const py = cy + (star.y / star.pz) * cy;

        const mapZ = 1 - star.z / canvas.width;

        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(sx, sy);
        ctx.lineWidth = Math.max(0.5, mapZ * 2.5);
        ctx.strokeStyle = `rgba(212, 175, 55, ${mapZ * 0.6})`;
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0 opacity-40 mix-blend-screen"
    />
  );
};
