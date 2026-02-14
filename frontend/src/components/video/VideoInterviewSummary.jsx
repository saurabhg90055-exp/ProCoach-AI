import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    TrendingUp, Target, Clock, Award, CheckCircle, XCircle, 
    ChevronRight, RotateCcw, Download, Share2, LogIn, Save,
    Eye, Zap, Brain, Heart, Video, BarChart2, Activity,
    ThumbsUp, AlertTriangle, Star
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { interviewAPI } from '../../services/api';
import './VideoInterviewSummary.css';

const VideoInterviewSummary = ({
    // Standard interview data
    score,
    totalQuestions,
    correctAnswers,
    duration,
    difficulty,
    topic,
    feedback,
    xpGained,
    onRestart,
    onViewDetails,
    questionsHistory,
    sessionId,
    isGuest = false,
    onRequireAuth,
    // Video-specific data
    videoMetrics = {},
    expressionHistory = [],
    videoFeedback = ''
}) => {
    const { isAuthenticated } = useAuth();
    const [saveStatus, setSaveStatus] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');
    
    // Calculate expression analytics
    const expressionAnalytics = useMemo(() => {
        if (!expressionHistory.length) {
            return {
                avgConfidence: videoMetrics.averageConfidence || 0,
                avgEyeContact: videoMetrics.averageEyeContact || 0,
                avgEngagement: videoMetrics.averageEngagement || 0,
                emotionBreakdown: {},
                confidenceTrend: []
            };
        }
        
        const total = expressionHistory.length;
        const avgConfidence = expressionHistory.reduce((sum, e) => sum + e.confidence, 0) / total;
        const avgEyeContact = expressionHistory.reduce((sum, e) => sum + e.eyeContact, 0) / total;
        const avgEngagement = expressionHistory.reduce((sum, e) => sum + e.engagement, 0) / total;
        
        // Emotion breakdown
        const emotionBreakdown = expressionHistory.reduce((acc, e) => {
            acc[e.emotion] = (acc[e.emotion] || 0) + 1;
            return acc;
        }, {});
        
        // Confidence trend (sample every 10 data points)
        const confidenceTrend = expressionHistory
            .filter((_, i) => i % Math.max(1, Math.floor(total / 20)) === 0)
            .map(e => e.confidence);
        
        return {
            avgConfidence: Math.round(avgConfidence),
            avgEyeContact: Math.round(avgEyeContact),
            avgEngagement: Math.round(avgEngagement),
            emotionBreakdown,
            confidenceTrend
        };
    }, [expressionHistory, videoMetrics]);
    
    // Combined score calculation (technical + presentation)
    const combinedScore = useMemo(() => {
        const techWeight = 0.6;
        const presentationWeight = 0.4;
        
        const presentationScore = (
            expressionAnalytics.avgConfidence * 0.4 +
            expressionAnalytics.avgEyeContact * 0.3 +
            expressionAnalytics.avgEngagement * 0.3
        );
        
        return Math.round(score * techWeight + presentationScore * presentationWeight);
    }, [score, expressionAnalytics]);
    
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1, delayChildren: 0.2 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    const getScoreGrade = (score) => {
        if (score >= 90) return { grade: 'A+', color: '#10b981', message: 'Outstanding Performance!' };
        if (score >= 80) return { grade: 'A', color: '#22c55e', message: 'Excellent!' };
        if (score >= 70) return { grade: 'B', color: '#84cc16', message: 'Great Job!' };
        if (score >= 60) return { grade: 'C', color: '#eab308', message: 'Good Effort!' };
        if (score >= 50) return { grade: 'D', color: '#f97316', message: 'Keep Practicing!' };
        return { grade: 'F', color: '#ef4444', message: 'Room for Improvement' };
    };

    const scoreInfo = getScoreGrade(combinedScore);

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    };
    
    const getMetricColor = (value) => {
        if (value >= 80) return '#10b981';
        if (value >= 60) return '#22c55e';
        if (value >= 40) return '#eab308';
        return '#ef4444';
    };
    
    const getEmotionEmoji = (emotion) => {
        const emojis = {
            happy: '😊',
            neutral: '😐',
            surprised: '😮',
            thinking: '🤔',
            nervous: '😰',
            confident: '💪',
            focused: '🎯'
        };
        return emojis[emotion] || '😐';
    };

    return (
        <motion.div
            className="video-interview-summary"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            {/* Header */}
            <motion.div className="summary-header video-mode" variants={itemVariants}>
                <div className="header-badge">
                    <Video size={20} />
                    <span>Video Interview</span>
                </div>
                <Star className="header-icon" />
                <h1>Interview Complete!</h1>
                <p>{scoreInfo.message}</p>
            </motion.div>

            {/* Tab Navigation */}
            <motion.div className="summary-tabs" variants={itemVariants}>
                <button 
                    className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    <BarChart2 size={18} />
                    Overview
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'expression' ? 'active' : ''}`}
                    onClick={() => setActiveTab('expression')}
                >
                    <Eye size={18} />
                    Expression Analysis
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`}
                    onClick={() => setActiveTab('details')}
                >
                    <Brain size={18} />
                    Question Details
                </button>
            </motion.div>

            <AnimatePresence mode="wait">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                    <motion.div 
                        key="overview"
                        className="tab-content"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                    >
                        {/* Combined Score Display */}
                        <div className="score-section">
                            <div className="score-circle-container">
                                <div className="score-circle" style={{ '--score-color': scoreInfo.color }}>
                                    <svg viewBox="0 0 100 100">
                                        <circle
                                            className="score-bg"
                                            cx="50"
                                            cy="50"
                                            r="45"
                                            strokeWidth="8"
                                            fill="none"
                                        />
                                        <motion.circle
                                            className="score-progress"
                                            cx="50"
                                            cy="50"
                                            r="45"
                                            strokeWidth="8"
                                            fill="none"
                                            strokeDasharray={`${2 * Math.PI * 45}`}
                                            initial={{ strokeDashoffset: 2 * Math.PI * 45 }}
                                            animate={{ strokeDashoffset: 2 * Math.PI * 45 * (1 - combinedScore / 100) }}
                                            transition={{ duration: 1.5, ease: 'easeOut' }}
                                            style={{ stroke: scoreInfo.color }}
                                        />
                                    </svg>
                                    <div className="score-content">
                                        <span className="score-value">{combinedScore}</span>
                                        {/* <span className="score-label">Combined</span> */}
                                    </div>
                                </div>
                                <div className="score-grade" style={{ backgroundColor: `${scoreInfo.color}20`, color: scoreInfo.color }}>
                                    Grade: {scoreInfo.grade}
                                </div>
                            </div>
                            
                            {/* Score Breakdown */}
                            <div className="score-breakdown">
                                <div className="breakdown-item">
                                    <Brain size={20} />
                                    <div className="breakdown-details">
                                        <span className="breakdown-label">Technical Score</span>
                                        <div className="breakdown-bar">
                                            <motion.div 
                                                className="breakdown-fill technical"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${score}%` }}
                                                transition={{ duration: 1, delay: 0.3 }}
                                            />
                                        </div>
                                        <span className="breakdown-value">{score}%</span>
                                    </div>
                                </div>
                                <div className="breakdown-item">
                                    <Heart size={20} />
                                    <div className="breakdown-details">
                                        <span className="breakdown-label">Presentation Score</span>
                                        <div className="breakdown-bar">
                                            <motion.div 
                                                className="breakdown-fill presentation"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${(expressionAnalytics.avgConfidence * 0.4 + expressionAnalytics.avgEyeContact * 0.3 + expressionAnalytics.avgEngagement * 0.3)}%` }}
                                                transition={{ duration: 1, delay: 0.5 }}
                                            />
                                        </div>
                                        <span className="breakdown-value">
                                            {Math.round(expressionAnalytics.avgConfidence * 0.4 + expressionAnalytics.avgEyeContact * 0.3 + expressionAnalytics.avgEngagement * 0.3)}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* XP Earned */}
                        {xpGained && (
                            <div className="xp-earned-card">
                                <Award className="xp-icon" />
                                <span className="xp-amount">+{xpGained} XP Earned!</span>
                            </div>
                        )}

                        {/* Quick Stats Grid */}
                        <div className="stats-grid">
                            <div className="stat-card">
                                <CheckCircle className="stat-icon success" />
                                <div className="stat-details">
                                    <span className="stat-value">{correctAnswers}/{totalQuestions}</span>
                                    <span className="stat-label">Correct Answers</span>
                                </div>
                            </div>
                            <div className="stat-card">
                                <Clock className="stat-icon time" />
                                <div className="stat-details">
                                    <span className="stat-value">{formatDuration(duration)}</span>
                                    <span className="stat-label">Total Time</span>
                                </div>
                            </div>
                            <div className="stat-card">
                                <Eye className="stat-icon eye" />
                                <div className="stat-details">
                                    <span className="stat-value">{expressionAnalytics.avgEyeContact}%</span>
                                    <span className="stat-label">Eye Contact</span>
                                </div>
                            </div>
                            <div className="stat-card">
                                <Zap className="stat-icon confidence" />
                                <div className="stat-details">
                                    <span className="stat-value">{expressionAnalytics.avgConfidence}%</span>
                                    <span className="stat-label">Confidence</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Expression Analysis Tab */}
                {activeTab === 'expression' && (
                    <motion.div 
                        key="expression"
                        className="tab-content"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                    >
                        {/* Expression Metrics */}
                        <div className="expression-metrics">
                            <h3>Body Language Analysis</h3>
                            
                            <div className="metric-cards">
                                <div className="metric-card">
                                    <div className="metric-header">
                                        <Eye size={24} />
                                        <span>Eye Contact</span>
                                    </div>
                                    <div className="metric-gauge">
                                        <svg viewBox="0 0 100 50">
                                            <path
                                                d="M 10 50 A 40 40 0 0 1 90 50"
                                                fill="none"
                                                stroke="#2d2d3a"
                                                strokeWidth="8"
                                            />
                                            <motion.path
                                                d="M 10 50 A 40 40 0 0 1 90 50"
                                                fill="none"
                                                stroke={getMetricColor(expressionAnalytics.avgEyeContact)}
                                                strokeWidth="8"
                                                strokeDasharray="126"
                                                initial={{ strokeDashoffset: 126 }}
                                                animate={{ strokeDashoffset: 126 - (expressionAnalytics.avgEyeContact / 100) * 126 }}
                                                transition={{ duration: 1.5 }}
                                            />
                                        </svg>
                                        <span className="metric-value">{expressionAnalytics.avgEyeContact}%</span>
                                    </div>
                                    <p className="metric-tip">
                                        {expressionAnalytics.avgEyeContact >= 70 
                                            ? "Great eye contact! You appeared engaged and confident."
                                            : "Try to look at the camera more often to simulate eye contact."}
                                    </p>
                                </div>
                                
                                <div className="metric-card">
                                    <div className="metric-header">
                                        <Zap size={24} />
                                        <span>Confidence</span>
                                    </div>
                                    <div className="metric-gauge">
                                        <svg viewBox="0 0 100 50">
                                            <path
                                                d="M 10 50 A 40 40 0 0 1 90 50"
                                                fill="none"
                                                stroke="#2d2d3a"
                                                strokeWidth="8"
                                            />
                                            <motion.path
                                                d="M 10 50 A 40 40 0 0 1 90 50"
                                                fill="none"
                                                stroke={getMetricColor(expressionAnalytics.avgConfidence)}
                                                strokeWidth="8"
                                                strokeDasharray="126"
                                                initial={{ strokeDashoffset: 126 }}
                                                animate={{ strokeDashoffset: 126 - (expressionAnalytics.avgConfidence / 100) * 126 }}
                                                transition={{ duration: 1.5, delay: 0.2 }}
                                            />
                                        </svg>
                                        <span className="metric-value">{expressionAnalytics.avgConfidence}%</span>
                                    </div>
                                    <p className="metric-tip">
                                        {expressionAnalytics.avgConfidence >= 70 
                                            ? "You appeared confident throughout the interview!"
                                            : "Practice more to boost your confidence level."}
                                    </p>
                                </div>
                                
                                <div className="metric-card">
                                    <div className="metric-header">
                                        <Activity size={24} />
                                        <span>Engagement</span>
                                    </div>
                                    <div className="metric-gauge">
                                        <svg viewBox="0 0 100 50">
                                            <path
                                                d="M 10 50 A 40 40 0 0 1 90 50"
                                                fill="none"
                                                stroke="#2d2d3a"
                                                strokeWidth="8"
                                            />
                                            <motion.path
                                                d="M 10 50 A 40 40 0 0 1 90 50"
                                                fill="none"
                                                stroke={getMetricColor(expressionAnalytics.avgEngagement)}
                                                strokeWidth="8"
                                                strokeDasharray="126"
                                                initial={{ strokeDashoffset: 126 }}
                                                animate={{ strokeDashoffset: 126 - (expressionAnalytics.avgEngagement / 100) * 126 }}
                                                transition={{ duration: 1.5, delay: 0.4 }}
                                            />
                                        </svg>
                                        <span className="metric-value">{expressionAnalytics.avgEngagement}%</span>
                                    </div>
                                    <p className="metric-tip">
                                        {expressionAnalytics.avgEngagement >= 70 
                                            ? "You showed great enthusiasm and engagement!"
                                            : "Show more energy and enthusiasm in your responses."}
                                    </p>
                                </div>
                            </div>
                        </div>
                        
                        {/* Emotion Distribution */}
                        <div className="emotion-distribution">
                            <h3>Emotion Distribution</h3>
                            <div className="emotion-bars">
                                {Object.entries(expressionAnalytics.emotionBreakdown).map(([emotion, count]) => {
                                    const total = Object.values(expressionAnalytics.emotionBreakdown).reduce((a, b) => a + b, 0);
                                    const percentage = Math.round((count / total) * 100);
                                    return (
                                        <div key={emotion} className="emotion-bar-item">
                                            <div className="emotion-label">
                                                <span className="emotion-emoji">{getEmotionEmoji(emotion)}</span>
                                                <span className="emotion-name">{emotion}</span>
                                            </div>
                                            <div className="emotion-bar">
                                                <motion.div 
                                                    className={`emotion-fill ${emotion}`}
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${percentage}%` }}
                                                    transition={{ duration: 0.8, delay: 0.2 }}
                                                />
                                            </div>
                                            <span className="emotion-percentage">{percentage}%</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        
                        {/* Confidence Trend */}
                        {expressionAnalytics.confidenceTrend.length > 0 && (
                            <div className="confidence-trend">
                                <h3>Confidence Over Time</h3>
                                <div className="trend-chart">
                                    <svg viewBox={`0 0 ${expressionAnalytics.confidenceTrend.length * 20 + 20} 100`} className="trend-svg">
                                        <defs>
                                            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
                                                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                                            </linearGradient>
                                        </defs>
                                        {/* Area fill */}
                                        <motion.path
                                            d={`M 10 ${100 - expressionAnalytics.confidenceTrend[0]} ${expressionAnalytics.confidenceTrend.map((v, i) => `L ${i * 20 + 10} ${100 - v}`).join(' ')} L ${(expressionAnalytics.confidenceTrend.length - 1) * 20 + 10} 100 L 10 100 Z`}
                                            fill="url(#trendGradient)"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ duration: 1 }}
                                        />
                                        {/* Line */}
                                        <motion.path
                                            d={`M 10 ${100 - expressionAnalytics.confidenceTrend[0]} ${expressionAnalytics.confidenceTrend.map((v, i) => `L ${i * 20 + 10} ${100 - v}`).join(' ')}`}
                                            fill="none"
                                            stroke="#8b5cf6"
                                            strokeWidth="2"
                                            initial={{ pathLength: 0 }}
                                            animate={{ pathLength: 1 }}
                                            transition={{ duration: 1.5 }}
                                        />
                                        {/* Points */}
                                        {expressionAnalytics.confidenceTrend.map((v, i) => (
                                            <motion.circle
                                                key={i}
                                                cx={i * 20 + 10}
                                                cy={100 - v}
                                                r="4"
                                                fill="#8b5cf6"
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                transition={{ delay: 0.5 + i * 0.05 }}
                                            />
                                        ))}
                                    </svg>
                                    <div className="trend-legend">
                                        <span>Start</span>
                                        <span>End</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {/* Video Feedback */}
                        {videoFeedback && (
                            <div className="video-feedback-section">
                                <h3>Presentation Feedback</h3>
                                <div className="feedback-content">
                                    {videoFeedback.split('\n').map((line, index) => (
                                        <p key={index}>{line}</p>
                                    ))}
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* Question Details Tab */}
                {activeTab === 'details' && (
                    <motion.div 
                        key="details"
                        className="tab-content"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                    >
                        {/* Technical Feedback */}
                        {feedback && (
                            <div className="feedback-section">
                                <h3>AI Technical Feedback</h3>
                                <div className="feedback-content">
                                    {feedback.split('\n').map((line, index) => (
                                        <p key={index}>{line}</p>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Questions History */}
                        {questionsHistory && questionsHistory.length > 0 && (
                            <div className="questions-history">
                                <h3>Question Summary</h3>
                                <div className="history-list">
                                    {questionsHistory.map((q, index) => (
                                        <div key={index} className={`history-item ${q.correct ? 'correct' : 'incorrect'}`}>
                                            <span className="history-number">Q{index + 1}</span>
                                            <span className="history-question">{q.question?.substring(0, 80)}...</span>
                                            <div className="history-meta">
                                                {q.score && <span className="history-score">{q.score}/10</span>}
                                                {q.correct ? (
                                                    <CheckCircle className="history-icon correct" />
                                                ) : (
                                                    <XCircle className="history-icon incorrect" />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Action Buttons */}
            <motion.div className="summary-actions" variants={itemVariants}>
                <motion.button
                    className="action-btn secondary highlight"
                    onClick={() => {
                        if (!isAuthenticated) {
                            onRequireAuth?.('save');
                        } else {
                            handleSaveToHistory();
                        }
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                >
                    {!isAuthenticated ? (
                        <>
                            <LogIn size={20} />
                            <span>Login to Save</span>
                        </>
                    ) : saveStatus === 'saving' ? (
                        <span>Saving...</span>
                    ) : saveStatus === 'saved' ? (
                        <>
                            <CheckCircle size={20} />
                            <span>Saved!</span>
                        </>
                    ) : (
                        <>
                            <Save size={20} />
                            <span>Save to History</span>
                        </>
                    )}
                </motion.button>

                <motion.button
                    className="action-btn primary"
                    onClick={onRestart}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                >
                    <RotateCcw size={20} />
                    <span>Start New Interview</span>
                </motion.button>
                
                <motion.button
                    className="action-btn secondary"
                    onClick={() => {
                        if (!isAuthenticated) {
                            onRequireAuth?.('export');
                        } else {
                            handleExportReport();
                        }
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                >
                    {!isAuthenticated && <LogIn size={16} style={{ marginRight: 4 }} />}
                    <Download size={20} />
                    <span>Export Report</span>
                </motion.button>
                
                <motion.button
                    className="action-btn secondary"
                    onClick={handleShare}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                >
                    <Share2 size={20} />
                    <span>Share</span>
                </motion.button>
            </motion.div>
            
            {/* Guest Notice - Enhanced with login prompt */}
            {isGuest && !isAuthenticated && (
                <motion.div className="guest-notice enhanced" variants={itemVariants}>
                    <div className="guest-notice-content">
                        <LogIn size={20} />
                        <div className="guest-notice-text">
                            <strong>Save Your Progress!</strong>
                            <span>Login or create an account to save your video interview history and track your improvement over time.</span>
                        </div>
                    </div>
                    <motion.button 
                        className="guest-login-btn"
                        onClick={() => onRequireAuth && onRequireAuth(sessionId)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        Login to Save
                    </motion.button>
                </motion.div>
            )}
        </motion.div>
    );
    
    // Handler functions
    async function handleSaveToHistory() {
        if (!sessionId) {
            setSaveStatus('error');
            return;
        }
        
        // If not authenticated, trigger auth flow with session ID for auto-save
        if (!isAuthenticated) {
            if (onRequireAuth) {
                onRequireAuth(sessionId);
            }
            return;
        }
        
        setSaveStatus('saving');
        try {
            const result = await interviewAPI.saveToUserHistory(sessionId);
            if (result.success) {
                setSaveStatus('saved');
            } else {
                setSaveStatus('error');
            }
        } catch (error) {
            console.error('Error saving to history:', error);
            setSaveStatus('error');
        }
    }
    
    async function handleExportReport() {
        if (!sessionId) return;
        try {
            const result = await interviewAPI.exportReport(sessionId);
            // Add video metrics to the report
            const fullReport = {
                ...result,
                videoMetrics: expressionAnalytics,
                interviewMode: 'video'
            };
            const blob = new Blob([JSON.stringify(fullReport, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `video-interview-report-${sessionId.slice(0, 8)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting report:', error);
        }
    }
    
    function handleShare() {
        const shareText = `I just completed a Video ${topic} interview on ProCoach AI!\n\nCombined Score: ${combinedScore}%\nTechnical: ${score}%\nConfidence: ${expressionAnalytics.avgConfidence}%\nEye Contact: ${expressionAnalytics.avgEyeContact}%\n\nTry it out at procoach.ai`;
        navigator.clipboard.writeText(shareText);
        alert('Results copied to clipboard!');
    }
};

export default VideoInterviewSummary;
