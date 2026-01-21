import { useRef, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import './AudioVisualizer.css';

/**
 * Advanced Audio Visualizer Component
 * Multiple visualization modes for different states
 */
const AudioVisualizer = ({
  audioLevel = 0,
  audioData = null, // Frequency data array if available
  mode = 'bars', // 'bars' | 'wave' | 'circular' | 'orb' | 'minimal'
  isActive = false,
  color = 'primary', // 'primary' | 'success' | 'warning' | 'danger'
  size = 'medium' // 'small' | 'medium' | 'large'
}) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  // Color schemes
  const colors = {
    primary: { start: '#667eea', end: '#764ba2' },
    success: { start: '#48bb78', end: '#38a169' },
    warning: { start: '#ed8936', end: '#dd6b20' },
    danger: { start: '#f56565', end: '#c53030' }
  };

  // Generate bar data
  const bars = useMemo(() => 
    Array.from({ length: 32 }, (_, i) => ({
      id: i,
      delay: i * 0.02,
      baseHeight: 10 + Math.random() * 20
    })), []
  );

  // Circular visualizer points
  const circlePoints = useMemo(() => 
    Array.from({ length: 64 }, (_, i) => ({
      id: i,
      angle: (i / 64) * Math.PI * 2
    })), []
  );

  // Canvas-based wave visualization
  useEffect(() => {
    if (mode !== 'wave' || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    const drawWave = () => {
      ctx.clearRect(0, 0, width, height);
      
      if (!isActive) {
        // Draw flat line when inactive
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.strokeStyle = 'rgba(102, 126, 234, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
        return;
      }

      // Create gradient
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, colors[color].start);
      gradient.addColorStop(1, colors[color].end);

      ctx.beginPath();
      ctx.moveTo(0, height / 2);

      const amplitude = audioLevel * height * 0.4;
      const frequency = 0.02;
      const time = Date.now() * 0.003;

      for (let x = 0; x < width; x++) {
        const y = height / 2 + 
          Math.sin(x * frequency + time) * amplitude +
          Math.sin(x * frequency * 2 + time * 1.5) * amplitude * 0.3;
        ctx.lineTo(x, y);
      }

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Glow effect
      ctx.shadowColor = colors[color].start;
      ctx.shadowBlur = 10;
      ctx.stroke();

      animationRef.current = requestAnimationFrame(drawWave);
    };

    drawWave();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [mode, isActive, audioLevel, color]);

  // Render bar visualization
  const renderBars = () => (
    <div className={`visualizer-bars size-${size}`}>
      {bars.map((bar) => (
        <motion.div
          key={bar.id}
          className="v-bar"
          animate={{
            height: isActive 
              ? `${Math.max(4, bar.baseHeight + audioLevel * 60)}%` 
              : '4px',
            opacity: isActive ? 1 : 0.3
          }}
          transition={{
            duration: 0.1,
            delay: bar.delay
          }}
          style={{
            background: `linear-gradient(180deg, ${colors[color].start}, ${colors[color].end})`
          }}
        />
      ))}
    </div>
  );

  // Render wave visualization
  const renderWave = () => (
    <canvas 
      ref={canvasRef} 
      className={`visualizer-wave size-${size}`}
      width={300}
      height={80}
    />
  );

  // Render circular visualization
  const renderCircular = () => (
    <div className={`visualizer-circular size-${size}`}>
      <svg viewBox="0 0 200 200">
        <defs>
          <linearGradient id={`circGradient-${color}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors[color].start} />
            <stop offset="100%" stopColor={colors[color].end} />
          </linearGradient>
        </defs>
        {circlePoints.map((point) => {
          const baseRadius = 60;
          const variation = isActive ? audioLevel * 25 + Math.random() * 10 : 0;
          const radius = baseRadius + variation;
          const x = 100 + Math.cos(point.angle) * radius;
          const y = 100 + Math.sin(point.angle) * radius;
          const innerX = 100 + Math.cos(point.angle) * baseRadius;
          const innerY = 100 + Math.sin(point.angle) * baseRadius;
          
          // Ensure coordinates are valid numbers
          const safeX = isNaN(x) ? innerX : x;
          const safeY = isNaN(y) ? innerY : y;
          
          return (
            <motion.line
              key={point.id}
              x1={innerX}
              y1={innerY}
              x2={safeX}
              y2={safeY}
              stroke={`url(#circGradient-${color})`}
              strokeWidth={2}
              strokeLinecap="round"
              initial={{ opacity: 0.3, x2: innerX, y2: innerY }}
              animate={{ 
                opacity: isActive ? 0.8 : 0.3,
                x2: safeX,
                y2: safeY
              }}
              transition={{ duration: 0.1 }}
            />
          );
        })}
        <circle 
          cx="100" 
          cy="100" 
          r="55" 
          fill="none" 
          stroke={`url(#circGradient-${color})`}
          strokeWidth="2"
          opacity="0.5"
        />
      </svg>
    </div>
  );

  // Render orb visualization
  const renderOrb = () => (
    <div className={`visualizer-orb size-${size}`}>
      <motion.div 
        className="orb-core"
        animate={{
          scale: isActive ? [1, 1.1 + audioLevel * 0.3, 1] : 1,
          boxShadow: isActive 
            ? `0 0 ${30 + audioLevel * 40}px ${colors[color].start}, 0 0 ${60 + audioLevel * 80}px ${colors[color].end}`
            : `0 0 20px ${colors[color].start}`
        }}
        transition={{ duration: 0.3, repeat: isActive ? Infinity : 0 }}
        style={{
          background: `radial-gradient(circle, ${colors[color].start}, ${colors[color].end})`
        }}
      />
      {isActive && (
        <>
          <motion.div 
            className="orb-ring ring-1"
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.6, 0, 0.6]
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
            style={{ borderColor: colors[color].start }}
          />
          <motion.div 
            className="orb-ring ring-2"
            animate={{
              scale: [1, 1.8, 1],
              opacity: [0.4, 0, 0.4]
            }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
            style={{ borderColor: colors[color].end }}
          />
        </>
      )}
      {/* Particles */}
      {isActive && Array.from({ length: 8 }).map((_, i) => (
        <motion.div
          key={i}
          className="orb-particle"
          animate={{
            x: [0, Math.cos((i / 8) * Math.PI * 2) * (30 + audioLevel * 20), 0],
            y: [0, Math.sin((i / 8) * Math.PI * 2) * (30 + audioLevel * 20), 0],
            opacity: [0.8, 0.2, 0.8]
          }}
          transition={{
            duration: 1.5,
            delay: i * 0.1,
            repeat: Infinity
          }}
          style={{ background: colors[color].start }}
        />
      ))}
    </div>
  );

  // Render minimal visualization
  const renderMinimal = () => (
    <div className={`visualizer-minimal size-${size}`}>
      <div className="minimal-bars">
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            className="m-bar"
            animate={{
              height: isActive 
                ? `${20 + audioLevel * 60 + Math.random() * 20}%` 
                : '20%',
              backgroundColor: isActive ? colors[color].start : '#4a5568'
            }}
            transition={{ duration: 0.1, delay: i * 0.05 }}
          />
        ))}
      </div>
    </div>
  );

  const visualizers = {
    bars: renderBars,
    wave: renderWave,
    circular: renderCircular,
    orb: renderOrb,
    minimal: renderMinimal
  };

  return (
    <div className={`audio-visualizer mode-${mode} ${isActive ? 'active' : ''}`}>
      {visualizers[mode]?.() || renderBars()}
    </div>
  );
};

export default AudioVisualizer;
