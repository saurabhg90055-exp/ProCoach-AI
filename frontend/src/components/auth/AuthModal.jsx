/**
 * Authentication Modal Component
 * Login and Signup forms in a modal overlay
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Lock, User, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import './AuthModal.css';

const AuthModal = ({ isOpen, onClose, initialMode = 'login' }) => {
    const [mode, setMode] = useState(initialMode);
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    
    // Form fields
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [fullName, setFullName] = useState('');
    
    const { login, register } = useAuth();
    const toast = useToast();
    
    // Update mode when initialMode prop changes
    useEffect(() => {
        setMode(initialMode);
    }, [initialMode]);
    
    const resetForm = () => {
        setEmail('');
        setPassword('');
        setUsername('');
        setFullName('');
        setError('');
        setShowPassword(false);
    };
    
    const switchMode = (newMode) => {
        setMode(newMode);
        setError('');
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        
        try {
            if (mode === 'login') {
                const result = await login(email, password);
                if (result.success) {
                    resetForm();
                    onClose();
                    toast.success('Welcome back! 🎉');
                } else {
                    setError(result.error);
                    toast.error(result.error);
                }
            } else {
                // Validation
                if (password.length < 8) {
                    setError('Password must be at least 8 characters');
                    setIsLoading(false);
                    return;
                }
                
                const result = await register({
                    email,
                    password,
                    username: username || email.split('@')[0],
                    full_name: fullName || null
                });
                
                if (result.success) {
                    resetForm();
                    onClose();
                    toast.success('Account created! Welcome aboard! 🚀');
                } else {
                    setError(result.error);
                    toast.error(result.error);
                }
            }
        } catch (err) {
            setError('Network error. Please try again.');
            toast.error('Network error. Please try again.');
        }
        
        setIsLoading(false);
    };
    
    const handleClose = () => {
        resetForm();
        onClose();
    };
    
    if (!isOpen) return null;
    
    return (
        <AnimatePresence>
            <motion.div
                className="auth-modal-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleClose}
            >
                <motion.div
                    className="auth-modal"
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    transition={{ type: 'spring', damping: 25 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button className="modal-close-btn" onClick={handleClose}>
                        <X size={20} />
                    </button>
                    
                    <div className="auth-modal-header">
                        <h2>{mode === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
                        <p>
                            {mode === 'login' 
                                ? 'Sign in to track your progress and achievements' 
                                : 'Join us to save your interview history and achievements'}
                        </p>
                    </div>
                    
                    {error && (
                        <motion.div
                            className="auth-error"
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            {error}
                        </motion.div>
                    )}
                    
                    <form onSubmit={handleSubmit} className="auth-form">
                        {mode === 'signup' && (
                            <>
                                <div className="form-group">
                                    <label htmlFor="fullName">Full Name (Optional)</label>
                                    <div className="input-wrapper">
                                        <User className="input-icon" size={18} />
                                        <input
                                            type="text"
                                            id="fullName"
                                            placeholder="John Doe"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                        />
                                    </div>
                                </div>
                                
                                <div className="form-group">
                                    <label htmlFor="username">Username</label>
                                    <div className="input-wrapper">
                                        <User className="input-icon" size={18} />
                                        <input
                                            type="text"
                                            id="username"
                                            placeholder="johndoe"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </>
                        )}
                        
                        <div className="form-group">
                            <label htmlFor="email">Email</label>
                            <div className="input-wrapper">
                                <Mail className="input-icon" size={18} />
                                <input
                                    type="email"
                                    id="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        
                        <div className="form-group">
                            <label htmlFor="password">Password</label>
                            <div className="input-wrapper">
                                <Lock className="input-icon" size={18} />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    id="password"
                                    placeholder={mode === 'signup' ? 'Minimum 8 characters' : '••••••••'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={mode === 'signup' ? 8 : undefined}
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                        
                        <button
                            type="submit"
                            className="auth-submit-btn"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="spin" size={18} />
                                    <span>{mode === 'login' ? 'Signing in...' : 'Creating account...'}</span>
                                </>
                            ) : (
                                <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
                            )}
                        </button>
                    </form>
                    
                    <div className="auth-footer">
                        {mode === 'login' ? (
                            <p>
                                Don't have an account?{' '}
                                <button onClick={() => switchMode('signup')}>Sign up</button>
                            </p>
                        ) : (
                            <p>
                                Already have an account?{' '}
                                <button onClick={() => switchMode('login')}>Sign in</button>
                            </p>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default AuthModal;
