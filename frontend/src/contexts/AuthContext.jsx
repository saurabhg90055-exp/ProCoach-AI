/**
 * Authentication Context and Hook
 * Manages user authentication state across the application
 * Enhanced with better token persistence and cross-component sync
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI, userAPI } from '../services/api';

// Create context
const AuthContext = createContext(null);

// Auth Provider component
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [dashboardData, setDashboardData] = useState(null);
    const [serverSettings, setServerSettings] = useState(null);
    const [pendingInterviewToSave, setPendingInterviewToSave] = useState(null);
    
    // Check authentication status on mount and listen for auth events
    useEffect(() => {
        checkAuth();
        
        // Listen for logout events from API service
        const handleLogout = () => {
            setUser(null);
            setIsAuthenticated(false);
            setDashboardData(null);
            setServerSettings(null);
        };
        
        // Listen for login events (from other components like AudioRecorder)
        const handleExternalLogin = async () => {
            await checkAuth();
        };
        
        // Listen for storage changes (for multi-tab sync)
        const handleStorageChange = (e) => {
            if (e.key === 'authToken') {
                if (e.newValue) {
                    checkAuth();
                } else {
                    handleLogout();
                }
            }
        };
        
        window.addEventListener('auth:logout', handleLogout);
        window.addEventListener('auth:login', handleExternalLogin);
        window.addEventListener('storage', handleStorageChange);
        
        return () => {
            window.removeEventListener('auth:logout', handleLogout);
            window.removeEventListener('auth:login', handleExternalLogin);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);
    
    const checkAuth = async () => {
        const token = localStorage.getItem('authToken');
        if (!token) {
            setIsLoading(false);
            return;
        }
        
        try {
            const userData = await authAPI.getMe();
            if (userData) {
                setUser(userData);
                setIsAuthenticated(true);
                // Fetch dashboard data and settings
                await Promise.all([fetchDashboard(), fetchSettings()]);
            } else {
                localStorage.removeItem('authToken');
                setIsAuthenticated(false);
                setUser(null);
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            localStorage.removeItem('authToken');
            setIsAuthenticated(false);
            setUser(null);
        }
        
        setIsLoading(false);
    };
    
    const fetchDashboard = async () => {
        try {
            const data = await userAPI.getDashboard();
            if (data) {
                setDashboardData(data);
                
                // Sync server data DOWN to localStorage for consistency
                if (data.xp && data.xp.total_xp !== undefined) {
                    const localXP = parseInt(localStorage.getItem('userXP') || '0', 10);
                    // Take the higher value to preserve progress
                    const mergedXP = Math.max(localXP, data.xp.total_xp);
                    localStorage.setItem('userXP', mergedXP.toString());
                }
                
                // Merge achievements
                if (data.achievements && data.achievements.unlocked) {
                    try {
                        const localAch = new Set(JSON.parse(localStorage.getItem('unlockedAchievements') || '[]'));
                        data.achievements.unlocked.forEach(id => localAch.add(id));
                        localStorage.setItem('unlockedAchievements', JSON.stringify([...localAch]));
                    } catch (e) {
                        console.warn('Failed to merge achievements:', e);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to fetch dashboard:', error);
        }
    };
    
    const fetchSettings = async () => {
        try {
            const data = await userAPI.getSettings();
            if (data && !data.detail) {
                setServerSettings(data);
            }
        } catch (error) {
            console.error('Failed to fetch settings:', error);
        }
    };
    
    const syncSettings = async (settings) => {
        if (!isAuthenticated) return null;
        
        try {
            const result = await userAPI.updateSettings(settings);
            if (result && !result.detail) {
                setServerSettings(result);
            }
            return result;
        } catch (error) {
            console.error('Failed to sync settings:', error);
            return null;
        }
    };
    
    const login = async (email, password) => {
        const result = await authAPI.login(email, password);
        if (result.success) {
            setUser(result.data.user);
            setIsAuthenticated(true);
            
            // Sync local guest data UP to server
            try {
                const localXP = parseInt(localStorage.getItem('userXP') || '0', 10);
                const localAchievements = JSON.parse(localStorage.getItem('unlockedAchievements') || '[]');
                const localStats = JSON.parse(localStorage.getItem('userStats') || '{}');
                
                if (localXP > 0 || localAchievements.length > 0) {
                    await userAPI.syncUserData(localXP, localAchievements, localStats);
                }
            } catch (error) {
                console.error('Failed to sync local data on login:', error);
            }
            
            await Promise.all([fetchDashboard(), fetchSettings()]);
            // Dispatch event so AudioRecorder syncs auth state
            window.dispatchEvent(new CustomEvent('auth:login'));
        }
        return result;
    };
    
    const register = async (userData) => {
        const result = await authAPI.register(userData);
        if (result.success) {
            setUser(result.data.user);
            setIsAuthenticated(true);
            
            // Sync local guest data UP to server for new account
            try {
                const localXP = parseInt(localStorage.getItem('userXP') || '0', 10);
                const localAchievements = JSON.parse(localStorage.getItem('unlockedAchievements') || '[]');
                const localStats = JSON.parse(localStorage.getItem('userStats') || '{}');
                
                if (localXP > 0 || localAchievements.length > 0) {
                    await userAPI.syncUserData(localXP, localAchievements, localStats);
                }
            } catch (error) {
                console.error('Failed to sync local data on register:', error);
            }
            
            await Promise.all([fetchDashboard(), fetchSettings()]);
            // Dispatch event so AudioRecorder syncs auth state
            window.dispatchEvent(new CustomEvent('auth:login'));
        }
        return result;
    };
    
    const logout = useCallback(() => {
        authAPI.logout();
        setUser(null);
        setIsAuthenticated(false);
        setDashboardData(null);
        setServerSettings(null);
    }, []);
    
    const updateProfile = async (updates) => {
        const result = await authAPI.updateProfile(updates);
        if (result && !result.detail) {
            setUser(prev => ({ ...prev, ...updates }));
        }
        return result;
    };
    
    const refreshDashboard = async () => {
        if (isAuthenticated) {
            await fetchDashboard();
        }
    };
    
    const addXP = async (score, difficulty, questionCount) => {
        if (!isAuthenticated) return null;
        
        try {
            const result = await userAPI.addXP(score, difficulty, questionCount);
            // Refresh dashboard data to get updated XP
            await fetchDashboard();
            return result;
        } catch (error) {
            console.error('Failed to add XP:', error);
            return null;
        }
    };
    
    const value = {
        user,
        isAuthenticated,
        isLoading,
        dashboardData,
        serverSettings,
        login,
        register,
        logout,
        updateProfile,
        refreshDashboard,
        addXP,
        checkAuth,
        syncSettings
    };
    
    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

// Custom hook to use auth context
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export default AuthContext;
