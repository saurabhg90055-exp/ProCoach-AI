import { useRef, useMemo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './AIAvatar.css';

/**
 * AI Interviewer Avatar Component - Ultra Enhanced Professional Version
 * Features a confident, professional female interviewer with natural expressions
 * Responds to different states: idle, speaking, listening, thinking
 * Enhanced for video mode with expression-aware responses
 * New Design: Modern, approachable tech professional look
 */
const AIAvatar = ({ 
  state = 'idle', // 'idle' | 'speaking' | 'listening' | 'thinking' | 'happy' | 'concerned' | 'encouraging' | 'impressed' | 'nodding' | 'curious'
  audioLevel = 0,
  score = null,
  size = 'large', // 'small' | 'medium' | 'large'
  userExpression = null, // For video mode: { confidence, eyeContact, emotion, engagement }
  videoMode = false,
  showFeedback = false,
  interviewerName = 'Dr. Sarah Chen' // Professional interviewer persona
}) => {
  const containerRef = useRef(null);
  const [adaptiveState, setAdaptiveState] = useState(state);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isBlinking, setIsBlinking] = useState(false);
  const [headTilt, setHeadTilt] = useState(0);
  const [microExpression, setMicroExpression] = useState('neutral');
  const [breatheScale, setBreatheScale] = useState(1);
  
  // Natural breathing animation
  useEffect(() => {
    const breatheInterval = setInterval(() => {
      setBreatheScale(prev => prev === 1 ? 1.008 : 1);
    }, 2000);
    return () => clearInterval(breatheInterval);
  }, []);
  
  // Micro-expressions for more life-like appearance
  useEffect(() => {
    const microInterval = setInterval(() => {
      const expressions = ['neutral', 'slight-smile', 'attentive', 'interested'];
      setMicroExpression(expressions[Math.floor(Math.random() * expressions.length)]);
    }, 4000 + Math.random() * 2000);
    return () => clearInterval(microInterval);
  }, []);
  
  // Natural blinking effect with double-blink occasionally
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 120);
      // Occasional double blink for realism
      if (Math.random() > 0.7) {
        setTimeout(() => {
          setIsBlinking(true);
          setTimeout(() => setIsBlinking(false), 100);
        }, 200);
      }
    }, 2500 + Math.random() * 2500);
    
    return () => clearInterval(blinkInterval);
  }, []);
  
  // Subtle head movement when listening
  useEffect(() => {
    if (state === 'listening') {
      const tiltInterval = setInterval(() => {
        setHeadTilt(Math.random() * 6 - 3);
      }, 2000);
      return () => clearInterval(tiltInterval);
    } else {
      setHeadTilt(0);
    }
  }, [state]);
  
  // Adapt avatar state based on user expression in video mode
  // Always maintains confident, positive demeanor
  useEffect(() => {
    if (!videoMode || !userExpression) {
      setAdaptiveState(state);
      return;
    }
    
    const { confidence, eyeContact, emotion, engagement } = userExpression;
    
    // If AI is not speaking/thinking, adapt to user's state - always positive framing
    if (state === 'listening' || state === 'idle') {
      if (confidence < 40) {
        setAdaptiveState('encouraging');
        setFeedbackMessage('You\'re doing great! Keep going.');
      } else if (confidence > 80 && engagement > 70) {
        setAdaptiveState('impressed');
        setFeedbackMessage('Excellent confidence!');
      } else if (emotion === 'nervous') {
        setAdaptiveState('encouraging');
        setFeedbackMessage('You\'ve got this! Stay confident.');
      } else if (eyeContact < 30) {
        setFeedbackMessage('Great point - look here when ready');
        setAdaptiveState('curious');
      } else if (engagement > 60) {
        setAdaptiveState('nodding');
        setFeedbackMessage('');
      } else {
        setAdaptiveState('confident');
        setFeedbackMessage('');
      }
    } else {
      setAdaptiveState(state);
    }
  }, [state, userExpression, videoMode]);
  
  // Generate wave bars for speaking animation
  const waveBars = useMemo(() => 
    Array.from({ length: 16 }, (_, i) => ({
      id: i,
      delay: i * 0.03,
      height: 15 + Math.random() * 35
    })), []
  );

  // Determine avatar expression based on state and score
  // Note: Always maintain confident, positive expressions - no sad/concerned looks
  const getExpression = () => {
    if (adaptiveState === 'encouraging') return 'encouraging';
    if (adaptiveState === 'impressed') return 'impressed';
    if (adaptiveState === 'nodding') return 'nodding';
    if (adaptiveState === 'curious') return 'curious';
    if (adaptiveState === 'happy' || (score && score >= 8)) return 'happy';
    // Changed: 'concerned' now becomes 'thoughtful' - always positive framing
    if (adaptiveState === 'concerned' || adaptiveState === 'thoughtful' || (score && score < 5)) return 'thoughtful';
    if (adaptiveState === 'thinking') return 'thinking';
    if (adaptiveState === 'listening') return 'listening';
    if (adaptiveState === 'speaking') return 'speaking';
    // Default idle now shows confident smile
    return 'confident';
  };

  const expression = getExpression();

  // Eye animation variants - all expressions maintain confident, positive look
  const eyeVariants = {
    idle: {
      scaleY: 1,
      transition: { duration: 0.3 }
    },
    confident: {
      scaleY: 0.9,
      scaleX: 1.05,
      transition: { duration: 0.3 }
    },
    blink: {
      scaleY: [1, 0.1, 1],
      transition: { duration: 0.2 }
    },
    happy: {
      scaleY: 0.65,
      scaleX: 1.05,
      borderRadius: '50%',
      transition: { duration: 0.3 }
    },
    thoughtful: {
      scaleY: 0.95,
      scaleX: 1,
      transition: { duration: 0.3 }
    },
    listening: {
      scaleY: 1.05,
      scaleX: 1.08,
      transition: { duration: 0.3 }
    },
    encouraging: {
      scaleY: 0.75,
      scaleX: 1.1,
      transition: { duration: 0.3 }
    },
    impressed: {
      scaleY: 1.15,
      scaleX: 1.1,
      transition: { duration: 0.3 }
    },
    nodding: {
      scaleY: 0.9,
      scaleX: 1,
      transition: { duration: 0.3 }
    },
    curious: {
      scaleY: 1.1,
      scaleX: 1.05,
      transition: { duration: 0.3 }
    }
  };

  // Mouth animation based on state - Always maintains confident, professional smile
  // No sad/frowning expressions - interviewer always looks positive
  const getMouthVariant = () => {
    switch (expression) {
      case 'speaking':
        return {
          height: [10, 18, 12, 16, 10],
          width: [32, 26, 35, 28, 32],
          borderRadius: ['0 0 50% 50%', '50%', '0 0 45% 45%', '50%', '0 0 50% 50%'],
          transition: { duration: 0.25, repeat: Infinity }
        };
      case 'happy':
        return {
          height: 14,
          width: 38,
          borderRadius: '0 0 55% 55%',
          transition: { duration: 0.3 }
        };
      case 'encouraging':
        return {
          height: 12,
          width: 36,
          borderRadius: '0 0 55% 55%',
          transition: { duration: 0.3 }
        };
      case 'impressed':
        return {
          height: 14,
          width: 30,
          borderRadius: '50%',
          transition: { duration: 0.3 }
        };
      case 'nodding':
        return {
          height: 10,
          width: 32,
          borderRadius: '0 0 45% 45%',
          transition: { duration: 0.3 }
        };
      case 'curious':
        return {
          height: 10,
          width: 24,
          x: 2,
          borderRadius: '0 0 40% 40%',
          transition: { duration: 0.3 }
        };
      // Changed from 'concerned' to 'thoughtful' - still shows slight smile
      case 'thoughtful':
        return {
          height: 8,
          width: 28,
          borderRadius: '0 0 35% 35%',
          x: 3,
          transition: { duration: 0.3 }
        };
      case 'thinking':
        return {
          height: 9,
          width: 24,
          x: 8,
          borderRadius: '0 0 40% 40%',
          transition: { duration: 0.3 }
        };
      case 'listening':
        return {
          height: 10,
          width: 26,
          borderRadius: '0 0 45% 45%',
          transition: { duration: 0.3 }
        };
      // Default 'confident' state - warm, professional smile
      default:
        return {
          height: 10,
          width: 34,
          borderRadius: '0 0 50% 50%',
          transition: { duration: 0.3 }
        };
    }
  };

  // Floating animation for the whole avatar
  const floatAnimation = {
    y: [0, -8, 0],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: "easeInOut"
    }
  };

  // Pulse animation for listening state
  const pulseAnimation = {
    scale: [1, 1.05, 1],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: "easeInOut"
    }
  };

  // Glow effect based on state
  const getGlowColor = () => {
    switch (expression) {
      case 'speaking': return 'rgba(102, 126, 234, 0.6)';
      case 'listening': return 'rgba(72, 187, 120, 0.6)';
      case 'thinking': return 'rgba(237, 137, 54, 0.6)';
      case 'happy': return 'rgba(72, 187, 120, 0.8)';
      case 'concerned': return 'rgba(245, 101, 101, 0.5)';
      case 'encouraging': return 'rgba(56, 178, 172, 0.7)';
      case 'impressed': return 'rgba(159, 122, 234, 0.8)';
      default: return 'rgba(102, 126, 234, 0.3)';
    }
  };

  return (
    <div className={`ai-avatar-wrapper size-${size}`} ref={containerRef}>
      {/* Background glow effect */}
      <motion.div 
        className="avatar-glow"
        animate={{
          boxShadow: `0 0 70px 35px ${getGlowColor()}`,
          scale: state === 'speaking' ? [1, 1.15, 1] : breatheScale
        }}
        transition={{ duration: 0.6, repeat: state === 'speaking' ? Infinity : 0 }}
      />
      
      {/* Outer ambient ring */}
      <motion.div 
        className="avatar-ambient-ring"
        animate={{
          rotate: 360,
          opacity: state === 'speaking' ? 0.8 : 0.4
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      />
      
      {/* Main avatar container */}
      <motion.div 
        className={`ai-avatar-container ${expression} micro-${microExpression}`}
        animate={
          state === 'idle' ? { ...floatAnimation, scale: breatheScale } : 
          state === 'listening' ? pulseAnimation : 
          { scale: breatheScale }
        }
        style={{ rotate: headTilt }}
      >
        {/* Avatar head/face */}
        <motion.div 
          className="avatar-head"
          animate={{ scale: breatheScale }}
          transition={{ duration: 2, ease: "easeInOut" }}
        >
          {/* Face highlight for 3D depth */}
          <div className="face-highlight" />
          
          {/* Hair shine effect */}
          <div className="hair-shine" />
          {/* Animated background rings */}
          <div className="avatar-rings">
            {[1, 2, 3].map((ring) => (
              <motion.div
                key={ring}
                className={`ring ring-${ring}`}
                animate={{
                  scale: state === 'speaking' ? [1, 1.2, 1] : 1,
                  opacity: state === 'speaking' ? [0.3, 0.1, 0.3] : 0.15
                }}
                transition={{
                  duration: 1.5,
                  delay: ring * 0.2,
                  repeat: Infinity
                }}
              />
            ))}
          </div>

          {/* Face container */}
          <div className="avatar-face">
            {/* Eyes - always confident and warm */}
            <div className="eyes-container">
              <motion.div 
                className="eye left-eye"
                variants={eyeVariants}
                animate={
                  isBlinking ? 'blink' :
                  expression === 'happy' ? 'happy' : 
                  expression === 'encouraging' ? 'encouraging' :
                  expression === 'impressed' ? 'impressed' :
                  expression === 'thoughtful' ? 'thoughtful' : 
                  expression === 'listening' ? 'listening' : 
                  expression === 'curious' ? 'curious' :
                  expression === 'confident' ? 'confident' :
                  'idle'
                }
              >
                <motion.div 
                  className="pupil"
                  animate={{
                    x: expression === 'thinking' ? [0, 2, -2, 0] : expression === 'thoughtful' ? 2 : 0,
                    y: expression === 'listening' ? -1 : 0
                  }}
                  transition={{ duration: 2.5, repeat: expression === 'thinking' ? Infinity : 0 }}
                />
                <div className="eye-shine" />
              </motion.div>
              
              <motion.div 
                className="eye right-eye"
                variants={eyeVariants}
                animate={
                  isBlinking ? 'blink' :
                  expression === 'happy' ? 'happy' : 
                  expression === 'encouraging' ? 'encouraging' :
                  expression === 'impressed' ? 'impressed' :
                  expression === 'thoughtful' ? 'thoughtful' : 
                  expression === 'listening' ? 'listening' :
                  expression === 'curious' ? 'curious' :
                  expression === 'confident' ? 'confident' :
                  'idle'
                }
              >
                <motion.div 
                  className="pupil"
                  animate={{
                    x: expression === 'thinking' ? [0, 2, -2, 0] : expression === 'thoughtful' ? 2 : 0,
                    y: expression === 'listening' ? -1 : 0
                  }}
                  transition={{ duration: 2, repeat: expression === 'thinking' ? Infinity : 0 }}
                />
                <div className="eye-shine" />
              </motion.div>
            </div>

            {/* Eyebrows */}
            <div className="eyebrows-container">
              <motion.div 
                className="eyebrow left-eyebrow"
                animate={{
                  rotate: expression === 'thoughtful' ? -5 : expression === 'happy' ? 3 : expression === 'confident' ? 2 : 0,
                  y: expression === 'listening' ? -2 : 0
                }}
              />
              <motion.div 
                className="eyebrow right-eyebrow"
                animate={{
                  rotate: expression === 'thoughtful' ? 5 : expression === 'happy' ? -3 : expression === 'confident' ? -2 : 0,
                  y: expression === 'listening' ? -2 : 0
                }}
              />
            </div>

            {/* Professional Glasses */}
            <div className="glasses-container">
              <div className="glasses-frame">
                <div className="lens left-lens">
                  <div className="lens-reflection" />
                </div>
                <div className="glasses-bridge" />
                <div className="lens right-lens">
                  <div className="lens-reflection" />
                </div>
              </div>
              <div className="glasses-arms">
                <div className="arm left-arm" />
                <div className="arm right-arm" />
              </div>
            </div>

            {/* Mouth */}
            <motion.div 
              className="mouth"
              animate={getMouthVariant()}
            />

            {/* Speaking indicator waves */}
            <AnimatePresence>
              {state === 'speaking' && (
                <motion.div 
                  className="speaking-waves"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {waveBars.map((bar) => (
                    <motion.div
                      key={bar.id}
                      className="wave-bar"
                      animate={{
                        height: [4, bar.height * (0.5 + audioLevel), 4],
                        backgroundColor: ['#667eea', '#764ba2', '#667eea']
                      }}
                      transition={{
                        duration: 0.4,
                        delay: bar.delay,
                        repeat: Infinity
                      }}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Thinking dots */}
            <AnimatePresence>
              {state === 'thinking' && (
                <motion.div 
                  className="thinking-dots"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                >
                  {[0, 1, 2].map((dot) => (
                    <motion.div
                      key={dot}
                      className="thinking-dot"
                      animate={{
                        y: [0, -10, 0],
                        opacity: [0.4, 1, 0.4]
                      }}
                      transition={{
                        duration: 0.6,
                        delay: dot * 0.15,
                        repeat: Infinity
                      }}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Listening indicator */}
            <AnimatePresence>
              {state === 'listening' && (
                <motion.div 
                  className="listening-indicator"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <motion.div 
                    className="listening-circle"
                    animate={{
                      scale: [1, 1.3, 1],
                      opacity: [0.8, 0.3, 0.8]
                    }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <span className="listening-icon">🎧</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Status label */}
        <motion.div 
          className={`avatar-status status-${expression}`}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          key={expression}
        >
          {expression === 'speaking' && '🗣️ Speaking...'}
          {expression === 'listening' && '👂 Listening attentively...'}
          {expression === 'thinking' && '💭 Considering...'}
          {expression === 'happy' && '😊 Excellent!'}
          {expression === 'thoughtful' && '🤔 Let\'s explore that...'}
          {expression === 'encouraging' && '💪 You\'ve got this!'}
          {expression === 'impressed' && '⭐ Impressive!'}
          {expression === 'nodding' && '👍 I see...'}
          {expression === 'curious' && '🧐 Tell me more...'}
          {expression === 'confident' && `👩‍💼 ${interviewerName}`}
        </motion.div>

        {/* Video Mode Feedback Message */}
        <AnimatePresence>
          {videoMode && showFeedback && feedbackMessage && (
            <motion.div 
              className="video-feedback-message"
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.9 }}
            >
              {feedbackMessage}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Audio level indicator (when listening) */}
      {state === 'listening' && audioLevel > 0 && (
        <div className="audio-level-ring">
          <svg viewBox="0 0 100 100">
            <motion.circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="url(#audioGradient)"
              strokeWidth="2.5"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: Math.min(audioLevel * 1.5, 1) }}
              transition={{ duration: 0.1 }}
            />
            <defs>
              <linearGradient id="audioGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#16a34a" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      )}
    </div>
  );
};

export default AIAvatar;
