import { useRef, useEffect } from 'react';

const LIGHT_COLORS = ['99,102,241', '139,92,246', '59,130,246', '168,85,247', '236,72,153'];
const DARK_COLORS = ['129,140,248', '167,139,250', '96,165,250', '192,132,252', '244,114,182'];

export default function AnimatedBackground({ darkMode }) {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -1000, y: -1000, active: false });
  const particlesRef = useRef([]);
  const shootingStarsRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animId;
    let w, h;

    const isMobile = window.innerWidth < 768;
    const PARTICLE_COUNT = isMobile ? 70 : 100;
    const CONNECTION_DIST = isMobile ? 140 : 180;
    const MOUSE_RADIUS = isMobile ? 200 : 250;
    const MOUSE_ATTRACT_RADIUS = isMobile ? 140 : 120;

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

    function createParticle(colors, randomZ) {
      const z = randomZ ? 0.15 + Math.random() * 0.85 : 0.15 + Math.random() * 0.15;
      const angle = Math.random() * Math.PI * 2;
      const spread = z * Math.max(w, h) * 0.55;
      const maxR = isMobile ? Math.random() * 4 + 2.5 : Math.random() * 3 + 2;
      const maxOpacity = isMobile ? Math.random() * 0.4 + 0.6 : Math.random() * 0.4 + 0.5;
      return {
        x: w / 2 + Math.cos(angle) * spread,
        y: h / 2 + Math.sin(angle) * spread,
        vx: (Math.cos(angle) * z * 0.3),
        vy: (Math.sin(angle) * z * 0.3),
        z,
        maxR,
        baseR: maxR * (0.3 + z * 0.7),
        r: maxR * (0.3 + z * 0.7),
        maxOpacity,
        opacity: maxOpacity * (0.2 + z * 0.8),
        baseOpacity: maxOpacity * (0.2 + z * 0.8),
        color: colors[Math.floor(Math.random() * colors.length)],
        pulse: Math.random() * Math.PI * 2,
        rotDir: -1,
        rotSpeed: 0.0003 + Math.random() * 0.0004,
      };
    }

    function createParticles() {
      const colors = darkMode ? DARK_COLORS : LIGHT_COLORS;
      particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => createParticle(colors, true));
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      const particles = particlesRef.current;
      const mouse = mouseRef.current;

      // Draw a soft glow around cursor/touch
      if (mouse.active) {
        const glowGrad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, MOUSE_RADIUS);
        if (darkMode) {
          glowGrad.addColorStop(0, 'rgba(129,140,248,0.08)');
          glowGrad.addColorStop(0.5, 'rgba(167,139,250,0.03)');
          glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        } else {
          glowGrad.addColorStop(0, 'rgba(99,102,241,0.06)');
          glowGrad.addColorStop(0.5, 'rgba(139,92,246,0.02)');
          glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        }
        ctx.fillStyle = glowGrad;
        ctx.fillRect(mouse.x - MOUSE_RADIUS, mouse.y - MOUSE_RADIUS, MOUSE_RADIUS * 2, MOUSE_RADIUS * 2);
      }

      const centerX = w / 2;
      const centerY = h / 2;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Advance depth — particle moves "toward" you
        p.z += 0.002 + p.z * 0.003;

        // Scale size and opacity based on depth (closer = bigger + brighter)
        p.baseR = p.maxR * (0.3 + p.z * 0.7);
        p.opacity = p.maxOpacity * (0.2 + p.z * 0.8);

        // Pulse
        p.pulse += 0.015;
        const pulseFactor = 0.3 * Math.sin(p.pulse) + 1;
        p.r = p.baseR * pulseFactor;

        // Anti-clockwise rotation + outward drift from center
        const cdx = p.x - centerX;
        const cdy = p.y - centerY;
        const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
        if (cdist > 1) {
          const outwardDrift = 0.04 + p.z * 0.06; // faster outward as they get closer
          // Tangential force (anti-clockwise)
          p.vx += (cdy / cdist) * p.rotDir * p.rotSpeed * cdist * 0.008;
          p.vy += (-cdx / cdist) * p.rotDir * p.rotSpeed * cdist * 0.008;
          // Outward drift from center
          p.vx += (cdx / cdist) * outwardDrift * 0.015;
          p.vy += (cdy / cdist) * outwardDrift * 0.015;
        }

        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (mouse.active && dist < MOUSE_RADIUS && dist > 0) {
          if (dist < MOUSE_ATTRACT_RADIUS) {
            const attractForce = (MOUSE_ATTRACT_RADIUS - dist) / MOUSE_ATTRACT_RADIUS * 0.008;
            p.vx += (-dy / dist) * attractForce * 2;
            p.vy += (dx / dist) * attractForce * 2;
            p.vx -= (dx / dist) * attractForce * 0.5;
            p.vy -= (dy / dist) * attractForce * 0.5;
          } else {
            const repelForce = (MOUSE_RADIUS - dist) / MOUSE_RADIUS * 0.04;
            p.vx += (dx / dist) * repelForce;
            p.vy += (dy / dist) * repelForce;
          }
          const proximity = 1 - dist / MOUSE_RADIUS;
          p.baseOpacity = p.opacity + proximity * 0.5;
          p.r = p.baseR * pulseFactor * (1 + proximity * 1.5);
        } else {
          p.baseOpacity = p.opacity;
        }

        // Damping
        p.vx *= 0.99;
        p.vy *= 0.99;

        // Speed limit
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > 2.5) {
          p.vx = (p.vx / speed) * 2.5;
          p.vy = (p.vy / speed) * 2.5;
        }

        p.x += p.vx;
        p.y += p.vy;

        // Respawn at center when off screen or fully "arrived"
        if (p.z >= 1 || p.x < -40 || p.x > w + 40 || p.y < -40 || p.y > h + 40) {
          const colors = darkMode ? DARK_COLORS : LIGHT_COLORS;
          const fresh = createParticle(colors, false);
          Object.assign(p, fresh);
          continue;
        }

        // Draw particle with glow
        const glowSize = p.r * 3;
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize);
        grad.addColorStop(0, `rgba(${p.color},${p.baseOpacity})`);
        grad.addColorStop(0.4, `rgba(${p.color},${p.baseOpacity * 0.3})`);
        grad.addColorStop(1, `rgba(${p.color},0)`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, glowSize, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Solid core
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color},${Math.min(p.baseOpacity * 1.5, 1)})`;
        ctx.fill();

        // Connections
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const cdx = p.x - p2.x;
          const cdy = p.y - p2.y;
          const cdist = Math.sqrt(cdx * cdx + cdy * cdy);

          if (cdist < CONNECTION_DIST) {
            const alpha = (1 - cdist / CONNECTION_DIST) * 0.45;

            // Lines near cursor are brighter and thicker
            let lineWidth = 0.8;
            let lineAlpha = alpha;
            if (mouse.active) {
              const midX = (p.x + p2.x) / 2;
              const midY = (p.y + p2.y) / 2;
              const midDist = Math.sqrt((midX - mouse.x) ** 2 + (midY - mouse.y) ** 2);
              if (midDist < MOUSE_RADIUS) {
                const boost = 1 - midDist / MOUSE_RADIUS;
                lineWidth = 0.8 + boost * 2;
                lineAlpha = alpha + boost * 0.3;
              }
            }

            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(${p.color},${lineAlpha})`;
            ctx.lineWidth = lineWidth;
            ctx.stroke();
          }
        }

        // Draw connections to cursor when close enough
        if (mouse.active && dist < MOUSE_ATTRACT_RADIUS * 1.5) {
          const alpha = (1 - dist / (MOUSE_ATTRACT_RADIUS * 1.5)) * 0.2;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(${p.color},${alpha})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }

      // Shooting stars
      const stars = shootingStarsRef.current;

      // Spawn shooting stars more often on mobile
      if (Math.random() < (isMobile ? 0.009 : 0.006)) {
        const colors = darkMode ? DARK_COLORS : LIGHT_COLORS;
        const angle = Math.PI * 0.15 + Math.random() * Math.PI * 0.2;
        const speed = 6 + Math.random() * 8;
        stars.push({
          x: Math.random() * w * 1.2 - w * 0.1,
          y: -10,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          decay: 0.008 + Math.random() * 0.012,
          length: isMobile ? 60 + Math.random() * 100 : 40 + Math.random() * 80,
          width: isMobile ? 1.5 + Math.random() * 2.5 : 1 + Math.random() * 2,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }

      // Draw and update shooting stars
      for (let i = stars.length - 1; i >= 0; i--) {
        const s = stars[i];
        s.x += s.vx;
        s.y += s.vy;
        s.life -= s.decay;

        if (s.life <= 0 || s.x > w + 50 || s.y > h + 50) {
          stars.splice(i, 1);
          continue;
        }

        // Trail
        const tailX = s.x - (s.vx / Math.sqrt(s.vx * s.vx + s.vy * s.vy)) * s.length;
        const tailY = s.y - (s.vy / Math.sqrt(s.vx * s.vx + s.vy * s.vy)) * s.length;

        const grad = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
        grad.addColorStop(0, `rgba(${s.color},${s.life * 0.9})`);
        grad.addColorStop(0.3, `rgba(${s.color},${s.life * 0.4})`);
        grad.addColorStop(1, `rgba(${s.color},0)`);

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(tailX, tailY);
        ctx.strokeStyle = grad;
        ctx.lineWidth = s.width;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Bright head glow
        const headGrad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.width * 4);
        headGrad.addColorStop(0, `rgba(255,255,255,${s.life * 0.8})`);
        headGrad.addColorStop(0.5, `rgba(${s.color},${s.life * 0.3})`);
        headGrad.addColorStop(1, `rgba(${s.color},0)`);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.width * 4, 0, Math.PI * 2);
        ctx.fillStyle = headGrad;
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    }

    function onMouseMove(e) {
      mouseRef.current = { x: e.clientX, y: e.clientY, active: true };
    }

    function onTouchStart(e) {
      if (e.touches[0]) {
        mouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, active: true };
      }
    }

    function onTouchMove(e) {
      if (e.touches[0]) {
        mouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, active: true };
      }
    }

    function onTouchEnd() {
      // Keep particles gently drifting back for a moment
      setTimeout(() => {
        mouseRef.current = { x: -1000, y: -1000, active: false };
      }, 800);
    }

    function onMouseLeave() {
      mouseRef.current = { x: -1000, y: -1000, active: false };
    }

    resize();
    createParticles();
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
