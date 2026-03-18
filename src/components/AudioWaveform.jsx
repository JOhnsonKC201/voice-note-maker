import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function AudioWaveform({ stream, darkMode }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!stream) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let animId;

    function draw() {
      const w = canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      const h = canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      const displayW = canvas.offsetWidth;
      const displayH = canvas.offsetHeight;

      analyser.getByteTimeDomainData(dataArray);
      ctx.clearRect(0, 0, displayW, displayH);

      // Main waveform
      const gradient = ctx.createLinearGradient(0, 0, displayW, 0);
      if (darkMode) {
        gradient.addColorStop(0, 'rgba(129,140,248,0.8)');
        gradient.addColorStop(0.5, 'rgba(192,132,252,0.8)');
        gradient.addColorStop(1, 'rgba(96,165,250,0.8)');
      } else {
        gradient.addColorStop(0, 'rgba(99,102,241,0.8)');
        gradient.addColorStop(0.5, 'rgba(168,85,247,0.8)');
        gradient.addColorStop(1, 'rgba(59,130,246,0.8)');
      }

      ctx.lineWidth = 2.5;
      ctx.strokeStyle = gradient;
      ctx.beginPath();

      const sliceWidth = displayW / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * displayH) / 2;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }

      ctx.lineTo(displayW, displayH / 2);
      ctx.stroke();

      // Reflection (subtle mirror below center)
      ctx.globalAlpha = 0.15;
      ctx.save();
      ctx.translate(0, displayH);
      ctx.scale(1, -1);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * displayH) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(displayW, displayH / 2);
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;

      animId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animId);
      audioCtx.close();
    };
  }, [stream, darkMode]);

  return (
    <motion.div
      className="w-full mt-4 rounded-lg overflow-hidden"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 80 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.4 }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ height: 80 }}
      />
    </motion.div>
  );
}
