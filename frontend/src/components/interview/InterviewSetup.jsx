import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Briefcase, Target, Zap, ChevronRight, Sparkles, Brain, Trophy, Star, Mic, Video, Camera, Eye, Shield, User } from 'lucide-react';
import './InterviewSetup.css';

const InterviewSetup = ({
    selectedTopic,
    setSelectedTopic,
    selectedCompany,
    setSelectedCompany,
    selectedDifficulty,
    setSelectedDifficulty,
    interviewMode,
    setInterviewMode,
    interviewerGender,
    setInterviewerGender,
    topics,
    companies,
    difficulties,
    onStartInterview,
    userName,
    userStats
}) => {
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
                delayChildren: 0.2
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    const getDifficultyColor = (difficulty) => {
        switch (difficulty) {
            case 'easy': return '#10b981';
            case 'medium': return '#f59e0b';
            case 'hard': return '#ef4444';
            default: return '#6366f1';
        }
    };

    const getDifficultyIcon = (difficulty) => {
        switch (difficulty) {
            case 'easy': return <Star size={16} />;
            case 'medium': return <Zap size={16} />;
            case 'hard': return <Trophy size={16} />;
            default: return <Target size={16} />;
        }
    };

    return (
        <motion.div
            className="interview-setup"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            {/* Welcome Header */}
            <motion.div className="setup-header" variants={itemVariants}>
                <motion.div
                    className="welcome-badge"
                    whileHover={{ scale: 1.05 }}
                >
                    <Sparkles className="sparkle-icon" />
                    <span>ProCoach AI</span>
                </motion.div>
                <h1 className="setup-title">
                    {userName ? `Welcome back, ${userName}!` : 'Setup Your Interview'}
                </h1>
                <p className="setup-subtitle">
                    Configure your mock interview session and level up your skills
                </p>
            </motion.div>

            {/* User Stats Card */}
            {userStats && (
                <motion.div className="user-stats-card" variants={itemVariants}>
                    <div className="stat-item">
                        <Brain className="stat-icon" />
                        <div className="stat-info">
                            <span className="stat-value">{userStats.totalInterviews || 0}</span>
                            <span className="stat-label">Interviews</span>
                        </div>
                    </div>
                    <div className="stat-item">
                        <Trophy className="stat-icon gold" />
                        <div className="stat-info">
                            <span className="stat-value">{userStats.averageScore || 0}%</span>
                            <span className="stat-label">Avg Score</span>
                        </div>
                    </div>
                    <div className="stat-item">
                        <Zap className="stat-icon purple" />
                        <div className="stat-info">
                            <span className="stat-value">{userStats.streak || 0}</span>
                            <span className="stat-label">Day Streak</span>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Setup Form */}
            <motion.div className="setup-form" variants={itemVariants}>
                {/* Interview Mode Selection */}
                <div className="form-group">
                    <label className="form-label">
                        <Video className="label-icon" />
                        Interview Mode
                    </label>
                    <div className="mode-grid">
                        <motion.button
                            className={`mode-card ${interviewMode === 'audio' ? 'selected' : ''}`}
                            onClick={() => setInterviewMode('audio')}
                            whileHover={{ scale: 1.03, y: -4 }}
                            whileTap={{ scale: 0.97 }}
                        >
                            <div className="mode-icon-wrapper audio-mode">
                                <Mic size={28} />
                            </div>
                            <div className="mode-content">
                                <span className="mode-name">Audio Mode</span>
                                <span className="mode-desc">Voice-based interview with AI</span>
                            </div>
                            <div className="mode-features">
                                <span className="feature-tag">🎤 Voice Only</span>
                                <span className="feature-tag">⚡ Quick Setup</span>
                            </div>
                        </motion.button>

                        <motion.button
                            className={`mode-card ${interviewMode === 'video' ? 'selected' : ''}`}
                            onClick={() => setInterviewMode('video')}
                            whileHover={{ scale: 1.03, y: -4 }}
                            whileTap={{ scale: 0.97 }}
                        >
                            <div className="mode-icon-wrapper video-mode">
                                <Camera size={28} />
                            </div>
                            <div className="mode-content">
                                <span className="mode-name">Video Mode</span>
                                <span className="mode-desc">Full video interview with expression analysis</span>
                            </div>
                            <div className="mode-features">
                                <span className="feature-tag">📹 Camera</span>
                                <span className="feature-tag">😊 Expressions</span>
                                <span className="feature-tag">👁️ Eye Contact</span>
                            </div>
                            <div className="mode-badge premium">
                                <Sparkles size={12} />
                                <span>Pro Features</span>
                            </div>
                        </motion.button>
                    </div>

                    {interviewMode === 'video' && (
                        <motion.div
                            className="video-mode-info"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                        >
                            <div className="info-header">
                                <Eye size={18} />
                                <span>Video Mode Features</span>
                            </div>
                            <ul className="info-list">
                                <li>📹 Real-time video interview with AI interviewer</li>
                                <li>😊 Expression & emotion analysis throughout</li>
                                <li>👁️ Eye contact tracking and feedback</li>
                                <li>📊 Confidence score based on body language</li>
                                <li>💡 Personalized tips based on your expressions</li>
                            </ul>
                            <div className="camera-permission-note">
                                <Shield size={14} />
                                <span>Camera access required. Your video is processed locally.</span>
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* Interviewer Gender Selection */}
                <div className="form-group">
                    <label className="form-label">
                        <User className="label-icon" />
                        Interviewer
                    </label>
                    <div className="gender-grid">
                        <motion.button
                            className={`gender-card ${interviewerGender === 'male' ? 'selected' : ''}`}
                            onClick={() => setInterviewerGender('male')}
                            whileHover={{ scale: 1.03, y: -4 }}
                            whileTap={{ scale: 0.97 }}
                        >
                            <div className="gender-icon-wrapper male" style={{ padding: 0, overflow: 'hidden' }}>
                                <img
                                    src="/assets/interviewer_male.png"
                                    alt="Male Interviewer"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            </div>
                            <div className="gender-content">
                                <span className="gender-name">Male Interviewer</span>
                                <span className="gender-desc">Professional AI interviewer (Saurabh)</span>
                            </div>
                        </motion.button>

                        <motion.button
                            className={`gender-card ${interviewerGender === 'female' ? 'selected' : ''}`}
                            onClick={() => setInterviewerGender('female')}
                            whileHover={{ scale: 1.03, y: -4 }}
                            whileTap={{ scale: 0.97 }}
                        >
                            <div className="gender-icon-wrapper female" style={{ padding: 0, overflow: 'hidden' }}>
                                <img
                                    src="/assets/interviewer_female.png"
                                    alt="Female Interviewer"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            </div>
                            <div className="gender-content">
                                <span className="gender-name">Female Interviewer</span>
                                <span className="gender-desc">Professional female AI interviewer</span>
                            </div>
                        </motion.button>
                    </div>
                </div>

                {/* Topic Selection */}
                <div className="form-group">
                    <label className="form-label">
                        <Target className="label-icon" />
                        Interview Topic
                    </label>
                    <motion.div
                        className="select-wrapper"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <select
                            value={selectedTopic}
                            onChange={(e) => setSelectedTopic(e.target.value)}
                            className="form-select"
                        >
                            <option value="">Select a topic...</option>
                            {topics.map((topic) => (
                                <option key={topic.id} value={topic.id}>
                                    {topic.name}
                                </option>
                            ))}
                        </select>
                    </motion.div>
                </div>

                {/* Company Style Selection */}
                <div className="form-group">
                    <label className="form-label">
                        <Briefcase className="label-icon" />
                        Company Style
                    </label>
                    <div className="company-grid">
                        {companies.map((company) => (
                            <motion.button
                                key={company.id}
                                className={`company-card ${selectedCompany === company.id ? 'selected' : ''}`}
                                onClick={() => setSelectedCompany(company.id)}
                                whileHover={{ scale: 1.05, y: -2 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <span className="company-name">{company.name}</span>
                            </motion.button>
                        ))}
                    </div>
                </div>

                {/* Difficulty Selection */}
                <div className="form-group">
                    <label className="form-label">
                        <Settings className="label-icon" />
                        Difficulty Level
                    </label>
                    <div className="difficulty-grid">
                        {difficulties.map((diff) => (
                            <motion.button
                                key={diff.id}
                                className={`difficulty-card ${selectedDifficulty === diff.id ? 'selected' : ''}`}
                                onClick={() => setSelectedDifficulty(diff.id)}
                                whileHover={{ scale: 1.05, y: -2 }}
                                whileTap={{ scale: 0.95 }}
                                style={{
                                    '--difficulty-color': getDifficultyColor(diff.id)
                                }}
                            >
                                <div className="difficulty-icon">
                                    {getDifficultyIcon(diff.id)}
                                </div>
                                <span className="difficulty-name">{diff.name}</span>
                                <span className="difficulty-desc">{diff.description}</span>
                            </motion.button>
                        ))}
                    </div>
                </div>
            </motion.div>

            {/* Start Button */}
            <motion.div className="setup-actions" variants={itemVariants}>
                <motion.button
                    className={`start-interview-btn ${interviewMode === 'video' ? 'video-mode' : ''}`}
                    onClick={onStartInterview}
                    disabled={!selectedTopic || !selectedCompany || !selectedDifficulty || !interviewMode}
                    whileHover={{ scale: 1.02, boxShadow: '0 20px 40px rgba(99, 102, 241, 0.3)' }}
                    whileTap={{ scale: 0.98 }}
                >
                    {interviewMode === 'video' ? (
                        <>
                            <Camera size={20} />
                            <span>Start Video Interview</span>
                        </>
                    ) : (
                        <>
                            <Mic size={20} />
                            <span>Start Audio Interview</span>
                        </>
                    )}
                    <ChevronRight className="btn-icon" />
                </motion.button>

                <p className="setup-tip">
                    {interviewMode === 'video'
                        ? '📹 Tip: Ensure good lighting and look directly at your camera'
                        : '💡 Tip: Practice regularly to improve your interview performance'
                    }
                </p>
            </motion.div>
        </motion.div>
    );
};

export default InterviewSetup;
