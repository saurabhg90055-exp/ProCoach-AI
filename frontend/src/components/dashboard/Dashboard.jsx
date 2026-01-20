import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BarChart3, TrendingUp, Calendar, Award, Target, Clock, 
    ChevronDown, ChevronUp, Filter, Download, Star, RefreshCw,
    Loader, User, Zap
} from 'lucide-react';
import { LevelProgressBar, StreakCounter, AchievementBadge, ACHIEVEMENTS } from '../gamification/XPSystem';
import { useAuth } from '../../contexts/AuthContext';
import { interviewAPI } from '../../services/api';
import './Dashboard.css';

const Dashboard = ({
    stats,
    totalXP,
    unlockedAchievements,
    interviewHistory: localHistory = []
}) => {
    const { isAuthenticated, user, dashboardData, refreshDashboard } = useAuth();
    const [selectedPeriod, setSelectedPeriod] = useState('week');
    const [showAllHistory, setShowAllHistory] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [serverHistory, setServerHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Fetch server history when authenticated
    useEffect(() => {
        if (isAuthenticated) {
            fetchServerHistory();
        }
    }, [isAuthenticated]);

    const fetchServerHistory = async () => {
        setLoadingHistory(true);
        try {
            const data = await interviewAPI.getHistory();
            if (data?.interviews) {
                // Map server interviews to local format
                const mapped = data.interviews.map(i => ({
                    id: i.id,
                    topic: i.topic_name || i.topic,
                    date: i.started_at,
                    score: i.average_score || 0,
                    difficulty: i.difficulty,
                    questionCount: i.question_count
                }));
                setServerHistory(mapped);
            }
        } catch (error) {
            console.error('Failed to fetch history:', error);
        }
        setLoadingHistory(false);
    };

    // Use server history if authenticated, else local
    const interviewHistory = isAuthenticated ? serverHistory : localHistory;

    // Handle refresh
    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await Promise.all([
                refreshDashboard(),
                isAuthenticated && fetchServerHistory()
            ]);
        } catch (error) {
            console.error('Refresh failed:', error);
        }
        setIsRefreshing(false);
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1, delayChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    // Calculate performance metrics
    const performanceData = useMemo(() => {
        if (!interviewHistory || interviewHistory.length === 0) {
            return { weeklyScores: [], improvement: 0, topTopic: 'N/A' };
        }

        const now = new Date();
        const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

        const recentInterviews = interviewHistory.filter(i => 
            new Date(i.date) > (selectedPeriod === 'week' ? weekAgo : monthAgo)
        );

        const weeklyScores = Array(7).fill(0).map((_, i) => {
            const day = new Date(now - (6 - i) * 24 * 60 * 60 * 1000);
            const dayInterviews = interviewHistory.filter(interview => 
                new Date(interview.date).toDateString() === day.toDateString()
            );
            return dayInterviews.length > 0 
                ? dayInterviews.reduce((sum, i) => sum + i.score, 0) / dayInterviews.length 
                : null;
        });

        // Calculate improvement
        const olderScores = interviewHistory.slice(-10, -5).map(i => i.score);
        const recentScores = interviewHistory.slice(-5).map(i => i.score);
        const olderAvg = olderScores.length > 0 ? olderScores.reduce((a, b) => a + b, 0) / olderScores.length : 0;
        const recentAvg = recentScores.length > 0 ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length : 0;
        const improvement = olderAvg > 0 ? Math.round(((recentAvg - olderAvg) / olderAvg) * 100) : 0;

        // Find top performing topic
        const topicScores = {};
        interviewHistory.forEach(i => {
            if (!topicScores[i.topic]) {
                topicScores[i.topic] = { total: 0, count: 0 };
            }
            topicScores[i.topic].total += i.score;
            topicScores[i.topic].count++;
        });

        let topTopic = 'N/A';
        let topAvg = 0;
        Object.entries(topicScores).forEach(([topic, data]) => {
            const avg = data.total / data.count;
            if (avg > topAvg) {
                topAvg = avg;
                topTopic = topic;
            }
        });

        return { weeklyScores, improvement, topTopic, recentInterviews };
    }, [interviewHistory, selectedPeriod]);

    const getDayLabel = (index) => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const now = new Date();
        const day = new Date(now - (6 - index) * 24 * 60 * 60 * 1000);
        return days[day.getDay()];
    };

    return (
        <motion.div
            className="dashboard"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            {/* Header */}
            <motion.div className="dashboard-header" variants={itemVariants}>
                <div className="header-content">
                    <h1>Your Progress</h1>
                    <p>
                        {isAuthenticated ? (
                            <>Welcome back, <strong>{user?.username}</strong>!</>
                        ) : (
                            'Track your interview performance and achievements'
                        )}
                    </p>
                    {!isAuthenticated && (
                        <p className="login-hint">
                            <User size={14} /> Log in to sync your progress across devices
                        </p>
                    )}
                </div>
                <div className="header-actions">
                    <button 
                        className={`refresh-btn ${isRefreshing ? 'spinning' : ''}`}
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        title="Refresh data"
                    >
                        <RefreshCw size={18} />
                    </button>
                    <select 
                        value={selectedPeriod}
                        onChange={(e) => setSelectedPeriod(e.target.value)}
                        className="period-select"
                    >
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                        <option value="all">All Time</option>
                    </select>
                </div>
            </motion.div>

            {/* Level & XP */}
            <motion.div className="level-section" variants={itemVariants}>
                <LevelProgressBar totalXP={totalXP} showDetails={true} />
            </motion.div>

            {/* Stats Overview */}
            <motion.div className="stats-overview" variants={itemVariants}>
                <div className="overview-card">
                    <Target className="card-icon purple" />
                    <div className="card-content">
                        <span className="card-value">{stats?.totalInterviews || 0}</span>
                        <span className="card-label">Total Interviews</span>
                    </div>
                </div>
                <div className="overview-card">
                    <TrendingUp className="card-icon green" />
                    <div className="card-content">
                        <span className="card-value">{stats?.averageScore?.toFixed(1) || 0}%</span>
                        <span className="card-label">Average Score</span>
                    </div>
                </div>
                <div className="overview-card">
                    <Star className="card-icon gold" />
                    <div className="card-content">
                        <span className="card-value">{stats?.perfectScores || 0}</span>
                        <span className="card-label">Perfect Scores</span>
                    </div>
                </div>
                <div className="overview-card">
                    <StreakCounter streak={stats?.streak || 0} isActive={stats?.streak > 0} />
                </div>
            </motion.div>

            {/* Performance Chart */}
            <motion.div className="chart-section" variants={itemVariants}>
                <div className="section-header">
                    <h3><BarChart3 size={20} /> Weekly Performance</h3>
                    {performanceData.improvement !== 0 && (
                        <span className={`improvement-badge ${performanceData.improvement > 0 ? 'positive' : 'negative'}`}>
                            {performanceData.improvement > 0 ? '+' : ''}{performanceData.improvement}%
                        </span>
                    )}
                </div>
                <div className="chart-container">
                    <div className="bar-chart">
                        {performanceData.weeklyScores.map((score, index) => (
                            <div key={index} className="bar-wrapper">
                                <motion.div
                                    className="bar"
                                    initial={{ height: 0 }}
                                    animate={{ height: score ? `${score}%` : '5%' }}
                                    transition={{ duration: 0.5, delay: index * 0.1 }}
                                    style={{
                                        background: score 
                                            ? `linear-gradient(180deg, #6366f1 0%, #8b5cf6 100%)`
                                            : 'rgba(255, 255, 255, 0.1)'
                                    }}
                                />
                                <span className="bar-label">{getDayLabel(index)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </motion.div>

            {/* Achievements */}
            <motion.div className="achievements-section" variants={itemVariants}>
                <div className="section-header">
                    <h3><Award size={20} /> Achievements</h3>
                    <span className="achievement-count">
                        {unlockedAchievements?.length || 0} / {ACHIEVEMENTS.length}
                    </span>
                </div>
                <div className="achievements-grid">
                    {ACHIEVEMENTS.map((achievement) => (
                        <AchievementBadge
                            key={achievement.id}
                            achievement={achievement}
                            unlocked={unlockedAchievements?.includes(achievement.id)}
                        />
                    ))}
                </div>
            </motion.div>

            {/* Interview History */}
            <motion.div className="history-section" variants={itemVariants}>
                <div className="section-header">
                    <h3><Clock size={20} /> Recent Interviews</h3>
                    <div className="history-actions">
                        {loadingHistory && <Loader size={14} className="spinning" />}
                        <button 
                            className="toggle-history"
                            onClick={() => setShowAllHistory(!showAllHistory)}
                        >
                            {showAllHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            {showAllHistory ? 'Show Less' : 'Show All'}
                        </button>
                    </div>
                </div>
                <div className="history-list">
                    <AnimatePresence>
                        {(showAllHistory ? interviewHistory : interviewHistory.slice(0, 5)).map((interview, index) => (
                            <motion.div
                                key={interview.id || index}
                                className="history-item"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <div className="history-info">
                                    <span className="history-topic">{interview.topic}</span>
                                    <span className="history-meta">
                                        <span className="history-date">
                                            {new Date(interview.date).toLocaleDateString()}
                                        </span>
                                        {interview.difficulty && (
                                            <span className={`difficulty-badge ${interview.difficulty}`}>
                                                {interview.difficulty}
                                            </span>
                                        )}
                                    </span>
                                </div>
                                <div className="history-score" style={{ 
                                    '--score-color': interview.score >= 70 ? '#10b981' : interview.score >= 50 ? '#f59e0b' : '#ef4444'
                                }}>
                                    {interview.score?.toFixed(0) || 0}%
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    {interviewHistory.length === 0 && !loadingHistory && (
                        <div className="empty-history">
                            <Zap size={32} />
                            <p>No interview history yet. Start practicing!</p>
                        </div>
                    )}
                    {loadingHistory && interviewHistory.length === 0 && (
                        <div className="loading-history">
                            <Loader size={24} className="spinning" />
                            <p>Loading your interview history...</p>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Quick Stats */}
            <motion.div className="quick-stats" variants={itemVariants}>
                <div className="quick-stat">
                    <span className="stat-label">Best Topic</span>
                    <span className="stat-value">{performanceData.topTopic}</span>
                </div>
                <div className="quick-stat">
                    <span className="stat-label">Hard Completed</span>
                    <span className="stat-value">{stats?.hardCompleted || 0}</span>
                </div>
                <div className="quick-stat">
                    <span className="stat-label">Total XP</span>
                    <span className="stat-value">{totalXP.toLocaleString()}</span>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default Dashboard;
