import React, { useState, useEffect } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { Users, Zap, MessageSquare, Clock } from 'lucide-react';
import './LiveCounter.css';

const AnimatedNumber = ({ value, duration = 2 }) => {
    const spring = useSpring(0, { duration: duration * 1000 });
    const display = useTransform(spring, (latest) => Math.floor(latest).toLocaleString());
    const [currentValue, setCurrentValue] = useState('0');

    useEffect(() => {
        spring.set(value);
    }, [spring, value]);

    useEffect(() => {
        const unsubscribe = display.on('change', (latest) => {
            setCurrentValue(latest);
        });
        return () => unsubscribe();
    }, [display]);

    return <span>{currentValue}</span>;
};

const LiveCounter = () => {
    const [stats, setStats] = useState({
        activeUsers: 127,
        interviewsToday: 1438,
        questionsAsked: 28749,
        avgSessionTime: 24
    });

    // Simulate live updates
    useEffect(() => {
        const interval = setInterval(() => {
            setStats(prev => ({
                activeUsers: prev.activeUsers + Math.floor(Math.random() * 3) - 1,
                interviewsToday: prev.interviewsToday + Math.floor(Math.random() * 5),
                questionsAsked: prev.questionsAsked + Math.floor(Math.random() * 20),
                avgSessionTime: 24 + Math.floor(Math.random() * 3)
            }));
        }, 5000);

        return () => clearInterval(interval);
    }, []);

    return (
        <motion.div 
            className="live-counter"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
        >
            <div className="live-indicator">
                <span className="pulse-dot"></span>
                <span className="live-text">Live Activity</span>
            </div>
            
            <div className="counter-grid">
                <div className="counter-item">
                    <div className="counter-icon users">
                        <Users size={18} />
                    </div>
                    <div className="counter-content">
                        <span className="counter-value">
                            <AnimatedNumber value={stats.activeUsers} />
                        </span>
                        <span className="counter-label">Active Now</span>
                    </div>
                </div>

                <div className="counter-divider"></div>

                <div className="counter-item">
                    <div className="counter-icon interviews">
                        <Zap size={18} />
                    </div>
                    <div className="counter-content">
                        <span className="counter-value">
                            <AnimatedNumber value={stats.interviewsToday} />
                        </span>
                        <span className="counter-label">Interviews Today</span>
                    </div>
                </div>

                <div className="counter-divider"></div>

                <div className="counter-item">
                    <div className="counter-icon questions">
                        <MessageSquare size={18} />
                    </div>
                    <div className="counter-content">
                        <span className="counter-value">
                            <AnimatedNumber value={stats.questionsAsked} />
                        </span>
                        <span className="counter-label">Questions Asked</span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default LiveCounter;
