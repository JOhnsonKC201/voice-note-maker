import { useRef, useEffect } from 'react';

const LIGHT_COLORS = ['99,102,241', '139,92,246', '59,130,246', '168,85,247', '236,72,153'];
const DARK_COLORS = ['129,140,248', '167,139,250', '96,165,250', '192,132,252', '244,114,182'];

export default function AnimatedBackground({ darkMode }) {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -1000, y: -1000, active: false });
  const starsRef = useRef([]);
  const shootingStarsRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animId;
    let w, h;

    const isMobile = window.innerWidth < 768;
    const STAR_COUNT = isMobile ? 150 : 250;
    const SPEED = 0.08;
    const MAX_DEPTH = 1000;
    const MOUSE_RADIUS = isMobile ? 200 : 250;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function createStar() {
      const colors = darkMode ? DARK_COLORS : LIGHT_COLORS;
      return {
        x: (Math.random() - 0.5) * w * 2,
        y: (Math.random() - 0.5) * h * 2,
        z: Math.random() * MAX_DEPTH,
        color: colors[Math.floor(Math.random() * colors.length)],
        baseSize: 9 + Math.random() * 7,
      };
    }

    function createStars() {
      starsRef.current = Array.from({ length: STAR_COUNT }, createStar);
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const mouse = mouseRef.current;
      const stars = starsRef.current;

      // Cursor glow
      if (mouse.active) {
        const glowGrad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, MOUSE_RADIUS);
        if (darkMode) {
          glowGrad.addColorStop(0, 'rgba(129,140,248,0.06)');
          glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        } else {
          glowGrad.addColorStop(0, 'rgba(99,102,241,0.04)');
          glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        }
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, MOUSE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw stars with 3D projection
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];

        // Move star toward viewer (slowly)
        s.z -= SPEED + (MAX_DEPTH - s.z) * 0.0005;

        // Slow anti-clockwise rotation around center
        const rotAngle = -0.0008; // anti-clockwise, gentle spiral
        const cosA = Math.cos(rotAngle);
        const sinA = Math.sin(rotAngle);
        const newX = s.x * cosA - s.y * sinA;
        const newY = s.x * sinA + s.y * cosA;
        s.x = newX;
        s.y = newY;

        // Respawn when it passes the viewer
        if (s.z <= 0) {
          s.x = (Math.random() - 0.5) * w * 2;
          s.y = (Math.random() - 0.5) * h * 2;
          s.z = MAX_DEPTH;
          const colors = darkMode ? DARK_COLORS : LIGHT_COLORS;
          s.color = colors[Math.floor(Math.random() * colors.length)];
          continue;
        }

        // 3D to 2D projection
        const scale = 400 / s.z;
        let sx = s.x * scale + cx;
        let sy = s.y * scale + cy;

        // Mouse repulsion — gently nudge stars away from cursor
        if (mouse.active) {
          const dx = sx - mouse.x;
          const dy = sy - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MOUSE_RADIUS && dist > 0) {
            const force = (1 - dist / MOUSE_RADIUS) * 1.2;
            const nx = dx / dist;
            const ny = dy / dist;
            s.x += (nx * force) / scale;
            s.y += (ny * force) / scale;
            sx = s.x * scale + cx;
            sy = s.y * scale + cy;
          }
        }

        // Previous position for streak
        const prevScale = 400 / (s.z + SPEED + (MAX_DEPTH - s.z) * 0.0005);
        const prevSx = s.x * prevScale + cx;
        const prevSy = s.y * prevScale + cy;

        // Skip if off screen
        if (sx < -50 || sx > w + 50 || sy < -50 || sy > h + 50) continue;

        // Closer = bigger, brighter
        const depth = 1 - s.z / MAX_DEPTH; // 0 = far, 1 = close
        const size = s.baseSize * scale * 0.8;
        const alpha = Math.min(depth * 2 + 0.3, 1) * (darkMode ? 1 : 0.95);

        // Draw motion streak
        const streakAlpha = alpha * 0.6;
        ctx.beginPath();
        ctx.moveTo(prevSx, prevSy);
        ctx.lineTo(sx, sy);
        ctx.strokeStyle = `rgba(${s.color},${streakAlpha})`;
        ctx.lineWidth = Math.max(size * 0.5, 0.5);
        ctx.lineCap = 'round';
        ctx.stroke();

        // Draw star dot — gradient orb with bright center
        const dotR = Math.max(size, 0.8);
        const dotGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, dotR);
        dotGrad.addColorStop(0, `rgba(255,255,255,${alpha * 0.95})`);
        dotGrad.addColorStop(0.3, `rgba(${s.color},${alpha})`);
        dotGrad.addColorStop(1, `rgba(${s.color},${alpha * 0.3})`);
        ctx.beginPath();
        ctx.arc(sx, sy, dotR, 0, Math.PI * 2);
        ctx.fillStyle = dotGrad;
        ctx.fill();

        // Soft outer glow
        if (depth > 0.15) {
          const glowAlpha = (depth - 0.15) * 0.6 * (darkMode ? 1 : 0.7);
          const glowR = dotR * 3.5;
          const glow = ctx.createRadialGradient(sx, sy, dotR * 0.5, sx, sy, glowR);
          glow.addColorStop(0, `rgba(${s.color},${glowAlpha * 0.5})`);
          glow.addColorStop(0.5, `rgba(${s.color},${glowAlpha * 0.15})`);
          glow.addColorStop(1, `rgba(${s.color},0)`);
          ctx.beginPath();
          ctx.arc(sx, sy, glowR, 0, Math.PI * 2);
          ctx.fillStyle = glow;
          ctx.fill();
        }

        // Connection lines between nearby stars (only close ones for performance)
        if (depth > 0.1) {
          for (let j = i + 1; j < stars.length; j++) {
            const s2 = stars[j];
            const depth2 = 1 - s2.z / MAX_DEPTH;
            if (depth2 < 0.1) continue;

            const scale2 = 400 / s2.z;
            const sx2 = s2.x * scale2 + cx;
            const sy2 = s2.y * scale2 + cy;

            const dx = sx - sx2;
            const dy = sy - sy2;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const connDist = isMobile ? 160 : 220;

            if (dist < connDist) {
              const lineAlpha = (1 - dist / connDist) * 0.88 * Math.min(depth + 0.52, depth2 + 0.52);

              // Fade out connections near cursor (break apart effect)
              let cursorFade = 1;
              let lineWidth = 1;
              if (mouse.active) {
                const midX = (sx + sx2) / 2;
                const midY = (sy + sy2) / 2;
                const mDist = Math.sqrt((midX - mouse.x) ** 2 + (midY - mouse.y) ** 2);
                if (mDist < MOUSE_RADIUS) {
                  cursorFade = mDist / MOUSE_RADIUS; // 0 at center, 1 at edge
                }
              }

              ctx.beginPath();
              ctx.moveTo(sx, sy);
              ctx.lineTo(sx2, sy2);
              ctx.strokeStyle = `rgba(${s.color},${lineAlpha * cursorFade})`;
              ctx.lineWidth = lineWidth;
              ctx.stroke();
            }
          }
        }
      }

      // Shooting stars
      const shooters = shootingStarsRef.current;
      if (Math.random() < (isMobile ? 0.009 : 0.006)) {
        const colors = darkMode ? DARK_COLORS : LIGHT_COLORS;
        const angle = Math.PI * 0.15 + Math.random() * Math.PI * 0.2;
        const speed = 8 + Math.random() * 10;
        shooters.push({
          x: Math.random() * w * 1.2 - w * 0.1,
          y: -10,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          decay: 0.006 + Math.random() * 0.01,
          length: isMobile ? 80 + Math.random() * 120 : 60 + Math.random() * 100,
          width: isMobile ? 2 + Math.random() * 3 : 1.5 + Math.random() * 2.5,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }

      for (let i = shooters.length - 1; i >= 0; i--) {
        const s = shooters[i];
        s.x += s.vx;
        s.y += s.vy;
        s.life -= s.decay;

        if (s.life <= 0 || s.x > w + 50 || s.y > h + 50) {
          shooters.splice(i, 1);
          continue;
        }

        const mag = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
        const tailX = s.x - (s.vx / mag) * s.length;
        const tailY = s.y - (s.vy / mag) * s.length;

        // Outer glow
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(tailX, tailY);
        ctx.strokeStyle = `rgba(${s.color},${s.life * 0.08})`;
        ctx.lineWidth = s.width * 5;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Main trail
        const grad = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
        grad.addColorStop(0, `rgba(255,255,255,${s.life * 0.9})`);
        grad.addColorStop(0.1, `rgba(${s.color},${s.life * 0.8})`);
        grad.addColorStop(0.5, `rgba(${s.color},${s.life * 0.3})`);
        grad.addColorStop(1, `rgba(${s.color},0)`);
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(tailX, tailY);
        ctx.strokeStyle = grad;
        ctx.lineWidth = s.width;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Head glow
        const headGrad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.width * 6);
        headGrad.addColorStop(0, `rgba(255,255,255,${s.life * 0.9})`);
        headGrad.addColorStop(0.3, `rgba(${s.color},${s.life * 0.4})`);
        headGrad.addColorStop(1, `rgba(${s.color},0)`);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.width * 6, 0, Math.PI * 2);
        ctx.fillStyle = headGrad;
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    }

    function onMouseMove(e) {
      mouseRef.current = { x: e.clientX, y: e.clientY, active: true };
    }
    function onTouchStart(e) {
      if (e.touches[0]) mouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, active: true };
    }
    function onTouchMove(e) {
      if (e.touches[0]) mouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, active: true };
    }
    function onTouchEnd() {
      setTimeout(() => { mouseRef.current = { x: -1000, y: -1000, active: false }; }, 800);
    }
    function onMouseLeave() {
      mouseRef.current = { x: -1000, y: -1000, active: false };
    }

    resize();
    createStars();
    draw();

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('mouseleave', onMouseLeave);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [darkMode]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0"
      style={{ touchAction: 'auto' }}
    />
  );
}
