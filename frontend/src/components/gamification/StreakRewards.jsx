import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Gift, Lock, Check, Star, Award } from 'lucide-react';
import './StreakRewards.css';

const StreakRewards = ({ 
    currentStreak = 0,
    claimedRewards = [],
    onClaimReward 
}) => {
    const [claimingId, setClaimingId] = useState(null);
    const [showCelebration, setShowCelebration] = useState(false);
    
    const rewards = [
        { day: 3, reward: '25 Bonus XP', icon: Star, type: 'xp' },
        { day: 7, reward: 'Interview Tips Pack', icon: Gift, type: 'content' },
        { day: 14, reward: '100 Bonus XP', icon: Star, type: 'xp' },
        { day: 21, reward: 'Premium Question Set', icon: Gift, type: 'content' },
        { day: 30, reward: 'Streak Master Badge', icon: Award, type: 'badge' }
    ];
    
    const handleClaim = async (reward) => {
        setClaimingId(reward.day);
        
        // Simulate claim process
        await new Promise(resolve => setTimeout(resolve, 800));
        
        onClaimReward?.(reward);
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 2000);
        setClaimingId(null);
    };
    
    const getRewardStatus = (reward) => {
        if (claimedRewards.includes(reward.day)) return 'claimed';
        if (currentStreak >= reward.day) return 'available';
        return 'locked';
    };
    
    return (
        <div className="streak-rewards">
            <div className="streak-header">
                <div className="streak-info">
                    <Flame size={24} className="streak-flame" />
                    <div className="streak-count">
                        <span className="count-value">{currentStreak}</span>
                        <span className="count-label">day streak</span>
                    </div>
                </div>
                
                <div className="streak-message">
                    {currentStreak === 0 ? (
                        'Start your streak today!'
                    ) : currentStreak < 3 ? (
                        `${3 - currentStreak} more days until your first reward!`
                    ) : (
                        'Keep it up! 🔥'
                    )}
                </div>
            </div>
            
            {/* Streak Progress Bar */}
            <div className="streak-progress">
                <div className="progress-track">
                    <motion.div 
                        className="progress-fill"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((currentStreak / 30) * 100, 100)}%` }}
                    />
                    
                    {rewards.map((reward, index) => {
                        const status = getRewardStatus(reward);
                        const position = (reward.day / 30) * 100;
                        
                        return (
                            <div
                                key={reward.day}
                                className={`milestone-point ${status}`}
                                style={{ left: `${position}%` }}
                            >
                                <span className="milestone-day">{reward.day}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
            
            {/* Rewards Grid */}
            <div className="rewards-grid">
                {rewards.map((reward, index) => {
                    const status = getRewardStatus(reward);
                    const Icon = reward.icon;
                    
                    return (
                        <motion.div
                            key={reward.day}
                            className={`reward-card ${status}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <div className="reward-header">
                                <span className="reward-day">Day {reward.day}</span>
                                {status === 'locked' && <Lock size={12} />}
                                {status === 'claimed' && <Check size={12} />}
                            </div>
                            
                            <div className="reward-icon">
                                <Icon size={24} />
                            </div>
                            
                            <span className="reward-text">{reward.reward}</span>
                            
                            {status === 'available' && (
                                <motion.button
                                    className="claim-btn"
                                    onClick={() => handleClaim(reward)}
                                    disabled={claimingId === reward.day}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    {claimingId === reward.day ? (
                                        <span className="claiming">...</span>
                                    ) : (
                                        'Claim'
                                    )}
                                </motion.button>
                            )}
                            
                            {status === 'locked' && (
                                <span className="locked-text">
                                    {reward.day - currentStreak} days to go
                                </span>
                            )}
                            
                            {status === 'claimed' && (
                                <span className="claimed-text">Claimed!</span>
                            )}
                        </motion.div>
                    );
                })}
            </div>
            
            {/* Celebration Overlay */}
            <AnimatePresence>
                {showCelebration && (
                    <motion.div
                        className="celebration-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="celebration-content"
                            initial={{ scale: 0.5, y: 50 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.5, opacity: 0 }}
                        >
                            <Gift size={48} />
                            <h4>Reward Claimed!</h4>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default StreakRewards;
