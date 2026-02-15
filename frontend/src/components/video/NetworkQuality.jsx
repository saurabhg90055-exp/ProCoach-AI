import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Wifi, WifiOff, AlertTriangle, Signal, SignalLow, SignalMedium, SignalHigh } from 'lucide-react';
import './NetworkQuality.css';

/**
 * Network Quality Indicator component
 * Monitors connection quality and displays real-time status
 */
const NetworkQuality = ({ 
    stream, 
    onQualityChange,
    showDetails = false,
    position = 'top-right',
    compact = false
}) => {
    const [quality, setQuality] = useState({
        level: 'good', // 'excellent', 'good', 'fair', 'poor', 'offline'
        latency: 0,
        bandwidth: null,
        packetLoss: 0,
        jitter: 0
    });
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [showTooltip, setShowTooltip] = useState(false);
    const [connectionType, setConnectionType] = useState(null);

    const measurementIntervalRef = useRef(null);
    const statsHistoryRef = useRef([]);

    // Monitor online/offline status
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => {
            setIsOnline(false);
            setQuality(prev => ({ ...prev, level: 'offline' }));
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Get connection info (Network Information API)
    useEffect(() => {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        
        if (connection) {
            const updateConnectionInfo = () => {
                setConnectionType({
                    effectiveType: connection.effectiveType, // '4g', '3g', '2g', 'slow-2g'
                    downlink: connection.downlink, // Mbps
                    rtt: connection.rtt, // ms round-trip time
                    saveData: connection.saveData
                });
            };

            updateConnectionInfo();
            connection.addEventListener('change', updateConnectionInfo);

            return () => {
                connection.removeEventListener('change', updateConnectionInfo);
            };
        }
    }, []);

    // Measure latency using fetch timing
    const measureLatency = useCallback(async () => {
        try {
            const start = performance.now();
            
            // Use health endpoint to measure RTT (more reliable than favicon)
            await fetch('https://procoach-ai.onrender.com/health', { 
                method: 'GET',
                cache: 'no-cache',
                mode: 'cors'
            });
            
            const latency = Math.round(performance.now() - start);
            return latency;
        } catch {
            // Fallback to a simple timing if backend not available
            return 50; // Assume decent latency
        }
    }, []);

    // Calculate quality level from metrics
    const calculateQualityLevel = useCallback((latency, bandwidth, packetLoss) => {
        if (!isOnline) return 'offline';
        
        // Score based on latency (lower is better)
        let latencyScore = 100;
        if (latency > 500) latencyScore = 0;
        else if (latency > 300) latencyScore = 25;
        else if (latency > 150) latencyScore = 50;
        else if (latency > 75) latencyScore = 75;

        // Score based on connection type
        let connectionScore = 100;
        if (connectionType) {
            switch (connectionType.effectiveType) {
                case '4g': connectionScore = 100; break;
                case '3g': connectionScore = 60; break;
                case '2g': connectionScore = 30; break;
                case 'slow-2g': connectionScore = 10; break;
                default: connectionScore = 80;
            }
        }

        // Score based on packet loss
        let packetScore = 100 - (packetLoss * 10);

        // Combined score
        const totalScore = (latencyScore * 0.4) + (connectionScore * 0.4) + (packetScore * 0.2);

        if (totalScore >= 85) return 'excellent';
        if (totalScore >= 65) return 'good';
        if (totalScore >= 40) return 'fair';
        return 'poor';
    }, [isOnline, connectionType]);

    // Main measurement loop
    useEffect(() => {
        const runMeasurement = async () => {
            if (!isOnline) {
                setQuality(prev => ({ ...prev, level: 'offline' }));
                return;
            }

            const latency = await measureLatency();
            
            if (latency !== null) {
                // Track history for jitter calculation
                statsHistoryRef.current.push({ latency, timestamp: Date.now() });
                if (statsHistoryRef.current.length > 10) {
                    statsHistoryRef.current.shift();
                }

                // Calculate jitter (variance in latency)
                let jitter = 0;
                if (statsHistoryRef.current.length > 1) {
                    const latencies = statsHistoryRef.current.map(s => s.latency);
                    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
                    jitter = Math.round(
                        Math.sqrt(
                            latencies.reduce((sum, l) => sum + Math.pow(l - avgLatency, 2), 0) / latencies.length
                        )
                    );
                }

                const bandwidth = connectionType?.downlink || null;
                const level = calculateQualityLevel(latency, bandwidth, 0);

                const newQuality = {
                    level,
                    latency,
                    bandwidth,
                    packetLoss: 0, // Would need WebRTC stats for accurate packet loss
                    jitter
                };

                setQuality(newQuality);

                if (onQualityChange) {
                    onQualityChange(newQuality);
                }
            }
        };

        // Initial measurement
        runMeasurement();

        // Periodic measurements
        measurementIntervalRef.current = setInterval(runMeasurement, 5000);

        return () => {
            if (measurementIntervalRef.current) {
                clearInterval(measurementIntervalRef.current);
            }
        };
    }, [isOnline, measureLatency, calculateQualityLevel, connectionType, onQualityChange]);

    // Get icon based on quality
    const getQualityIcon = () => {
        switch (quality.level) {
            case 'excellent':
                return <SignalHigh size={compact ? 14 : 18} />;
            case 'good':
                return <SignalMedium size={compact ? 14 : 18} />;
            case 'fair':
                return <SignalLow size={compact ? 14 : 18} />;
            case 'poor':
                return <Signal size={compact ? 14 : 18} />;
            case 'offline':
                return <WifiOff size={compact ? 14 : 18} />;
            default:
                return <Wifi size={compact ? 14 : 18} />;
        }
    };

    // Get color based on quality
    const getQualityColor = () => {
        switch (quality.level) {
            case 'excellent': return '#22c55e';
            case 'good': return '#84cc16';
            case 'fair': return '#eab308';
            case 'poor': return '#ef4444';
            case 'offline': return '#6b7280';
            default: return '#8b5cf6';
        }
    };

    // Get quality label
    const getQualityLabel = () => {
        switch (quality.level) {
            case 'excellent': return 'Excellent';
            case 'good': return 'Good';
            case 'fair': return 'Fair';
            case 'poor': return 'Poor';
            case 'offline': return 'Offline';
            default: return 'Checking...';
        }
    };

    return (
        <div 
            className={`network-quality ${position} ${compact ? 'compact' : ''}`}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            <motion.div 
                className={`quality-indicator ${quality.level}`}
                animate={{ scale: quality.level === 'poor' ? [1, 1.1, 1] : 1 }}
                transition={{ duration: 0.5, repeat: quality.level === 'poor' ? Infinity : 0 }}
                style={{ color: getQualityColor() }}
            >
                {getQualityIcon()}
                {!compact && <span className="quality-label">{getQualityLabel()}</span>}
            </motion.div>

            {/* Tooltip with details */}
            {(showTooltip || showDetails) && (
                <motion.div 
                    className="quality-tooltip"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                >
                    <div className="tooltip-header">
                        <span style={{ color: getQualityColor() }}>{getQualityIcon()}</span>
                        <span>Network: {getQualityLabel()}</span>
                    </div>
                    
                    <div className="tooltip-stats">
                        <div className="stat-row">
                            <span>Latency</span>
                            <span className={quality.latency > 200 ? 'warning' : ''}>
                                {quality.latency}ms
                            </span>
                        </div>
                        
                        {quality.jitter > 0 && (
                            <div className="stat-row">
                                <span>Jitter</span>
                                <span className={quality.jitter > 50 ? 'warning' : ''}>
                                    ±{quality.jitter}ms
                                </span>
                            </div>
                        )}
                        
                        {quality.bandwidth && (
                            <div className="stat-row">
                                <span>Bandwidth</span>
                                <span>{quality.bandwidth} Mbps</span>
                            </div>
                        )}
                        
                        {connectionType && (
                            <div className="stat-row">
                                <span>Connection</span>
                                <span>{connectionType.effectiveType?.toUpperCase()}</span>
                            </div>
                        )}
                    </div>

                    {quality.level === 'poor' && (
                        <div className="quality-warning">
                            <AlertTriangle size={14} />
                            <span>Connection unstable. Video quality may be affected.</span>
                        </div>
                    )}
                </motion.div>
            )}
        </div>
    );
};

export default NetworkQuality;
