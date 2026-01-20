/**
 * Authentication Context and Hook
 * Manages user authentication state across the application
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
    
    // Check authentication status on mount
    useEffect(() => {
        checkAuth();
        
        // Listen for logout events from API service
        const handleLogout = () => {
            setUser(null);
            setIsAuthenticated(false);
            setDashboardData(null);
            setServerSettings(null);
        };
        
        window.addEventListener('auth:logout', handleLogout);
        return () => window.removeEventListener('auth:logout', handleLogout);
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
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            localStorage.removeItem('authToken');
        }
        
        setIsLoading(false);
    };
    
    const fetchDashboard = async () => {
        try {
            const data = await userAPI.getDashboard();
            if (data) {
                setDashboardData(data);
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
            await Promise.all([fetchDashboard(), fetchSettings()]);
        }
        return result;
    };
    
    const register = async (userData) => {
        const result = await authAPI.register(userData);
        if (result.success) {
            setUser(result.data.user);
            setIsAuthenticated(true);
            await Promise.all([fetchDashboard(), fetchSettings()]);
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
