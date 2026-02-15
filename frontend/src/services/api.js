/**
 * API Service for AI Interviewer
 * Centralized API calls with authentication support
 */

const API_URL = import.meta.env.VITE_API_URL || "https://procoach-ai.onrender.com";

// Get auth token from localStorage
const getAuthToken = () => localStorage.getItem('authToken');

// Create headers with optional authentication
const createHeaders = (includeAuth = true, contentType = 'application/json') => {
    const headers = {};
    
    if (contentType) {
        headers['Content-Type'] = contentType;
    }
    
    if (includeAuth) {
        const token = getAuthToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
    }
    
    return headers;
};

// Generic fetch wrapper with error handling
const fetchWithAuth = async (endpoint, options = {}) => {
    const { includeAuth = true, ...fetchOptions } = options;
    
    const response = await fetch(`${API_URL}${endpoint}`, {
        ...fetchOptions,
        headers: {
            ...createHeaders(includeAuth, fetchOptions.headers?.['Content-Type']),
            ...fetchOptions.headers,
        },
    });
    
    if (response.status === 401) {
        // Token expired, clear auth
        localStorage.removeItem('authToken');
        window.dispatchEvent(new CustomEvent('auth:logout'));
    }
    
    return response;
};

// ============== AUTH API ==============

export const authAPI = {
    async login(email, password) {
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);
        
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('authToken', data.access_token);
            return { success: true, data };
        }
        
        return { success: false, error: data.detail || 'Login failed' };
    },
    
    async register(userData) {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('authToken', data.access_token);
            return { success: true, data };
        }
        
        return { success: false, error: data.detail || 'Registration failed' };
    },
    
    async getMe() {
        const response = await fetchWithAuth('/auth/me');
        if (response.ok) {
            return await response.json();
        }
        return null;
    },
    
    async updateProfile(updates) {
        const response = await fetchWithAuth('/auth/me', {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
        return response.json();
    },
    
    async changePassword(currentPassword, newPassword) {
        const response = await fetchWithAuth('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword
            })
        });
        return response.json();
    },
    
    async refreshToken(refreshToken) {
        const response = await fetch(`${API_URL}/auth/refresh?refresh_token=${refreshToken}`, {
            method: 'POST'
        });
        return response.json();
    },
    
    logout() {
        localStorage.removeItem('authToken');
        window.dispatchEvent(new CustomEvent('auth:logout'));
    }
};

// ============== USER DATA API ==============

export const userAPI = {
    async getStats() {
        const response = await fetchWithAuth('/user/stats');
        if (response.ok) {
            return await response.json();
        }
        return null;
    },
    
    async getXP() {
        const response = await fetchWithAuth('/user/xp');
        if (response.ok) {
            return await response.json();
        }
        return null;
    },
    
    async addXP(score, difficulty, questionCount) {
        const response = await fetchWithAuth(
            `/user/xp/add?score=${score}&difficulty=${difficulty}&question_count=${questionCount}`,
            { method: 'POST' }
        );
        return response.json();
    },
    
    async getAchievements() {
        const response = await fetchWithAuth('/user/achievements');
        if (response.ok) {
            return await response.json();
        }
        return null;
    },
    
    async getDashboard() {
        const response = await fetchWithAuth('/user/dashboard');
        if (response.ok) {
            return await response.json();
        }
        return null;
    },
    
    async getSettings() {
        const response = await fetchWithAuth('/auth/settings');
        if (response.ok) {
            return await response.json();
        }
        return null;
    },
    
    async updateSettings(settings) {
        const response = await fetchWithAuth('/auth/settings', {
            method: 'PUT',
            body: JSON.stringify(settings)
        });
        return response.json();
    },
    
    async syncUserData(totalXP, achievements, stats) {
        const response = await fetchWithAuth('/user/sync', {
            method: 'POST',
            body: JSON.stringify({
                total_xp: totalXP,
                achievements: achievements,
                stats: stats
            })
        });
        if (response.ok) {
            return await response.json();
        }
        return null;
    }
};

// ============== INTERVIEW API ==============

export const interviewAPI = {
    async getTopics() {
        const response = await fetch(`${API_URL}/topics`);
        return response.json();
    },
    
    async getCompanies() {
        const response = await fetch(`${API_URL}/companies`);
        return response.json();
    },
    
    async getDifficulties() {
        const response = await fetch(`${API_URL}/difficulties`);
        return response.json();
    },
    
    async startInterview(config) {
        const response = await fetchWithAuth('/interview/start', {
            method: 'POST',
            body: JSON.stringify(config)
        });
        return response.json();
    },
    
    async sendMessage(sessionId, audioBlob) {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        
        const response = await fetchWithAuth(`/interview/${sessionId}/message`, {
            method: 'POST',
            headers: {}, // Let browser set content-type for FormData
            body: formData
        });
        return response.json();
    },
    
    async endInterview(sessionId) {
        const response = await fetchWithAuth(`/interview/${sessionId}/end`, {
            method: 'POST'
        });
        return response.json();
    },
    
    async getTime(sessionId) {
        const response = await fetch(`${API_URL}/interview/${sessionId}/time`);
        return response.json();
    },
    
    async getAnalytics(sessionId) {
        const response = await fetchWithAuth(`/interview/${sessionId}/analytics`);
        return response.json();
    },
    
    async getQuestionFeedback(sessionId) {
        const response = await fetchWithAuth(`/interview/${sessionId}/question-feedback`, {
            method: 'POST'
        });
        return response.json();
    },
    
    async getCoaching(sessionId) {
        const response = await fetchWithAuth(`/interview/${sessionId}/coaching`);
        return response.json();
    },
    
    // Save to user's account (requires auth)
    async saveToUserHistory(sessionId) {
        const response = await fetchWithAuth(`/user/interviews/save?session_id=${sessionId}`, {
            method: 'POST'
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || `Failed to save interview: ${response.status}`);
        }
        return data;
    },
    
    // Save to local history (no auth required)
    async saveToLocalHistory(sessionId) {
        const response = await fetch(`${API_URL}/interview/history/save?session_id=${sessionId}`, {
            method: 'POST'
        });
        return response.json();
    },
    
    async getHistory() {
        const response = await fetchWithAuth('/user/interviews');
        if (response.ok) {
            return await response.json();
        }
        return { interviews: [] };
    },
    
    async deleteInterview(interviewId) {
        const response = await fetchWithAuth(`/user/interviews/${interviewId}`, {
            method: 'DELETE'
        });
        return response.json();
    },
    
    async exportReport(sessionId) {
        const response = await fetchWithAuth(`/interview/${sessionId}/export`, {
            method: 'POST'
        });
        return response.json();
    }
};

// ============== RESUME API ==============

export const resumeAPI = {
    async parse(file) {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`${API_URL}/resume/parse`, {
            method: 'POST',
            body: formData
        });
        return response.json();
    },
    
    async analyzeJob(jobDescription) {
        const formData = new FormData();
        formData.append('job_description', jobDescription);
        
        const response = await fetch(`${API_URL}/job/analyze`, {
            method: 'POST',
            body: formData
        });
        return response.json();
    }
};

export default {
    auth: authAPI,
    user: userAPI,
    interview: interviewAPI,
    resume: resumeAPI,
    API_URL
};
