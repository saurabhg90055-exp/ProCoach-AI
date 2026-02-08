import React from 'react';
import { motion } from 'framer-motion';
import './LaptopIllustration.css';

const LaptopIllustration = () => {
    return (
        <div className="laptop-illustration">
            {/* Ambient glow effects */}
            <div className="ambient-glow glow-1"></div>
            <div className="ambient-glow glow-2"></div>
            <div className="ambient-glow glow-3"></div>
            
            {/* Floating particles */}
            <div className="particles">
                {[...Array(12)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="particle"
                        animate={{
                            y: [-20, -60, -20],
                            x: [0, (i % 2 === 0 ? 15 : -15), 0],
                            opacity: [0.3, 0.8, 0.3],
                            scale: [0.8, 1.2, 0.8]
                        }}
                        transition={{
                            duration: 3 + (i * 0.4),
                            repeat: Infinity,
                            delay: i * 0.3,
                            ease: "easeInOut"
                        }}
                        style={{
                            left: `${10 + (i * 7)}%`,
                            bottom: `${20 + (i % 4) * 10}%`
                        }}
                    />
                ))}
            </div>

            {/* Main scene */}
            <svg 
                viewBox="0 0 500 400" 
                className="illustration-svg"
                xmlns="http://www.w3.org/2000/svg"
            >
                <defs>
                    {/* Gradients */}
                    <linearGradient id="deskGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#2d3748" />
                        <stop offset="100%" stopColor="#1a202c" />
                    </linearGradient>
                    
                    <linearGradient id="laptopBodyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#4a5568" />
                        <stop offset="100%" stopColor="#2d3748" />
                    </linearGradient>
                    
                    <linearGradient id="screenGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#1a1a2e" />
                        <stop offset="50%" stopColor="#16213e" />
                        <stop offset="100%" stopColor="#0f0f23" />
                    </linearGradient>
                    
                    <linearGradient id="screenGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="rgba(99, 102, 241, 0.3)" />
                        <stop offset="50%" stopColor="rgba(139, 92, 246, 0.2)" />
                        <stop offset="100%" stopColor="rgba(236, 72, 153, 0.3)" />
                    </linearGradient>
                    
                    <linearGradient id="shirtGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#4f46e5" />
                    </linearGradient>
                    
                    <linearGradient id="hairGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#2d3748" />
                        <stop offset="100%" stopColor="#1a202c" />
                    </linearGradient>
                    
                    <linearGradient id="chairGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#374151" />
                        <stop offset="100%" stopColor="#1f2937" />
                    </linearGradient>
                    
                    {/* Filters */}
                    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                        <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                    
                    <filter id="screenGlowFilter" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="8" result="blur"/>
                        <feMerge>
                            <feMergeNode in="blur"/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                </defs>

                {/* Desk */}
                <motion.rect
                    x="50" y="300" width="400" height="20" rx="3"
                    fill="url(#deskGradient)"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                />
                
                {/* Desk legs */}
                <motion.rect
                    x="80" y="320" width="15" height="60" rx="2"
                    fill="#1a202c"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                />
                <motion.rect
                    x="405" y="320" width="15" height="60" rx="2"
                    fill="#1a202c"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                />

                {/* Chair back */}
                <motion.path
                    d="M180 320 Q180 240 220 200 L280 200 Q320 240 320 320"
                    fill="url(#chairGradient)"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                />
                
                {/* Chair seat hint */}
                <motion.ellipse
                    cx="250" cy="320" rx="70" ry="15"
                    fill="#374151"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.5 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                />

                {/* Person body (back view) */}
                <motion.g
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.5 }}
                >
                    {/* Shoulders and back */}
                    <path
                        d="M190 290 Q190 230 210 200 L290 200 Q310 230 310 290 Z"
                        fill="url(#shirtGradient)"
                    />
                    
                    {/* Shirt details */}
                    <path
                        d="M230 200 L230 290"
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth="1"
                        fill="none"
                    />
                    <path
                        d="M270 200 L270 290"
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth="1"
                        fill="none"
                    />
                    
                    {/* Neck */}
                    <rect x="230" y="165" width="40" height="40" rx="5" fill="#d4a574" />
                    
                    {/* Head (back view) */}
                    <ellipse cx="250" cy="140" rx="40" ry="45" fill="#d4a574" />
                    
                    {/* Hair */}
                    <path
                        d="M210 130 Q210 90 250 80 Q290 90 290 130 Q290 150 280 160 L220 160 Q210 150 210 130"
                        fill="url(#hairGradient)"
                    />
                    
                    {/* Ears */}
                    <ellipse cx="208" cy="145" rx="8" ry="12" fill="#d4a574" />
                    <ellipse cx="292" cy="145" rx="8" ry="12" fill="#d4a574" />
                </motion.g>

                {/* Arms reaching to laptop */}
                <motion.g
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.6 }}
                >
                    {/* Left arm */}
                    <path
                        d="M190 230 Q160 260 150 285"
                        stroke="url(#shirtGradient)"
                        strokeWidth="25"
                        strokeLinecap="round"
                        fill="none"
                    />
                    {/* Left hand */}
                    <circle cx="150" cy="288" r="12" fill="#d4a574" />
                    
                    {/* Right arm */}
                    <path
                        d="M310 230 Q340 260 350 285"
                        stroke="url(#shirtGradient)"
                        strokeWidth="25"
                        strokeLinecap="round"
                        fill="none"
                    />
                    {/* Right hand */}
                    <circle cx="350" cy="288" r="12" fill="#d4a574" />
                </motion.g>

                {/* Laptop */}
                <motion.g
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                >
                    {/* Laptop base */}
                    <path
                        d="M120 295 L130 285 L370 285 L380 295 Z"
                        fill="url(#laptopBodyGradient)"
                    />
                    
                    {/* Laptop screen frame */}
                    <rect
                        x="130" y="170" width="240" height="115" rx="5"
                        fill="url(#laptopBodyGradient)"
                    />
                    
                    {/* Screen glow effect */}
                    <motion.rect
                        x="140" y="178" width="220" height="100" rx="3"
                        fill="url(#screenGlow)"
                        filter="url(#screenGlowFilter)"
                        animate={{
                            opacity: [0.5, 0.8, 0.5]
                        }}
                        transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    />
                    
                    {/* Screen */}
                    <rect
                        x="140" y="178" width="220" height="100" rx="3"
                        fill="url(#screenGradient)"
                    />
                    
                    {/* Screen content - ProCoach AI branding */}
                    <g className="screen-content">
                        {/* Decorative lines on screen */}
                        <motion.line
                            x1="160" y1="200" x2="190" y2="200"
                            stroke="rgba(99, 102, 241, 0.5)"
                            strokeWidth="2"
                            strokeLinecap="round"
                            animate={{ opacity: [0.3, 0.7, 0.3] }}
                            transition={{ duration: 2, repeat: Infinity, delay: 0 }}
                        />
                        <motion.line
                            x1="160" y1="210" x2="180" y2="210"
                            stroke="rgba(139, 92, 246, 0.5)"
                            strokeWidth="2"
                            strokeLinecap="round"
                            animate={{ opacity: [0.3, 0.7, 0.3] }}
                            transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
                        />
                        
                        {/* Sparkle icon */}
                        <motion.g
                            animate={{ 
                                scale: [1, 1.1, 1],
                                rotate: [0, 5, 0, -5, 0]
                            }}
                            transition={{ 
                                duration: 3, 
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                            style={{ transformOrigin: '210px 238px' }}
                        >
                            <path
                                d="M210 228 L213 235 L220 238 L213 241 L210 248 L207 241 L200 238 L207 235 Z"
                                fill="#fbbf24"
                                filter="url(#glow)"
                            />
                        </motion.g>
                        
                        {/* ProCoach AI text */}
                        <motion.text
                            x="250" y="245"
                            textAnchor="middle"
                            className="procoach-text"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 1, delay: 1 }}
                        >
                            <tspan className="procoach-main">ProCoach</tspan>
                            <tspan className="procoach-ai" dx="5">AI</tspan>
                        </motion.text>
                        
                        {/* Subtitle */}
                        <motion.text
                            x="250" y="262"
                            textAnchor="middle"
                            className="procoach-subtitle"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.7 }}
                            transition={{ duration: 1, delay: 1.3 }}
                        >
                            Interview Coach
                        </motion.text>
                        
                        {/* Decorative elements on right */}
                        <motion.rect
                            x="310" y="200" width="30" height="20" rx="3"
                            fill="rgba(99, 102, 241, 0.3)"
                            animate={{ opacity: [0.3, 0.6, 0.3] }}
                            transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
                        />
                        <motion.rect
                            x="320" y="230" width="20" height="15" rx="2"
                            fill="rgba(236, 72, 153, 0.3)"
                            animate={{ opacity: [0.3, 0.6, 0.3] }}
                            transition={{ duration: 2.5, repeat: Infinity, delay: 1 }}
                        />
                    </g>
                    
                    {/* Webcam dot */}
                    <circle cx="250" cy="175" r="3" fill="#374151" />
                    <motion.circle
                        cx="250" cy="175" r="2"
                        fill="#22c55e"
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    />
                    
                    {/* Keyboard hint on base */}
                    <rect x="150" y="288" width="200" height="4" rx="1" fill="#1a202c" />
                </motion.g>

                {/* Coffee mug */}
                <motion.g
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, delay: 0.8 }}
                >
                    <rect x="390" y="275" width="25" height="25" rx="3" fill="#4a5568" />
                    <path
                        d="M415 280 Q425 280 425 290 Q425 300 415 300"
                        stroke="#4a5568"
                        strokeWidth="4"
                        fill="none"
                    />
                    {/* Steam */}
                    <motion.path
                        d="M395 270 Q398 260 395 250"
                        stroke="rgba(255,255,255,0.3)"
                        strokeWidth="2"
                        fill="none"
                        animate={{ 
                            opacity: [0, 0.3, 0],
                            y: [0, -5, -10]
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                    />
                    <motion.path
                        d="M405 272 Q402 262 405 252"
                        stroke="rgba(255,255,255,0.3)"
                        strokeWidth="2"
                        fill="none"
                        animate={{ 
                            opacity: [0, 0.3, 0],
                            y: [0, -5, -10]
                        }}
                        transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                    />
                </motion.g>

                {/* Plant */}
                <motion.g
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: 0.9 }}
                >
                    <rect x="60" y="260" width="30" height="40" rx="3" fill="#6b7280" />
                    <ellipse cx="75" cy="255" rx="20" ry="8" fill="#22c55e" />
                    <motion.path
                        d="M75 250 Q70 230 80 220"
                        stroke="#22c55e"
                        strokeWidth="3"
                        fill="none"
                        animate={{ rotate: [-2, 2, -2] }}
                        transition={{ duration: 3, repeat: Infinity }}
                        style={{ transformOrigin: '75px 255px' }}
                    />
                    <motion.path
                        d="M75 250 Q85 235 75 215"
                        stroke="#22c55e"
                        strokeWidth="3"
                        fill="none"
                        animate={{ rotate: [2, -2, 2] }}
                        transition={{ duration: 3.5, repeat: Infinity }}
                        style={{ transformOrigin: '75px 255px' }}
                    />
                </motion.g>
            </svg>

            {/* Additional floating elements */}
            <motion.div 
                className="floating-badge badge-1"
                animate={{ 
                    y: [-5, 5, -5],
                    rotate: [-3, 3, -3]
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
                <span className="badge-icon">🎯</span>
                <span className="badge-text">AI Powered</span>
            </motion.div>
            
            <motion.div 
                className="floating-badge badge-2"
                animate={{ 
                    y: [5, -5, 5],
                    rotate: [3, -3, 3]
                }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            >
                <span className="badge-icon">💡</span>
                <span className="badge-text">Smart Feedback</span>
            </motion.div>
            
            <motion.div 
                className="floating-badge badge-3"
                animate={{ 
                    y: [-8, 8, -8],
                    rotate: [-2, 2, -2]
                }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            >
                <span className="badge-icon">🚀</span>
                <span className="badge-text">Level Up</span>
            </motion.div>
        </div>
    );
};

export default LaptopIllustration;
