import React, { useState, useEffect, useRef, useMemo } from 'react';
import './AnimatedBlob.css';

const AnimatedBlob = ({ global = false, variant = 'default', enableScrollBlur = false }) => {
    const [scrollBlur, setScrollBlur] = useState(0);
    const rafRef = useRef(null);
    const lastScrollY = useRef(0);

    useEffect(() => {
        if (!enableScrollBlur) return;

        const handleScroll = () => {
            if (rafRef.current) return;
            
            rafRef.current = requestAnimationFrame(() => {
                const scrollY = window.scrollY;
                if (Math.abs(scrollY - lastScrollY.current) > 10) {
                    const maxBlur = 15;
                    const scrollThreshold = 500;
                    const blur = Math.min((scrollY / scrollThreshold) * maxBlur, maxBlur);
                    setScrollBlur(blur);
                    lastScrollY.current = scrollY;
                }
                rafRef.current = null;
            });
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            window.removeEventListener('scroll', handleScroll);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [enableScrollBlur]);

    // Variant-based settings (opacity removed - controlled by CSS now)
    const variantStyles = useMemo(() => {
        switch (variant) {
            case 'landing':
                return {
                    containerClass: 'variant-landing',
                    blur: scrollBlur
                };
            case 'blurred':
                return {
                    containerClass: 'variant-blurred',
                    blur: 12
                };
            default:
                return {
                    containerClass: '',
                    blur: 0
                };
        }
    }, [variant, scrollBlur]);

    // Memoize particles to prevent re-renders
    const particles = useMemo(() => 
        [...Array(8)].map((_, i) => ({
            id: i,
            left: `${20 + (i * 10) % 60}%`,
            top: `${15 + (i * 12) % 70}%`,
            delay: i * 0.8
        })), []
    );

    return (
        <div 
            className={`animated-blob-container ${global ? 'global-background' : ''} ${variantStyles.containerClass}`}
            style={{
                filter: variantStyles.blur > 0 ? `blur(${variantStyles.blur}px)` : 'none'
            }}
        >
            {/* Simplified SVG Blob - CSS animations for better performance */}
            <div className="blob-wrapper">
                <div className="blob-layer blob-outer"></div>
                <div className="blob-layer blob-middle"></div>
                <div className="blob-layer blob-inner"></div>
                <div className="blob-core"></div>
            </div>

            {/* CSS-based glow effects */}
            <div className="blob-glow-effects">
                <div className="glow-orb glow-cyan"></div>
                <div className="glow-orb glow-purple"></div>
                <div className="glow-orb glow-pink"></div>
            </div>

            {/* Reduced particle effects */}
            <div className="blob-particles">
                {particles.map(({ id, left, top, delay }) => (
                    <div
                        key={id}
                        className="particle"
                        style={{
                            left,
                            top,
                            animationDelay: `${delay}s`
                        }}
                    />
                ))}
            </div>
        </div>
    );
};

export default AnimatedBlob;
