import React from 'react';
import { motion } from 'framer-motion';
import { 
    ChevronRight, Users, Target, TrendingUp, Award,
    Mic, Brain, BarChart2, Shield, Zap, Star, Play, ArrowRight,
    CheckCircle, MessageSquare, Clock
} from 'lucide-react';
import ProCoachAnimation from './ProCoachAnimation';
import LiveCounter from './LiveCounter';
import TrustLogos from './TrustLogos';
import './LandingPage.css';

const LandingPage = ({ onStartSetup, stats }) => {
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.15,
                delayChildren: 0.2
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: { 
            opacity: 1, 
            y: 0,
            transition: { duration: 0.6, ease: "easeOut" }
        }
    };

    const floatingAnimation = {
        y: [-10, 10, -10],
        transition: {
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
        }
    };

    const features = [
        {
            icon: <Brain size={28} />,
            title: "AI-Powered Questions",
            description: "Intelligent questions tailored to your experience and target role"
        },
        {
            icon: <Mic size={28} />,
            title: "Voice Recognition",
            description: "Practice speaking naturally with real-time speech analysis"
        },
        {
            icon: <BarChart2 size={28} />,
            title: "Detailed Analytics",
            description: "Get comprehensive feedback and track your improvement"
        },
        {
            icon: <Target size={28} />,
            title: "Resume Analysis",
            description: "Upload your resume for personalized interview questions"
        },
        {
            icon: <Award size={28} />,
            title: "Gamification",
            description: "Earn XP, unlock achievements, and level up your skills"
        },
        {
            icon: <Shield size={28} />,
            title: "Company Styles",
            description: "Practice for Google, Amazon, Meta & more interview formats"
        }
    ];

    const testimonials = [
        {
            quote: "ProCoach AI helped me land my dream job at a top tech company!",
            author: "Sarah K.",
            role: "Software Engineer"
        },
        {
            quote: "The AI feedback is incredibly accurate and actionable.",
            author: "Michael R.",
            role: "Product Manager"
        },
        {
            quote: "Best interview prep tool I've ever used. Highly recommend!",
            author: "Emily T.",
            role: "Data Scientist"
        }
    ];

    return (
        <motion.div 
            className="landing-page"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            {/* Hero Section - Split Layout */}
            <motion.section className="hero-section" variants={itemVariants}>
                <div className="hero-split-container">
                    {/* Left Side - Content */}
                    <div className="hero-content-left">
                        <motion.div 
                            className="hero-badge"
                            whileHover={{ scale: 1.05 }}
                            animate={floatingAnimation}
                        >
                            <span>AI-Powered Interview Coach</span>
                        </motion.div>

                        <h1 className="hero-title">
                            <span className="title-line-1">Welcome to</span>
                            <span className="title-brand">
                                ProCoach AI
                            </span>
                        </h1>

                        <p className="hero-subtitle">
                            Your personal AI coach and mock interviewer. Master technical interviews 
                            with real-time feedback, voice practice, and personalized coaching.
                        </p>

                        <div className="hero-features">
                            <div className="hero-feature">
                                <CheckCircle size={18} />
                                <span>Real-time AI feedback</span>
                            </div>
                            <div className="hero-feature">
                                <CheckCircle size={18} />
                                <span>Voice-based practice</span>
                            </div>
                            <div className="hero-feature">
                                <CheckCircle size={18} />
                                <span>Personalized questions</span>
                            </div>
                        </div>

                        <div className="hero-cta">
                            <motion.button
                                className="cta-button primary"
                                onClick={onStartSetup}
                                whileHover={{ scale: 1.05, boxShadow: "0 20px 40px rgba(99, 102, 241, 0.4)" }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <Play size={20} />
                                <span>Setup Your Interview</span>
                                <ChevronRight size={20} />
                            </motion.button>
                            <p className="cta-note">No credit card required • Start free</p>
                        </div>

                        <motion.div 
                            className="hero-stats"
                            variants={itemVariants}
                        >
                            <div className="stat-item">
                                <span className="stat-number">10K+</span>
                                <span className="stat-label">Interviews Completed</span>
                            </div>
                            <div className="stat-divider"></div>
                            <div className="stat-item">
                                <span className="stat-number">95%</span>
                                <span className="stat-label">Success Rate</span>
                            </div>
                            <div className="stat-divider"></div>
                            <div className="stat-item">
                                <span className="stat-number">50+</span>
                                <span className="stat-label">Topics Covered</span>
                            </div>
                        </motion.div>

                        {/* Live Activity Counter */}
                        <LiveCounter />
                    </div>

                    {/* Right Side - Animation */}
                    <motion.div 
                        className="hero-illustration-right"
                        initial={{ opacity: 0, x: 50, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
                    >
                        <ProCoachAnimation />
                    </motion.div>
                </div>
            </motion.section>

            {/* Trust Logos Section */}
            <motion.section variants={itemVariants}>
                <TrustLogos />
            </motion.section>

            {/* Features Section */}
            <motion.section className="features-section" variants={itemVariants}>
                <div className="section-header">
                    <span className="section-badge">Features</span>
                    <h2 className="section-title">Everything You Need to Succeed</h2>
                    <p className="section-subtitle">
                        Comprehensive tools designed to prepare you for any technical interview
                    </p>
                </div>

                <div className="features-grid">
                    {features.map((feature, index) => (
                        <motion.div
                            key={index}
                            className="feature-card"
                            variants={itemVariants}
                            whileHover={{ y: -8, boxShadow: "0 20px 40px rgba(0, 0, 0, 0.3)" }}
                        >
                            <div className="feature-icon">{feature.icon}</div>
                            <h3 className="feature-title">{feature.title}</h3>
                            <p className="feature-description">{feature.description}</p>
                        </motion.div>
                    ))}
                </div>
            </motion.section>

            {/* How It Works Section */}
            <motion.section className="how-it-works" variants={itemVariants}>
                <div className="section-header">
                    <span className="section-badge">How It Works</span>
                    <h2 className="section-title">Start Practicing in 3 Simple Steps</h2>
                </div>

                <div className="steps-container">
                    <motion.div 
                        className="step-card"
                        whileHover={{ scale: 1.02 }}
                    >
                        <div className="step-number">1</div>
                        <div className="step-icon">
                            <Target size={32} />
                        </div>
                        <h3>Choose Your Focus</h3>
                        <p>Select interview topic, company style, and difficulty level</p>
                    </motion.div>

                    <div className="step-connector">
                        <ArrowRight size={24} />
                    </div>

                    <motion.div 
                        className="step-card"
                        whileHover={{ scale: 1.02 }}
                    >
                        <div className="step-number">2</div>
                        <div className="step-icon">
                            <MessageSquare size={32} />
                        </div>
                        <h3>Practice Speaking</h3>
                        <p>Answer questions using your voice, just like a real interview</p>
                    </motion.div>

                    <div className="step-connector">
                        <ArrowRight size={24} />
                    </div>

                    <motion.div 
                        className="step-card"
                        whileHover={{ scale: 1.02 }}
                    >
                        <div className="step-number">3</div>
                        <div className="step-icon">
                            <TrendingUp size={32} />
                        </div>
                        <h3>Get AI Feedback</h3>
                        <p>Receive detailed analysis and personalized improvement tips</p>
                    </motion.div>
                </div>
            </motion.section>

            {/* Testimonials Section */}
            <motion.section className="testimonials-section" variants={itemVariants}>
                <div className="section-header">
                    <span className="section-badge">Testimonials</span>
                    <h2 className="section-title">Loved by Thousands of Candidates</h2>
                </div>

                <div className="testimonials-grid">
                    {testimonials.map((testimonial, index) => (
                        <motion.div
                            key={index}
                            className="testimonial-card"
                            variants={itemVariants}
                            whileHover={{ y: -5 }}
                        >
                            <div className="testimonial-stars">
                                {[...Array(5)].map((_, i) => (
                                    <Star key={i} size={16} fill="#fbbf24" color="#fbbf24" />
                                ))}
                            </div>
                            <p className="testimonial-quote">"{testimonial.quote}"</p>
                            <div className="testimonial-author">
                                <div className="author-avatar">
                                    {testimonial.author.charAt(0)}
                                </div>
                                <div className="author-info">
                                    <span className="author-name">{testimonial.author}</span>
                                    <span className="author-role">{testimonial.role}</span>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </motion.section>

            {/* CTA Section */}
            <motion.section className="final-cta" variants={itemVariants}>
                <div className="cta-background">
                    <div className="cta-gradient"></div>
                </div>
                <div className="cta-content">
                    <h2>Ready to Ace Your Next Interview?</h2>
                    <p>Join thousands of successful candidates who prepared with ProCoach AI</p>
                    <motion.button
                        className="cta-button primary large"
                        onClick={onStartSetup}
                        whileHover={{ scale: 1.05, boxShadow: "0 20px 40px rgba(99, 102, 241, 0.5)" }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <Zap size={22} />
                        <span>Start Your Free Interview</span>
                        <ChevronRight size={22} />
                    </motion.button>
                </div>
            </motion.section>

            {/* Footer */}
            <footer className="landing-footer">
                <div className="footer-brand">
                    <span>ProCoach AI</span>
                </div>
                <p className="footer-copyright">© 2026 ProCoach AI. All rights reserved.</p>
            </footer>
        </motion.div>
    );
};

export default LandingPage;
