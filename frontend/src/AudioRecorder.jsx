import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

// New enhanced components
import { AIAvatar, Avatar3D, AvatarPreview } from "./components/avatar";
import { AudioVisualizer } from "./components/audio";
import { RecordButton, Toast, ScoreDisplay, ScoreBadge, TypingIndicator } from "./components/ui";
import { VideoInterview, VideoPreview, VideoInterviewSummary } from "./components/video";
import soundEffects from "./utils/soundEffects";

// API URL - use environment variable or default to localhost
const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const AudioRecorder = ({ settings = {}, onInterviewComplete, onRequireAuth }) => {
    // Auth state (Phase 5)
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [authToken, setAuthToken] = useState(localStorage.getItem('authToken') || null);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
    const [authEmail, setAuthEmail] = useState('');
    const [authUsername, setAuthUsername] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [authFullName, setAuthFullName] = useState('');
    const [authError, setAuthError] = useState('');
    const [isAuthLoading, setIsAuthLoading] = useState(false);
    const [userStats, setUserStats] = useState(null);
    
    // Session state
    const [sessionId, setSessionId] = useState(null);
    const [selectedTopic, setSelectedTopic] = useState("general");
    const [selectedCompany, setSelectedCompany] = useState("default");
    const [selectedDifficulty, setSelectedDifficulty] = useState("medium");
    const [selectedDuration, setSelectedDuration] = useState(30);
    const [interviewMode, setInterviewMode] = useState("audio"); // 'audio' | 'video'
    const [interviewerGender, setInterviewerGender] = useState("male"); // 'male' | 'female'
    const [enableTTS, setEnableTTS] = useState(true);
    const [ttsEngine, setTtsEngine] = useState("edge"); // 'browser' | 'edge'
    const [edgeVoice, setEdgeVoice] = useState("en-US-GuyNeural");
    const [topics, setTopics] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [difficulties, setDifficulties] = useState([]);
    const [interviewStarted, setInterviewStarted] = useState(false);
    
    // Resume & Job Description state
    const [resumeFile, setResumeFile] = useState(null);
    const [resumeText, setResumeText] = useState("");
    const [resumeParsed, setResumeParsed] = useState(null);
    const [jobDescription, setJobDescription] = useState("");
    const [isParsingResume, setIsParsingResume] = useState(false);
    
    // Recording state
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [audioURL, setAudioURL] = useState(null);
    const [audioBlob, setAudioBlob] = useState(null);
    const [recordingTime, setRecordingTime] = useState(0);
    
    // Timer state
    const [elapsedTime, setElapsedTime] = useState(0);
    const [remainingTime, setRemainingTime] = useState(0);
    const [isTimeWarning, setIsTimeWarning] = useState(false);
    const [isTimeUp, setIsTimeUp] = useState(false);
    
    // Audio visualization state
    const [audioLevel, setAudioLevel] = useState(0);
    
    // Conversation state
    const [conversationHistory, setConversationHistory] = useState([]);
    const [questionCount, setQuestionCount] = useState(0);
    const [currentScore, setCurrentScore] = useState(null);
    const [averageScore, setAverageScore] = useState(null);
    const [difficultyTrend, setDifficultyTrend] = useState("stable");
    const [allScores, setAllScores] = useState([]);
    
    // Summary state
    const [showSummary, setShowSummary] = useState(false);
    const [summary, setSummary] = useState(null);
    
    // Phase 4: Analytics state
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [analytics, setAnalytics] = useState(null);
    const [questionFeedback, setQuestionFeedback] = useState(null);
    const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
    const [interviewHistory, setInterviewHistory] = useState([]);
    const [historyStats, setHistoryStats] = useState(null);
    
    // Phase 6: Coaching state
    const [showCoaching, setShowCoaching] = useState(false);
    const [liveCoaching, setLiveCoaching] = useState(null);
    const [speechAnalysis, setSpeechAnalysis] = useState(null);
    const [aiCoaching, setAiCoaching] = useState(null);
    const [improvementPlan, setImprovementPlan] = useState(null);
    const [isLoadingCoaching, setIsLoadingCoaching] = useState(false);
    
    // Phase 7: Error handling & notifications
    const [notification, setNotification] = useState(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    
    // Pending interview to save after login
    const [pendingInterviewToSave, setPendingInterviewToSave] = useState(null);
    
    // Setup step state
    const [setupStep, setSetupStep] = useState(1); // 1: basics, 2: resume/JD, 3: confirm
    
    // Video mode state
    const [showVideoPreview, setShowVideoPreview] = useState(false);
    const [videoExpressionHistory, setVideoExpressionHistory] = useState([]);
    const [videoMetrics, setVideoMetrics] = useState({});
    
    // Phase 8: Enhanced UI state
    const [avatarState, setAvatarState] = useState('idle'); // 'idle' | 'speaking' | 'listening' | 'thinking' | 'happy' | 'concerned'
    const [soundEnabled, setSoundEnabled] = useState(settings?.soundEffects ?? true);
    const [visualizerMode, setVisualizerMode] = useState('bars'); // 'bars' | 'wave' | 'circular' | 'orb'
    
    // Determine avatar gender and name based on selected interviewer gender and voice
    const avatarInfo = useMemo(() => {
        // Get interviewer name from voice
        const voiceNames = {
            'en-US-AriaNeural': 'ARIA',
            'en-US-JennyNeural': 'JENNY',
            'en-US-MichelleNeural': 'MICHELLE',
            'en-GB-SoniaNeural': 'SONIA',
            'en-AU-NatashaNeural': 'NATASHA',
            'en-IN-NeerjaNeural': 'NEERJA',
            'en-US-GuyNeural': 'GUY',
            'en-US-DavisNeural': 'DAVIS',
            'en-US-ChristopherNeural': 'CHRIS',
            'en-US-EricNeural': 'ERIC'
        };
        
        const info = {
            gender: interviewerGender,
            name: voiceNames[edgeVoice] || (interviewerGender === 'female' ? 'ARIA' : 'Saurabh')
        };
        console.log('[AudioRecorder] avatarInfo computed:', info, 'interviewerGender:', interviewerGender);
        return info;
    }, [edgeVoice, interviewerGender]);
    
    // Set default voice when interviewer gender changes
    useEffect(() => {
        if (interviewerGender === 'female') {
            setEdgeVoice('en-US-AriaNeural');
        } else {
            setEdgeVoice('en-US-GuyNeural');
        }
    }, [interviewerGender]);
    
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const chatEndRef = useRef(null);
    const ttsAudioRef = useRef(null);
    const timerIntervalRef = useRef(null);
    const recordingTimerRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);

    // Update sound enabled when settings change
    useEffect(() => {
        if (settings?.soundEffects !== undefined) {
            setSoundEnabled(settings.soundEffects);
        }
    }, [settings?.soundEffects]);

    // Notification helper
    const showNotification = useCallback((message, type = 'info', duration = 4000) => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), duration);
    }, []);
    
    // Online/offline detection
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            showNotification('You are back online!', 'success');
        };
        const handleOffline = () => {
            setIsOnline(false);
            showNotification('You are offline. Some features may not work.', 'warning');
        };
        
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [showNotification]);

    // Fetch available options on mount
    useEffect(() => {
        fetchTopics();
        fetchCompanies();
        fetchDifficulties();
        
        // Preload speech synthesis voices
        if ('speechSynthesis' in window) {
            window.speechSynthesis.getVoices();
            window.speechSynthesis.onvoiceschanged = () => {
                window.speechSynthesis.getVoices();
            };
        }
    }, []);

    // Auto-scroll to bottom of chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [conversationHistory]);

    // Interview timer - local fallback when backend is unavailable
    const timerStartRef = useRef(null);
    
    useEffect(() => {
        if (interviewStarted && sessionId) {
            // Initialize start time for local fallback
            if (!timerStartRef.current) {
                timerStartRef.current = Date.now();
            }
            
            timerIntervalRef.current = setInterval(async () => {
                try {
                    const response = await fetch(`${API_URL}/interview/${sessionId}/time`);
                    if (!response.ok) {
                        // Use local timer as fallback
                        const elapsed = Math.floor((Date.now() - timerStartRef.current) / 1000);
                        const remaining = Math.max(0, (selectedDuration * 60) - elapsed);
                        setElapsedTime(elapsed);
                        setRemainingTime(remaining);
                        setIsTimeWarning(remaining <= 300 && remaining > 0);
                        setIsTimeUp(remaining <= 0);
                        return;
                    }
                    const data = await response.json();
                    setElapsedTime(data.elapsed_seconds);
                    setRemainingTime(data.remaining_seconds);
                    setIsTimeWarning(data.is_warning);
                    setIsTimeUp(data.is_time_up);
                } catch (error) {
                    // Use local timer as fallback on error
                    const elapsed = Math.floor((Date.now() - timerStartRef.current) / 1000);
                    const remaining = Math.max(0, (selectedDuration * 60) - elapsed);
                    setElapsedTime(elapsed);
                    setRemainingTime(remaining);
                    setIsTimeWarning(remaining <= 300 && remaining > 0);
                    setIsTimeUp(remaining <= 0);
                }
            }, 1000);
            
            return () => {
                clearInterval(timerIntervalRef.current);
                timerStartRef.current = null;
            };
        }
    }, [interviewStarted, sessionId, selectedDuration]);

    // Recording timer
    useEffect(() => {
        if (isRecording) {
            setRecordingTime(0);
            recordingTimerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
            return () => clearInterval(recordingTimerRef.current);
        } else {
            clearInterval(recordingTimerRef.current);
        }
    }, [isRecording]);

    const fetchTopics = async () => {
        try {
            const response = await fetch(`${API_URL}/topics`);
            if (!response.ok) throw new Error('Failed to fetch topics');
            const data = await response.json();
            setTopics(data.topics);
        } catch (error) {
            console.error("Error fetching topics:", error);
            // Fallback topics when backend is unavailable
            setTopics([
                { id: 'general', name: 'General Technical' },
                { id: 'dsa', name: 'Data Structures & Algorithms' },
                { id: 'system_design', name: 'System Design' },
                { id: 'behavioral', name: 'Behavioral Interview' },
                { id: 'frontend', name: 'Frontend Development' },
                { id: 'backend', name: 'Backend Development' }
            ]);
        }
    };

    const fetchCompanies = async () => {
        try {
            const response = await fetch(`${API_URL}/companies`);
            if (!response.ok) throw new Error('Failed to fetch companies');
            const data = await response.json();
            setCompanies(data.companies);
        } catch (error) {
            console.error("Error fetching companies:", error);
            // Fallback companies when backend is unavailable
            setCompanies([
                { id: 'default', name: 'Standard Interview' },
                { id: 'google', name: 'Google Style' },
                { id: 'amazon', name: 'Amazon Style' },
                { id: 'meta', name: 'Meta Style' },
                { id: 'microsoft', name: 'Microsoft Style' },
                { id: 'startup', name: 'Startup Style' }
            ]);
        }
    };

    const fetchDifficulties = async () => {
        try {
            const response = await fetch(`${API_URL}/difficulties`);
            if (!response.ok) throw new Error('Failed to fetch difficulties');
            const data = await response.json();
            setDifficulties(data.difficulties);
        } catch (error) {
            console.error("Error fetching difficulties:", error);
            // Fallback difficulties when backend is unavailable
            setDifficulties([
                { id: 'easy', name: 'Easy', description: 'Entry-level questions' },
                { id: 'medium', name: 'Medium', description: 'Standard interview' },
                { id: 'hard', name: 'Hard', description: 'Senior-level questions' }
            ]);
        }
    };

    const handleResumeUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        setResumeFile(file);
        setIsParsingResume(true);
        
        const formData = new FormData();
        formData.append("file", file);
        
        try {
            const response = await fetch(`${API_URL}/resume/parse`, {
                method: "POST",
                body: formData
            });
            const data = await response.json();
            
            if (data.success) {
                setResumeText(data.parsed_info);
                setResumeParsed(data.parsed_info);
            }
        } catch (error) {
            console.error("Resume parse error:", error);
        }
        setIsParsingResume(false);
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Phase 4: Fetch detailed analytics
    const fetchAnalytics = async () => {
        if (!sessionId) return;
        try {
            const response = await fetch(`${API_URL}/interview/${sessionId}/analytics`);
            const data = await response.json();
            setAnalytics(data);
        } catch (error) {
            console.error("Error fetching analytics:", error);
        }
    };

    // Phase 4: Fetch question-by-question feedback
    const fetchQuestionFeedback = async () => {
        if (!sessionId) return;
        setIsLoadingFeedback(true);
        try {
            const response = await fetch(`${API_URL}/interview/${sessionId}/question-feedback`, {
                method: "POST"
            });
            const data = await response.json();
            setQuestionFeedback(data);
        } catch (error) {
            console.error("Error fetching feedback:", error);
        }
        setIsLoadingFeedback(false);
    };

    // Phase 4: Save interview to history
    const saveToHistory = async () => {
        if (!sessionId) return;
        try {
            await fetch(`${API_URL}/interview/history/save?session_id=${sessionId}`, {
                method: "POST"
            });
            fetchInterviewHistory();
        } catch (error) {
            console.error("Error saving to history:", error);
        }
    };

    // Phase 4: Fetch interview history
    const fetchInterviewHistory = async () => {
        try {
            const response = await fetch(`${API_URL}/interview/history`);
            const data = await response.json();
            setInterviewHistory(data.interviews || []);
        } catch (error) {
            console.error("Error fetching history:", error);
        }
    };

    // Phase 4: Fetch history stats
    const fetchHistoryStats = async () => {
        try {
            const response = await fetch(`${API_URL}/interview/history/stats`);
            const data = await response.json();
            setHistoryStats(data);
        } catch (error) {
            console.error("Error fetching stats:", error);
        }
    };

    // ============== PHASE 6: COACHING FUNCTIONS ==============
    
    const fetchLiveCoaching = async () => {
        if (!sessionId) return;
        setIsLoadingCoaching(true);
        try {
            const response = await fetch(`${API_URL}/interview/${sessionId}/coaching`);
            const data = await response.json();
            setLiveCoaching(data);
        } catch (error) {
            console.error("Error fetching live coaching:", error);
        }
        setIsLoadingCoaching(false);
    };
    
    const fetchSpeechAnalysis = async () => {
        if (!sessionId) return;
        setIsLoadingCoaching(true);
        try {
            const response = await fetch(`${API_URL}/interview/${sessionId}/speech-analysis`, {
                method: "POST"
            });
            const data = await response.json();
            setSpeechAnalysis(data);
        } catch (error) {
            console.error("Error fetching speech analysis:", error);
        }
        setIsLoadingCoaching(false);
    };
    
    const fetchAiCoaching = async () => {
        const coachingSessionId = sessionId || summary?.sessionId;
        if (!coachingSessionId) return;
        setIsLoadingCoaching(true);
        try {
            const response = await fetch(`${API_URL}/interview/${coachingSessionId}/ai-coaching`, {
                method: "POST"
            });
            const data = await response.json();
            setAiCoaching(data);
        } catch (error) {
            console.error("Error fetching AI coaching:", error);
        }
        setIsLoadingCoaching(false);
    };
    
    const fetchImprovementPlan = async () => {
        const planSessionId = sessionId || summary?.sessionId;
        if (!planSessionId) return;
        setIsLoadingCoaching(true);
        try {
            const response = await fetch(`${API_URL}/interview/${planSessionId}/improvement-plan`);
            const data = await response.json();
            setImprovementPlan(data);
        } catch (error) {
            console.error("Error fetching improvement plan:", error);
        }
        setIsLoadingCoaching(false);
    };

    // ============== PHASE 5: AUTHENTICATION ==============
    
    // Check auth status on mount and whenever localStorage changes (syncs with AuthContext)
    useEffect(() => {
        const checkAndSyncAuth = () => {
            const token = localStorage.getItem('authToken');
            if (token !== authToken) {
                setAuthToken(token);
            }
            if (token) {
                verifyAuth(token);
            } else {
                setIsAuthenticated(false);
                setUser(null);
            }
        };
        
        checkAndSyncAuth();
        
        // Listen for storage changes (when user logs in/out from App.jsx)
        const handleStorageChange = (e) => {
            if (e.key === 'authToken') {
                checkAndSyncAuth();
            }
        };
        
        // Also listen for custom auth events
        const handleAuthChange = () => checkAndSyncAuth();
        
        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('auth:login', handleAuthChange);
        window.addEventListener('auth:logout', handleAuthChange);
        
        // Poll for changes every 2 seconds as a fallback
        const pollInterval = setInterval(checkAndSyncAuth, 2000);
        
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('auth:login', handleAuthChange);
            window.removeEventListener('auth:logout', handleAuthChange);
            clearInterval(pollInterval);
        };
    }, [authToken]);
    
    const verifyAuth = async (token = authToken) => {
        if (!token) return;
        try {
            const response = await fetch(`${API_URL}/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setUser(data);
                setIsAuthenticated(true);
                setAuthToken(token);
                fetchUserStats();
            } else {
                // Token expired or invalid
                handleLogout();
            }
        } catch (error) {
            console.error("Auth verification error:", error);
            handleLogout();
        }
    };
    
    const fetchUserStats = async () => {
        if (!authToken) return;
        try {
            const response = await fetch(`${API_URL}/user/stats`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (response.ok) {
                const data = await response.json();
                setUserStats(data);
            }
        } catch (error) {
            console.error("Error fetching user stats:", error);
        }
    };
    
    const handleLogin = async (e) => {
        e.preventDefault();
        setAuthError('');
        setIsAuthLoading(true);
        
        try {
            const formData = new URLSearchParams();
            formData.append('username', authEmail);
            formData.append('password', authPassword);
            
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData
            });
            
            const data = await response.json();
            
            if (response.ok) {
                localStorage.setItem('authToken', data.access_token);
                setAuthToken(data.access_token);
                setUser(data.user);
                setIsAuthenticated(true);
                setShowAuthModal(false);
                resetAuthForm();
                fetchUserStats();
                
                // Dispatch auth:login event for other components
                window.dispatchEvent(new CustomEvent('auth:login'));
                
                // Auto-save pending interview if exists
                if (pendingInterviewToSave) {
                    await autoSaveInterviewAfterLogin(pendingInterviewToSave, data.access_token);
                    setPendingInterviewToSave(null);
                }
                
                showNotification('Welcome back! 🎉', 'success');
            } else {
                setAuthError(data.detail || 'Login failed');
            }
        } catch (error) {
            setAuthError('Network error. Please try again.');
        }
        setIsAuthLoading(false);
    };
    
    const handleRegister = async (e) => {
        e.preventDefault();
        setAuthError('');
        setIsAuthLoading(true);
        
        if (authPassword.length < 8) {
            setAuthError('Password must be at least 8 characters');
            setIsAuthLoading(false);
            return;
        }
        
        try {
            const response = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: authEmail,
                    username: authUsername || authEmail.split('@')[0],
                    password: authPassword,
                    full_name: authFullName
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                localStorage.setItem('authToken', data.access_token);
                setAuthToken(data.access_token);
                setUser(data.user);
                setIsAuthenticated(true);
                setShowAuthModal(false);
                resetAuthForm();
                
                // Dispatch auth:login event for other components
                window.dispatchEvent(new CustomEvent('auth:login'));
                
                // Auto-save pending interview if exists
                if (pendingInterviewToSave) {
                    await autoSaveInterviewAfterLogin(pendingInterviewToSave, data.access_token);
                    setPendingInterviewToSave(null);
                }
                
                showNotification('Account created! Welcome aboard! 🚀', 'success');
            } else {
                setAuthError(data.detail || 'Registration failed');
            }
        } catch (error) {
            setAuthError('Network error. Please try again.');
        }
        setIsAuthLoading(false);
    };
    
    // Auto-save interview after login/register
    const autoSaveInterviewAfterLogin = async (interviewSessionId, token) => {
        try {
            const response = await fetch(`${API_URL}/user/interviews/save?session_id=${interviewSessionId}`, {
                method: "POST",
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                showNotification('Interview automatically saved to your history! 📁', 'success');
                fetchInterviewHistory();
            }
        } catch (error) {
            console.error("Error auto-saving interview:", error);
        }
    };
    
    const handleLogout = () => {
        localStorage.removeItem('authToken');
        setAuthToken(null);
        setUser(null);
        setIsAuthenticated(false);
        setUserStats(null);
        // Dispatch logout event
        window.dispatchEvent(new CustomEvent('auth:logout'));
    };
    
    const resetAuthForm = () => {
        setAuthEmail('');
        setAuthUsername('');
        setAuthPassword('');
        setAuthFullName('');
        setAuthError('');
    };
    
    const getAuthHeaders = () => {
        // Always get the latest token from localStorage to stay in sync with AuthContext
        const token = authToken || localStorage.getItem('authToken');
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    };

    // Auth-aware action handler - shows login prompt for guests and stores pending interview
    const requireAuth = (action, actionName, interviewId = null) => {
        if (!isAuthenticated) {
            // Store the interview ID to auto-save after login
            if (interviewId) {
                setPendingInterviewToSave(interviewId);
            }
            setAuthMode('login');
            setShowAuthModal(true);
            showNotification(`Please login to ${actionName}. Your interview will be saved after login.`, 'info');
            return false;
        }
        return true;
    };

    // Phase 4: Export interview report (available for all, but saved data requires auth)
    const exportReport = async () => {
        const exportSessionId = sessionId || summary?.sessionId;
        if (!exportSessionId) {
            showNotification('No interview to export', 'error');
            return;
        }
        try {
            const response = await fetch(`${API_URL}/interview/${exportSessionId}/export`, {
                method: "POST",
                headers: getAuthHeaders()
            });
            const data = await response.json();
            
            // Download as JSON
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `interview-report-${exportSessionId.slice(0, 8)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showNotification('Report exported successfully!', 'success');
        } catch (error) {
            console.error("Error exporting report:", error);
            showNotification('Failed to export report', 'error');
        }
    };

    // Save to history - requires authentication (will auto-save after login if not authenticated)
    const handleSaveToHistory = async () => {
        // Use current sessionId or fall back to sessionId stored in summary
        const saveSessionId = sessionId || summary?.sessionId;
        if (!saveSessionId) {
            showNotification('No interview session to save', 'error');
            return;
        }
        
        // Pass the session ID to requireAuth so it can be saved after login
        if (!requireAuth(() => {}, 'save interview history', saveSessionId)) return;
        
        try {
            const response = await fetch(`${API_URL}/user/interviews/save?session_id=${saveSessionId}`, {
                method: "POST",
                headers: {
                    ...getAuthHeaders(),
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                showNotification(data.message || 'Interview saved to your history! ✅', 'success');
                fetchInterviewHistory();
            } else {
                const error = await response.json();
                showNotification(error.detail || 'Failed to save', 'error');
            }
        } catch (error) {
            console.error("Error saving to history:", error);
            showNotification('Failed to save interview', 'error');
        }
    };

    // Get AI Coaching - requires authentication
    const handleGetAiCoaching = async () => {
        if (!requireAuth(() => {}, 'get AI coaching')) return;
        fetchAiCoaching();
        fetchImprovementPlan();
    };

    // Share results - requires authentication
    const handleShareResults = async () => {
        if (!requireAuth(() => {}, 'share results')) return;
        
        // Create shareable text
        const shareText = `I just completed a ${selectedDifficulty} ${selectedTopic} interview on ProCoach AI and scored ${summary?.scores?.average || averageScore}/10! 🎯`;
        
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'My ProCoach AI Interview Results',
                    text: shareText,
                    url: window.location.origin
                });
                showNotification('Shared successfully!', 'success');
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Share failed:', error);
                }
            }
        } else {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(shareText);
            showNotification('Results copied to clipboard!', 'success');
        }
    };

    // Prefetch TTS audio - returns a promise that resolves when audio is ready to play
    const prefetchTTS = async (text) => {
        if (!enableTTS || !text) return null;
        
        if (ttsEngine === 'edge') {
            try {
                const response = await fetch(`${API_URL}/tts/edge`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        text: text,
                        voice: edgeVoice 
                    })
                });
                
                if (response.ok) {
                    const audioBlob = await response.blob();
                    const audioUrl = URL.createObjectURL(audioBlob);
                    const audio = new Audio(audioUrl);
                    audio.preload = 'auto';
                    
                    // Wait for audio to be at least partially loaded
                    await new Promise((resolve) => {
                        audio.oncanplay = resolve;
                        audio.oncanplaythrough = resolve;
                        audio.onerror = resolve;
                        // Shorter timeout - start playing when we have data
                        setTimeout(resolve, 100);
                    });
                    
                    return { audio, audioUrl };
                }
            } catch (error) {
                console.error('Edge TTS prefetch error:', error);
            }
        }
        return null;
    };
    
    // Play prefetched audio
    const playPrefetchedAudio = (prefetchedAudio) => {
        if (!prefetchedAudio) return;
        
        const { audio, audioUrl } = prefetchedAudio;
        
        setIsSpeaking(true);
        setAvatarState('speaking');
        if (soundEnabled) soundEffects.play('aiSpeaking');
        
        audio.onended = () => {
            setIsSpeaking(false);
            setAvatarState('idle');
            URL.revokeObjectURL(audioUrl);
        };
        audio.onerror = () => {
            setIsSpeaking(false);
            setAvatarState('idle');
            URL.revokeObjectURL(audioUrl);
        };
        
        audio.play().catch(() => {
            setIsSpeaking(false);
            setAvatarState('idle');
        });
    };
    
    // Fetch TTS and return promise that resolves when audio is ready + plays
    const fetchAndPlayTTS = async (text) => {
        if (!enableTTS || !text) return;
        
        if (ttsEngine === 'edge') {
            try {
                const response = await fetch(`${API_URL}/tts/edge`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        text: text,
                        voice: edgeVoice 
                    })
                });
                
                if (response.ok) {
                    const audioBlob = await response.blob();
                    const audioUrl = URL.createObjectURL(audioBlob);
                    const audio = new Audio(audioUrl);
                    audio.preload = 'auto';
                    
                    // NOW set speaking state and play
                    setIsSpeaking(true);
                    setAvatarState('speaking');
                    if (soundEnabled) soundEffects.play('aiSpeaking');
                    
                    audio.onended = () => {
                        setIsSpeaking(false);
                        setAvatarState('idle');
                        URL.revokeObjectURL(audioUrl);
                    };
                    audio.onerror = () => {
                        setIsSpeaking(false);
                        setAvatarState('idle');
                        URL.revokeObjectURL(audioUrl);
                    };
                    
                    // Play and return - audio will start as soon as buffer allows
                    await audio.play().catch(() => {
                        setIsSpeaking(false);
                        setAvatarState('idle');
                    });
                    return true;
                } else {
                    speakWithBrowserTTS(text);
                    return true;
                }
            } catch (error) {
                console.error('Edge TTS error:', error);
                speakWithBrowserTTS(text);
                return true;
            }
        } else {
            speakWithBrowserTTS(text);
            return true;
        }
    };
    
    const speakText = async (text) => {
        if (!enableTTS) return;
        
        // Set speaking state immediately for responsiveness
        setIsSpeaking(true);
        setAvatarState('speaking');
        
        // Play sound effect
        if (soundEnabled) soundEffects.play('aiSpeaking');
        
        if (ttsEngine === 'edge') {
            // Use Edge TTS (Microsoft Neural Voices - higher quality)
            try {
                const response = await fetch(`${API_URL}/tts/edge`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        text: text,
                        voice: edgeVoice 
                    })
                });
                
                if (response.ok) {
                    const audioBlob = await response.blob();
                    const audioUrl = URL.createObjectURL(audioBlob);
                    const audio = new Audio(audioUrl);
                    audio.preload = 'auto';
                    
                    audio.onended = () => {
                        setIsSpeaking(false);
                        setAvatarState('idle');
                        URL.revokeObjectURL(audioUrl);
                    };
                    audio.onerror = () => {
                        setIsSpeaking(false);
                        setAvatarState('idle');
                        URL.revokeObjectURL(audioUrl);
                    };
                    
                    // Play immediately without waiting
                    audio.play().catch(() => {
                        setIsSpeaking(false);
                        setAvatarState('idle');
                    });
                } else {
                    // Fallback to browser TTS
                    speakWithBrowserTTS(text);
                }
            } catch (error) {
                console.error('Edge TTS error:', error);
                // Fallback to browser TTS
                speakWithBrowserTTS(text);
            }
        } else {
            // Use Web Speech API (browser built-in TTS - free & reliable)
            speakWithBrowserTTS(text);
        }
    };
    
    const speakWithBrowserTTS = (text) => {
        if ('speechSynthesis' in window) {
            // Cancel any ongoing speech
            window.speechSynthesis.cancel();
            
            // Set speaking state
            setIsSpeaking(true);
            setAvatarState('speaking');
            if (soundEnabled) soundEffects.play('aiSpeaking');
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;
            
            // Try to get a good English voice
            const voices = window.speechSynthesis.getVoices();
            const englishVoice = voices.find(v => 
                v.lang.includes('en') && (v.name.includes('Google') || v.name.includes('Microsoft'))
            ) || voices.find(v => v.lang.includes('en'));
            
            if (englishVoice) {
                utterance.voice = englishVoice;
            }
            
            utterance.onend = () => {
                setIsSpeaking(false);
                setAvatarState('idle');
            };
            utterance.onerror = () => {
                setIsSpeaking(false);
                setAvatarState('idle');
            };
            
            window.speechSynthesis.speak(utterance);
        } else {
            setIsSpeaking(false);
            setAvatarState('idle');
        }
    };

    const startInterview = async () => {
        setIsProcessing(true);
        setAvatarState('thinking');
        
        // Play session start sound
        if (soundEnabled) soundEffects.play('sessionStart');
        
        try {
            const response = await fetch(`${API_URL}/interview/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    topic: selectedTopic, 
                    difficulty: selectedDifficulty,
                    company_style: selectedCompany,
                    enable_tts: enableTTS,
                    resume_text: resumeText || null,
                    job_description: jobDescription || null,
                    duration_minutes: selectedDuration,
                    mode: interviewMode
                })
            });
            const data = await response.json();
            
            setSessionId(data.session_id);
            setInterviewStarted(true);
            setConversationHistory([{ role: "assistant", content: data.opening_message }]);
            setQuestionCount(1);
            setRemainingTime(selectedDuration * 60);
            setAvatarState('idle');
            
            // Speak the opening message
            if (enableTTS) {
                speakText(data.opening_message);
            }
        } catch (error) {
            console.error("Error starting interview:", error);
            setAvatarState('idle');
            if (soundEnabled) soundEffects.play('error');
        }
        setIsProcessing(false);
    };

    const endInterview = async () => {
        if (!sessionId) return;
        
        setIsProcessing(true);
        
        // Play session end sound
        if (soundEnabled) soundEffects.play('sessionEnd');
        
        // Store session ID before ending so we can save to history later
        const completedSessionId = sessionId;
        
        try {
            const response = await fetch(`${API_URL}/interview/${sessionId}/end`, {
                method: "POST"
            });
            const data = await response.json();
            
            // Include session ID in summary for save-to-history functionality
            setSummary({ ...data, sessionId: completedSessionId });
            setShowSummary(true);
            setInterviewStarted(false);
            // Don't clear sessionId yet - keep it for save-to-history
            // setSessionId(null);
            setAvatarState('happy');
            
            // Notify parent component about interview completion for XP tracking
            if (onInterviewComplete && data.score !== undefined) {
                onInterviewComplete(data.score, selectedDifficulty, questionCount);
            }
            
            // Save to interview history
            const history = JSON.parse(localStorage.getItem('interviewHistory') || '[]');
            history.unshift({
                date: new Date().toISOString(),
                topic: selectedTopic,
                difficulty: selectedDifficulty,
                score: data.score || averageScore || 0,
                questionCount: questionCount
            });
            localStorage.setItem('interviewHistory', JSON.stringify(history.slice(0, 50))); // Keep last 50
        } catch (error) {
            console.error("Error ending interview:", error);
        }
        setIsProcessing(false);
    };

    const resetInterview = () => {
        setSessionId(null);
        setInterviewStarted(false);
        setConversationHistory([]);
        setQuestionCount(0);
        setShowSummary(false);
        setSummary(null);
        setAudioURL(null);
        setAudioBlob(null);
        setCurrentScore(null);
        setAverageScore(null);
        setAllScores([]);
        setDifficultyTrend("stable");
        setElapsedTime(0);
        setRemainingTime(0);
        setIsTimeWarning(false);
        setIsTimeUp(false);
        setSetupStep(1);
        setResumeFile(null);
        setResumeText("");
        setResumeParsed(null);
        setJobDescription("");
        // Phase 4: Reset analytics state
        setShowAnalytics(false);
        setAnalytics(null);
        setQuestionFeedback(null);
        // Phase 8: Reset UI state
        setAvatarState('idle');
        // Video mode: Reset video state
        setShowVideoPreview(false);
        setVideoExpressionHistory([]);
        setVideoMetrics({});
        setInterviewMode("audio");
    };

    const startRecording = async () => {
        try {
            // Play start recording sound
            if (soundEnabled) soundEffects.play('startRecording');
            
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Set up audio visualization
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            analyserRef.current = audioContextRef.current.createAnalyser();
            const source = audioContextRef.current.createMediaStreamSource(stream);
            source.connect(analyserRef.current);
            analyserRef.current.fftSize = 256;
            
            // Start visualization loop
            const updateLevel = () => {
                if (!isRecording) return;
                const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
                analyserRef.current.getByteFrequencyData(dataArray);
                const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                setAudioLevel(avg / 255);
                requestAnimationFrame(updateLevel);
            };
            
            mediaRecorderRef.current = new MediaRecorder(stream);
            chunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                const url = URL.createObjectURL(blob);
                setAudioURL(url);
                setAudioBlob(blob);
                setAudioLevel(0);
                // Close audio context
                if (audioContextRef.current) {
                    audioContextRef.current.close();
                }
                // Play stop recording sound
                if (soundEnabled) soundEffects.play('stopRecording');
                // Auto-send after recording stops
                analyzeAudioBlob(blob);
            };

            mediaRecorderRef.current.start();
            setAvatarState('listening');
            setIsRecording(true);
            
            // Start visualization after recording starts
            requestAnimationFrame(function updateLevel() {
                if (mediaRecorderRef.current?.state === 'recording' && analyserRef.current) {
                    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
                    analyserRef.current.getByteFrequencyData(dataArray);
                    const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                    setAudioLevel(avg / 255);
                    requestAnimationFrame(updateLevel);
                }
            });
        } catch (error) {
            console.error("Error accessing microphone:", error);
            if (soundEnabled) soundEffects.play('error');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setAvatarState('thinking');
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
    };

    const analyzeAudioBlob = async (blob) => {
        if (!blob || !sessionId) return;

        setIsProcessing(true);
        setAvatarState('thinking');
        
        // Play thinking sound
        if (soundEnabled) soundEffects.play('aiThinking');
        
        const formData = new FormData();
        formData.append("file", blob, "audio.webm");

        try {
            const response = await fetch(`${API_URL}/interview/${sessionId}/analyze`, {
                method: "POST",
                body: formData,
            });

            const data = await response.json();
            
            if (data.user_text) {
                setConversationHistory(prev => [
                    ...prev,
                    { role: "user", content: data.user_text, score: data.score }
                ]);
            }
            if (data.ai_response) {
                if (enableTTS) {
                    // Show text AND start audio together for sync
                    // Fetch audio first, then show text when audio starts playing
                    try {
                        const response = await fetch(`${API_URL}/tts/edge`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                text: data.ai_response,
                                voice: edgeVoice 
                            })
                        });
                        
                        if (response.ok) {
                            const audioBlob = await response.blob();
                            const audioUrl = URL.createObjectURL(audioBlob);
                            const audio = new Audio(audioUrl);
                            audio.preload = 'auto';
                            
                            audio.onended = () => {
                                setIsSpeaking(false);
                                setAvatarState('idle');
                                URL.revokeObjectURL(audioUrl);
                            };
                            audio.onerror = () => {
                                setIsSpeaking(false);
                                setAvatarState('idle');
                                URL.revokeObjectURL(audioUrl);
                            };
                            
                            // Show text AND play audio at the same moment
                            setConversationHistory(prev => [
                                ...prev,
                                { role: "assistant", content: data.ai_response }
                            ]);
                            setIsSpeaking(true);
                            setAvatarState('speaking');
                            if (soundEnabled) soundEffects.play('aiSpeaking');
                            
                            audio.play().catch(() => {
                                setIsSpeaking(false);
                                setAvatarState('idle');
                            });
                        } else {
                            // Fallback - show text first, then use browser TTS
                            setConversationHistory(prev => [
                                ...prev,
                                { role: "assistant", content: data.ai_response }
                            ]);
                            speakWithBrowserTTS(data.ai_response);
                        }
                    } catch (error) {
                        console.error('TTS sync error:', error);
                        // Fallback - show text first, then use browser TTS
                        setConversationHistory(prev => [
                            ...prev,
                            { role: "assistant", content: data.ai_response }
                        ]);
                        speakWithBrowserTTS(data.ai_response);
                    }
                } else {
                    // No TTS - just show text
                    setConversationHistory(prev => [
                        ...prev,
                        { role: "assistant", content: data.ai_response }
                    ]);
                }
            }
            if (data.question_number) {
                setQuestionCount(data.question_number);
            }
            if (data.score) {
                setCurrentScore(data.score);
                setAllScores(prev => [...prev, data.score]);
                
                // Play appropriate sound based on score
                if (soundEnabled) {
                    if (data.score >= 7) {
                        soundEffects.play('goodScore');
                        setAvatarState('happy');
                    } else if (data.score < 5) {
                        soundEffects.play('badScore');
                        setAvatarState('concerned');
                    }
                }
            }
            if (data.average_score) {
                setAverageScore(data.average_score);
            }
            if (data.difficulty_trend) {
                setDifficultyTrend(data.difficulty_trend);
            }
        } catch (error) {
            console.error("Error sending audio:", error);
            if (soundEnabled) soundEffects.play('error');
            setAvatarState('idle');
        }
        setIsProcessing(false);
    };

    // Video mode: Analyze audio with expression data
    const analyzeVideoAudio = async (blob, expressionData) => {
        if (!blob || !sessionId) return;

        setIsProcessing(true);
        setAvatarState('thinking');
        
        // Play thinking sound
        if (soundEnabled) soundEffects.play('aiThinking');
        
        const formData = new FormData();
        formData.append("file", blob, "audio.webm");
        formData.append("confidence", expressionData?.confidence || 0);
        formData.append("eye_contact", expressionData?.eyeContact || 0);
        formData.append("emotion", expressionData?.emotion || 'neutral');
        formData.append("engagement", expressionData?.engagement || 0);

        try {
            const response = await fetch(`${API_URL}/interview/${sessionId}/video/analyze`, {
                method: "POST",
                body: formData,
            });

            const data = await response.json();
            
            // Update expression history
            if (data.expression_data) {
                setVideoExpressionHistory(prev => [...prev, data.expression_data]);
            }
            if (data.video_metrics) {
                setVideoMetrics(data.video_metrics);
            }
            
            if (data.transcription) {
                setConversationHistory(prev => [
                    ...prev,
                    { role: "user", content: data.transcription, score: data.score, expression: expressionData }
                ]);
            }
            if (data.response) {
                if (enableTTS) {
                    // Show text AND start audio together for sync
                    try {
                        const ttsResponse = await fetch(`${API_URL}/tts/edge`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                text: data.response,
                                voice: edgeVoice 
                            })
                        });
                        
                        if (ttsResponse.ok) {
                            const audioBlob = await ttsResponse.blob();
                            const audioUrl = URL.createObjectURL(audioBlob);
                            const audio = new Audio(audioUrl);
                            audio.preload = 'auto';
                            
                            audio.onended = () => {
                                setIsSpeaking(false);
                                setAvatarState('idle');
                                URL.revokeObjectURL(audioUrl);
                            };
                            audio.onerror = () => {
                                setIsSpeaking(false);
                                setAvatarState('idle');
                                URL.revokeObjectURL(audioUrl);
                            };
                            
                            // Show text AND play audio at the same moment
                            setConversationHistory(prev => [
                                ...prev,
                                { role: "assistant", content: data.response }
                            ]);
                            setIsSpeaking(true);
                            setAvatarState('speaking');
                            if (soundEnabled) soundEffects.play('aiSpeaking');
                            
                            audio.play().catch(() => {
                                setIsSpeaking(false);
                                setAvatarState('idle');
                            });
                        } else {
                            // Fallback
                            setConversationHistory(prev => [
                                ...prev,
                                { role: "assistant", content: data.response }
                            ]);
                            speakWithBrowserTTS(data.response);
                        }
                    } catch (error) {
                        console.error('Video TTS sync error:', error);
                        setConversationHistory(prev => [
                            ...prev,
                            { role: "assistant", content: data.response }
                        ]);
                        speakWithBrowserTTS(data.response);
                    }
                } else {
                    setConversationHistory(prev => [
                        ...prev,
                        { role: "assistant", content: data.response }
                    ]);
                }
            }
            if (data.question_count) {
                setQuestionCount(data.question_count);
            }
            if (data.score) {
                setCurrentScore(data.score);
                setAllScores(prev => [...prev, data.score]);
                
                // Play appropriate sound based on score
                if (soundEnabled) {
                    if (data.score >= 7) {
                        soundEffects.play('goodScore');
                        setAvatarState('happy');
                    } else if (data.score < 5) {
                        soundEffects.play('badScore');
                        setAvatarState('concerned');
                    }
                }
            }
            if (data.average_score) {
                setAverageScore(data.average_score);
            }
            if (data.difficulty_trend) {
                setDifficultyTrend(data.difficulty_trend);
            }
        } catch (error) {
            console.error("Error sending video audio:", error);
            if (soundEnabled) soundEffects.play('error');
            setAvatarState('idle');
        }
        setIsProcessing(false);
    };

    // Video mode: End interview with expression data
    const endVideoInterview = async () => {
        if (!sessionId) return;
        
        setIsProcessing(true);
        
        // Play session end sound
        if (soundEnabled) soundEffects.play('sessionEnd');
        
        const completedSessionId = sessionId;
        
        try {
            const response = await fetch(`${API_URL}/interview/${sessionId}/video/end`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    expression_history: videoExpressionHistory
                })
            });
            const data = await response.json();
            
            // Include video-specific data in summary
            setSummary({ 
                ...data, 
                sessionId: completedSessionId,
                isVideoMode: true,
                videoMetrics: data.video_metrics || videoMetrics,
                expressionHistory: videoExpressionHistory,
                videoFeedback: data.video_feedback || ''
            });
            setShowSummary(true);
            setInterviewStarted(false);
            setAvatarState('happy');
            
            // Notify parent component
            if (onInterviewComplete && data.score !== undefined) {
                onInterviewComplete(data.score, selectedDifficulty, questionCount);
            }
            
            // Save to interview history
            const history = JSON.parse(localStorage.getItem('interviewHistory') || '[]');
            history.unshift({
                date: new Date().toISOString(),
                topic: selectedTopic,
                difficulty: selectedDifficulty,
                score: data.score || averageScore || 0,
                questionCount: questionCount,
                mode: 'video',
                expressionStats: {
                    avgConfidence: data.video_metrics?.averageConfidence || 0,
                    avgEyeContact: data.video_metrics?.averageEyeContact || 0
                }
            });
            localStorage.setItem('interviewHistory', JSON.stringify(history.slice(0, 50)));
        } catch (error) {
            console.error("Error ending video interview:", error);
        }
        setIsProcessing(false);
    };

    // ============== AUTH MODAL COMPONENT ==============
    const renderAuthModal = () => {
        if (!showAuthModal) return null;
        
        return (
            <div className="modal-overlay" onClick={() => setShowAuthModal(false)}>
                <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
                    <button className="modal-close" onClick={() => setShowAuthModal(false)}>×</button>
                    <h2>{authMode === 'login' ? '🔐 Welcome Back!' : '🚀 Create Account'}</h2>
                    
                    <form onSubmit={authMode === 'login' ? handleLogin : handleRegister}>
                        {authMode === 'register' && (
                            <div className="form-group">
                                <label>Full Name</label>
                                <input 
                                    type="text" 
                                    value={authFullName}
                                    onChange={(e) => setAuthFullName(e.target.value)}
                                    placeholder="Your Name"
                                />
                            </div>
                        )}
                        
                        <div className="form-group">
                            <label>Email</label>
                            <input 
                                type="email" 
                                value={authEmail}
                                onChange={(e) => setAuthEmail(e.target.value)}
                                placeholder="your@email.com"
                                required
                            />
                        </div>
                        
                        {authMode === 'register' && (
                            <div className="form-group">
                                <label>Username</label>
                                <input 
                                    type="text" 
                                    value={authUsername}
                                    onChange={(e) => setAuthUsername(e.target.value)}
                                    placeholder="username (optional)"
                                />
                            </div>
                        )}
                        
                        <div className="form-group">
                            <label>Password</label>
                            <input 
                                type="password" 
                                value={authPassword}
                                onChange={(e) => setAuthPassword(e.target.value)}
                                placeholder={authMode === 'register' ? 'Min 8 characters' : 'Your password'}
                                required
                            />
                        </div>
                        
                        {authError && <div className="auth-error">{authError}</div>}
                        
                        <button type="submit" className="btn btn-primary auth-submit" disabled={isAuthLoading}>
                            {isAuthLoading ? 'Please wait...' : (authMode === 'login' ? 'Sign In' : 'Create Account')}
                        </button>
                    </form>
                    
                    <div className="auth-switch">
                        {authMode === 'login' ? (
                            <p>Don't have an account? <button onClick={() => { setAuthMode('register'); resetAuthForm(); }}>Sign Up</button></p>
                        ) : (
                            <p>Already have an account? <button onClick={() => { setAuthMode('login'); resetAuthForm(); }}>Sign In</button></p>
                        )}
                    </div>
                </div>
            </div>
        );
    };
    
    // ============== AUTH HEADER COMPONENT ==============
    const renderAuthHeader = () => (
        <div className="auth-header">
            {!isOnline && (
                <span className="offline-indicator">📵 Offline</span>
            )}
            {isAuthenticated ? (
                <div className="user-info">
                    <span className="user-greeting">👋 Hi, {user?.full_name || user?.username || 'User'}!</span>
                    {userStats && (
                        <span className="user-stats-mini">
                            📊 {userStats.total_interviews || 0} interviews
                        </span>
                    )}
                    <button className="btn btn-small btn-ghost" onClick={handleLogout}>Logout</button>
                </div>
            ) : (
                <div className="auth-buttons">
                    <button className="btn btn-small btn-ghost" onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}>
                        Sign In
                    </button>
                    <button className="btn btn-small btn-primary" onClick={() => { setAuthMode('register'); setShowAuthModal(true); }}>
                        Sign Up
                    </button>
                </div>
            )}
        </div>
    );
    
    // ============== NOTIFICATION COMPONENT ==============
    const renderNotification = () => {
        if (!notification) return null;
        return (
            <div className={`notification ${notification.type}`}>
                <span className="notification-icon">
                    {notification.type === 'success' && '✅'}
                    {notification.type === 'error' && '❌'}
                    {notification.type === 'warning' && '⚠️'}
                    {notification.type === 'info' && 'ℹ️'}
                </span>
                <span className="notification-message">{notification.message}</span>
                <button className="notification-close" onClick={() => setNotification(null)}>×</button>
            </div>
        );
    };

    // Render summary view with analytics
    if (showSummary && summary) {
        // Video mode summary
        if (summary.isVideoMode) {
            return (
                <div className="interview-container video-mode">
                    {renderNotification()}
                    {renderAuthHeader()}
                    {renderAuthModal()}
                    <VideoInterviewSummary
                        score={summary.scores?.average ? summary.scores.average * 10 : 0}
                        totalQuestions={summary.total_questions || questionCount}
                        correctAnswers={summary.scores?.individual?.filter(s => s >= 7).length || 0}
                        duration={elapsedTime}
                        difficulty={summary.difficulty || selectedDifficulty}
                        topic={summary.topic || selectedTopic}
                        feedback={summary.feedback}
                        xpGained={summary.xp_gained}
                        onRestart={resetInterview}
                        questionsHistory={conversationHistory.filter(m => m.role === 'assistant').map((m, i) => ({
                            question: m.content,
                            score: summary.scores?.individual?.[i],
                            correct: (summary.scores?.individual?.[i] || 0) >= 7
                        }))}
                        sessionId={summary.sessionId}
                        isGuest={!isAuthenticated}
                        onRequireAuth={(action) => {
                            setAuthMode('login');
                            setShowAuthModal(true);
                        }}
                        videoMetrics={summary.videoMetrics}
                        expressionHistory={summary.expressionHistory || videoExpressionHistory}
                        videoFeedback={summary.videoFeedback}
                    />
                </div>
            );
        }
        
        // Standard audio mode summary
        return (
            <div className="interview-container">
                {renderNotification()}
                {renderAuthHeader()}
                {renderAuthModal()}
                <div className="summary-card">
                    <h2>🎉 Interview Complete!</h2>
                    <div className="summary-header">
                        <span className="topic-badge">{summary.topic}</span>
                        <span className="company-badge">{summary.company_style}</span>
                        <span className="difficulty-badge">{summary.difficulty}</span>
                    </div>
                    
                    {summary.scores && summary.scores.average && (
                        <div className="score-summary">
                            <div className="score-circle">
                                <span className="score-value">{summary.scores.average}</span>
                                <span className="score-label">/10</span>
                            </div>
                            <div className="score-details">
                                <p>📊 Questions: {summary.total_questions}</p>
                                <p>📈 Trend: {summary.scores.trend}</p>
                                <p>🎯 Range: {summary.scores.min} - {summary.scores.max}</p>
                            </div>
                        </div>
                    )}

                    {/* Phase 4: Score Chart */}
                    {summary.scores && summary.scores.individual && summary.scores.individual.length > 0 && (
                        <div className="score-chart">
                            <h4>📈 Score Progression</h4>
                            <div className="chart-bars">
                                {summary.scores.individual.map((score, idx) => (
                                    <div key={idx} className="chart-bar-container">
                                        <div 
                                            className={`chart-bar ${score >= 7 ? 'good' : score >= 5 ? 'ok' : 'poor'}`}
                                            style={{ height: `${score * 10}%` }}
                                        >
                                            <span className="bar-value">{score}</span>
                                        </div>
                                        <span className="bar-label">Q{idx + 1}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Phase 4: Question Feedback Section */}
                    <div className="feedback-section">
                        <button 
                            onClick={fetchQuestionFeedback}
                            disabled={isLoadingFeedback}
                            className="btn btn-secondary"
                        >
                            {isLoadingFeedback ? "⏳ Generating..." : "📝 Get Detailed Feedback"}
                        </button>
                        
                        {questionFeedback && questionFeedback.questions && (
                            <div className="question-feedback-list">
                                <h4>Question-by-Question Analysis</h4>
                                {questionFeedback.questions.map((q, idx) => (
                                    <div key={idx} className={`feedback-item ${q.category}`}>
                                        <div className="feedback-header">
                                            <span className="q-number">Q{q.index}</span>
                                            <span className={`q-score score-${q.category}`}>
                                                {q.score}/10
                                            </span>
                                        </div>
                                        <div className="feedback-question">
                                            <strong>Question:</strong> {q.question}
                                        </div>
                                        <div className="feedback-answer">
                                            <strong>Your Answer:</strong> {q.answer}
                                        </div>
                                        <div className="feedback-text">
                                            <strong>💡 Feedback:</strong> {q.feedback}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    <div className="summary-content">
                        <h3>📋 Performance Analysis</h3>
                        <pre className="summary-text">{summary.summary}</pre>
                    </div>

                    <div className="summary-actions">
                        <button onClick={resetInterview} className="btn btn-primary">
                            🔄 Start New Interview
                        </button>
                        
                        {/* Guest user notice and save button */}
                        {summary.is_guest && !isAuthenticated && (
                            <button 
                                onClick={() => {
                                    if (onRequireAuth) {
                                        onRequireAuth();
                                    } else {
                                        setAuthMode('login');
                                        setShowAuthModal(true);
                                    }
                                }}
                                className="btn btn-highlight"
                            >
                                🔐 Login to Save Progress
                            </button>
                        )}
                        
                        {isAuthenticated && (
                            <button onClick={handleSaveToHistory} className="btn btn-secondary">
                                💾 Save to History
                            </button>
                        )}
                        
                        <button onClick={handleGetAiCoaching} className="btn btn-secondary">
                            🎯 Get AI Coaching
                        </button>
                        <button onClick={exportReport} className="btn btn-secondary">
                            📥 Export Report
                        </button>
                        <button onClick={handleShareResults} className="btn btn-secondary">
                            📤 Share Results
                        </button>
                    </div>
                    
                    {/* Guest notice */}
                    {summary.is_guest && !isAuthenticated && (
                        <div className="guest-notice-banner">
                            <p>⚠️ You are using ProCoach AI as a guest. Your interview data will not be saved.</p>
                            <p>Create an account or login to save your history, track progress, and unlock achievements!</p>
                        </div>
                    )}
                    
                    {/* AI Coaching Results */}
                    {(aiCoaching || improvementPlan) && (
                        <div className="ai-coaching-section">
                            {isLoadingCoaching ? (
                                <div className="coaching-loading">
                                    <div className="spinner"></div>
                                    <p>Generating personalized coaching...</p>
                                </div>
                            ) : (
                                <>
                                    {aiCoaching?.coaching && (
                                        <div className="ai-coaching-card">
                                            <h3>🤖 AI Coaching Feedback</h3>
                                            
                                            {aiCoaching.coaching.overall_grade && (
                                                <div className="coaching-grade">
                                                    Grade: <span className="grade-value">{aiCoaching.coaching.overall_grade}</span>
                                                </div>
                                            )}
                                            
                                            {aiCoaching.coaching.key_strengths && (
                                                <div className="coaching-section">
                                                    <h4>✅ Key Strengths</h4>
                                                    <ul>
                                                        {aiCoaching.coaching.key_strengths.map((s, i) => (
                                                            <li key={i}>{s}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                            
                                            {aiCoaching.coaching.critical_improvements && (
                                                <div className="coaching-section">
                                                    <h4>📈 Critical Improvements</h4>
                                                    <ul>
                                                        {aiCoaching.coaching.critical_improvements.map((s, i) => (
                                                            <li key={i}>{s}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                            
                                            {aiCoaching.coaching.practice_exercises && (
                                                <div className="coaching-section">
                                                    <h4>🏋️ Practice Exercises</h4>
                                                    <div className="exercises-list">
                                                        {aiCoaching.coaching.practice_exercises.map((ex, i) => (
                                                            <div key={i} className="exercise-item">
                                                                <strong>{ex.exercise}</strong>
                                                                <p>{ex.description}</p>
                                                                {ex.duration && <span className="duration">⏱️ {ex.duration}</span>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {aiCoaching.coaching.motivational_note && (
                                                <div className="motivational-note">
                                                    💪 {aiCoaching.coaching.motivational_note}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    
                                    {improvementPlan && (
                                        <div className="improvement-plan-card">
                                            <h3>📅 Your Improvement Plan</h3>
                                            <p className="plan-duration">Estimated Duration: {improvementPlan.estimated_duration}</p>
                                            
                                            <div className="plan-timeline">
                                                {improvementPlan.improvement_plan?.map((item, i) => (
                                                    <div key={i} className="plan-week">
                                                        <div className="week-header">
                                                            <span className="week-label">Week {item.week}</span>
                                                            <span className="week-focus">{item.focus}</span>
                                                        </div>
                                                        <div className="week-goal">{item.goal}</div>
                                                        <ul className="week-activities">
                                                            {item.activities.map((activity, j) => (
                                                                <li key={j}>{activity}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                ))}
                                            </div>
                                            
                                            <div className="success-criteria">
                                                <h4>🎯 Success Criteria</h4>
                                                <div className="criteria-grid">
                                                    <div className="criteria-item">
                                                        <span className="label">Content Score</span>
                                                        <span className="target">{improvementPlan.success_criteria?.content_score}</span>
                                                    </div>
                                                    <div className="criteria-item">
                                                        <span className="label">Confidence</span>
                                                        <span className="target">{improvementPlan.success_criteria?.confidence_score}</span>
                                                    </div>
                                                    <div className="criteria-item">
                                                        <span className="label">Filler Words</span>
                                                        <span className="target">{improvementPlan.success_criteria?.filler_ratio}</span>
                                                    </div>
                                                    <div className="criteria-item">
                                                        <span className="label">STAR Method</span>
                                                        <span className="target">{improvementPlan.success_criteria?.star_completeness}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Render setup view
    if (!interviewStarted) {
        return (
            <div className="interview-container">
                {renderNotification()}
                {renderAuthHeader()}
                {renderAuthModal()}
                <div className="setup-card">
                    <h2>🎯 Setup Your ProCoach AI Interview</h2>
                    
                    {/* Progress Steps */}
                    <div className="setup-progress">
                        <div className={`progress-step ${setupStep >= 1 ? 'active' : ''}`}>
                            <span className="step-number">1</span>
                            <span className="step-label">Basics</span>
                        </div>
                        <div className="progress-line"></div>
                        <div className={`progress-step ${setupStep >= 2 ? 'active' : ''}`}>
                            <span className="step-number">2</span>
                            <span className="step-label">Context</span>
                        </div>
                        <div className="progress-line"></div>
                        <div className={`progress-step ${setupStep >= 3 ? 'active' : ''}`}>
                            <span className="step-number">3</span>
                            <span className="step-label">Start</span>
                        </div>
                    </div>

                    <div className="setup-form">
                        {/* Step 1: Basic Settings */}
                        {setupStep === 1 && (
                            <>
                                <div className="form-group">
                                    <label>📚 Interview Topic:</label>
                                    <select 
                                        value={selectedTopic} 
                                        onChange={(e) => setSelectedTopic(e.target.value)}
                                        className="topic-select"
                                    >
                                        {topics.map(topic => (
                                            <option key={topic.id} value={topic.id}>
                                                {topic.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div className="form-group">
                                    <label>🏢 Company Style:</label>
                                    <select 
                                        value={selectedCompany} 
                                        onChange={(e) => setSelectedCompany(e.target.value)}
                                        className="topic-select"
                                    >
                                        {companies.map(company => (
                                            <option key={company.id} value={company.id}>
                                                {company.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div className="form-group">
                                    <label>📊 Difficulty Level:</label>
                                    <div className="difficulty-buttons">
                                        {difficulties.map(diff => (
                                            <button
                                                key={diff.id}
                                                className={`difficulty-btn ${selectedDifficulty === diff.id ? 'active' : ''}`}
                                                onClick={() => setSelectedDifficulty(diff.id)}
                                            >
                                                {diff.id === 'easy' ? '🟢' : diff.id === 'medium' ? '🟡' : '🔴'} {diff.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                
                                <div className="form-group">
                                    <label>🎬 Interview Mode:</label>
                                    <div className="mode-buttons">
                                        <button
                                            className={`mode-btn-large ${interviewMode === 'audio' ? 'active' : ''}`}
                                            onClick={() => setInterviewMode('audio')}
                                        >
                                            <span className="mode-icon">🎤</span>
                                            <span className="mode-title">Audio Mode</span>
                                            <span className="mode-desc">Voice-based interview</span>
                                        </button>
                                        <button
                                            className={`mode-btn-large ${interviewMode === 'video' ? 'active video' : ''}`}
                                            onClick={() => setInterviewMode('video')}
                                        >
                                            <span className="mode-icon">📹</span>
                                            <span className="mode-title">Video Mode</span>
                                            <span className="mode-desc">With expression analysis</span>
                                            <span className="mode-badge">✨ Pro</span>
                                        </button>
                                    </div>
                                    {interviewMode === 'video' && (
                                        <div className="video-mode-features">
                                            <p>📹 Real-time video with AI interviewer</p>
                                            <p>😊 Expression & confidence analysis</p>
                                            <p>👁️ Eye contact tracking</p>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="form-group interviewer-selection">
                                    <label>👤 Choose Your Interviewer:</label>
                                    <div className="interviewer-cards">
                                        <motion.button
                                            className={`interviewer-card male ${interviewerGender === 'male' ? 'active' : ''}`}
                                            onClick={() => setInterviewerGender('male')}
                                            whileHover={{ scale: 1.02, y: -4 }}
                                            whileTap={{ scale: 0.98 }}
                                        >
                                            <div className="interviewer-preview">
                                                <AvatarPreview gender="male" isSelected={interviewerGender === 'male'} />
                                            </div>
                                            <div className="interviewer-info">
                                                <span className="interviewer-name">James</span>
                                                <span className="interviewer-role">Senior Technical Interviewer</span>
                                                <span className="interviewer-voice">🎙️ Professional Male Voice</span>
                                            </div>
                                            {interviewerGender === 'male' && (
                                                <motion.div 
                                                    className="selected-badge"
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                >
                                                    ✓ Selected
                                                </motion.div>
                                            )}
                                        </motion.button>
                                        
                                        <motion.button
                                            className={`interviewer-card female ${interviewerGender === 'female' ? 'active' : ''}`}
                                            onClick={() => setInterviewerGender('female')}
                                            whileHover={{ scale: 1.02, y: -4 }}
                                            whileTap={{ scale: 0.98 }}
                                        >
                                            <div className="interviewer-preview">
                                                <AvatarPreview gender="female" isSelected={interviewerGender === 'female'} />
                                            </div>
                                            <div className="interviewer-info">
                                                <span className="interviewer-name">Sarah</span>
                                                <span className="interviewer-role">Senior Technical Interviewer</span>
                                                <span className="interviewer-voice">🎙️ Professional Female Voice</span>
                                            </div>
                                            {interviewerGender === 'female' && (
                                                <motion.div 
                                                    className="selected-badge"
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                >
                                                    ✓ Selected
                                                </motion.div>
                                            )}
                                        </motion.button>
                                    </div>
                                </div>
                                
                                <div className="form-group">
                                    <label>⏱️ Interview Duration:</label>
                                    <div className="duration-buttons">
                                        {[15, 30, 45, 60].map(mins => (
                                            <button
                                                key={mins}
                                                className={`duration-btn ${selectedDuration === mins ? 'active' : ''}`}
                                                onClick={() => setSelectedDuration(mins)}
                                            >
                                                {mins} min
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                
                                <div className="form-group toggle-group">
                                    <label>🔊 AI Voice (TTS):</label>
                                    <button 
                                        className={`toggle-btn ${enableTTS ? 'active' : ''}`}
                                        onClick={() => setEnableTTS(!enableTTS)}
                                    >
                                        {enableTTS ? '✅ On' : '❌ Off'}
                                    </button>
                                </div>
                                
                                {enableTTS && (
                                    <>
                                        <div className="form-group">
                                            <label>🎙️ Voice Engine:</label>
                                            <div className="engine-buttons">
                                                <button
                                                    className={`engine-btn ${ttsEngine === 'edge' ? 'active' : ''}`}
                                                    onClick={() => setTtsEngine('edge')}
                                                >
                                                    🌐 Neural AI (Premium)
                                                </button>
                                                <button
                                                    className={`engine-btn ${ttsEngine === 'browser' ? 'active' : ''}`}
                                                    onClick={() => setTtsEngine('browser')}
                                                >
                                                    💻 Browser (Basic)
                                                </button>
                                            </div>
                                        </div>
                                        
                                        {ttsEngine === 'edge' && (
                                            <div className="form-group">
                                                <label>🎭 AI Voice:</label>
                                                <select 
                                                    value={edgeVoice} 
                                                    onChange={(e) => setEdgeVoice(e.target.value)}
                                                    className="voice-select"
                                                >
                                                    {interviewerGender === 'female' ? (
                                                        <optgroup label="Female Voices">
                                                            <option value="en-US-AriaNeural">Aria (US) - Conversational</option>
                                                            <option value="en-US-JennyNeural">Jenny (US) - Professional</option>
                                                            <option value="en-US-MichelleNeural">Michelle (US) - Natural</option>
                                                            <option value="en-GB-SoniaNeural">Sonia (UK) - British</option>
                                                            <option value="en-AU-NatashaNeural">Natasha (AU) - Australian</option>
                                                            <option value="en-IN-NeerjaNeural">Neerja (IN) - Indian</option>
                                                        </optgroup>
                                                    ) : (
                                                        <optgroup label="Male Voices">
                                                            <option value="en-US-GuyNeural">Guy (US) - Conversational</option>
                                                            <option value="en-US-DavisNeural">Davis (US) - Professional</option>
                                                            <option value="en-US-ChristopherNeural">Christopher (US) - Formal</option>
                                                            <option value="en-US-EricNeural">Eric (US) - Friendly</option>
                                                        </optgroup>
                                                    )}
                                                </select>
                                            </div>
                                        )}
                                    </>
                                )}
                                
                                <button 
                                    onClick={() => setSetupStep(2)} 
                                    className="btn btn-primary btn-large"
                                >
                                    Next: Add Context →
                                </button>
                            </>
                        )}

                        {/* Step 2: Resume & Job Description */}
                        {setupStep === 2 && (
                            <>
                                <div className="form-group">
                                    <label>📄 Upload Resume (Optional):</label>
                                    <p className="form-hint">AI will personalize questions based on your experience</p>
                                    <input 
                                        type="file" 
                                        accept=".txt,.pdf,.doc,.docx"
                                        onChange={handleResumeUpload}
                                        className="file-input"
                                    />
                                    {isParsingResume && (
                                        <div className="parsing-indicator">
                                            <span className="spinner"></span> Parsing resume...
                                        </div>
                                    )}
                                    {resumeParsed && (
                                        <div className="resume-preview">
                                            <span className="success-icon">✅</span>
                                            <span>Resume parsed: {resumeFile?.name}</span>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="form-group">
                                    <label>📋 Job Description (Optional):</label>
                                    <p className="form-hint">Paste job description to focus on relevant skills</p>
                                    <textarea 
                                        value={jobDescription}
                                        onChange={(e) => setJobDescription(e.target.value)}
                                        placeholder="Paste the job description here..."
                                        className="jd-textarea"
                                        rows={5}
                                    />
                                </div>
                                
                                <div className="button-group">
                                    <button 
                                        onClick={() => setSetupStep(1)} 
                                        className="btn btn-secondary"
                                    >
                                        ← Back
                                    </button>
                                    <button 
                                        onClick={() => setSetupStep(3)} 
                                        className="btn btn-primary"
                                    >
                                        Next: Review →
                                    </button>
                                </div>
                            </>
                        )}

                        {/* Step 3: Confirmation */}
                        {setupStep === 3 && (
                            <>
                                <div className="confirmation-summary">
                                    <h3>📋 Interview Configuration</h3>
                                    <div className="config-item">
                                        <span className="config-label">Interview Mode:</span>
                                        <span className={`config-value mode-value ${interviewMode}`}>
                                            {interviewMode === 'video' ? '📹 Video Mode' : '🎤 Audio Mode'}
                                        </span>
                                    </div>
                                    <div className="config-item">
                                        <span className="config-label">Topic:</span>
                                        <span className="config-value">{topics.find(t => t.id === selectedTopic)?.name}</span>
                                    </div>
                                    <div className="config-item">
                                        <span className="config-label">Company Style:</span>
                                        <span className="config-value">{companies.find(c => c.id === selectedCompany)?.name}</span>
                                    </div>
                                    <div className="config-item">
                                        <span className="config-label">Difficulty:</span>
                                        <span className="config-value">{selectedDifficulty.charAt(0).toUpperCase() + selectedDifficulty.slice(1)}</span>
                                    </div>
                                    <div className="config-item">
                                        <span className="config-label">Duration:</span>
                                        <span className="config-value">{selectedDuration} minutes</span>
                                    </div>
                                    <div className="config-item">
                                        <span className="config-label">AI Voice:</span>
                                        <span className="config-value">{enableTTS ? 'Enabled' : 'Disabled'}</span>
                                    </div>
                                    <div className="config-item">
                                        <span className="config-label">Resume:</span>
                                        <span className="config-value">{resumeParsed ? '✅ Uploaded' : '❌ Not provided'}</span>
                                    </div>
                                    <div className="config-item">
                                        <span className="config-label">Job Description:</span>
                                        <span className="config-value">{jobDescription ? '✅ Provided' : '❌ Not provided'}</span>
                                    </div>
                                </div>
                                
                                <div className="button-group">
                                    <button 
                                        onClick={() => setSetupStep(2)} 
                                        className="btn btn-secondary"
                                    >
                                        ← Back
                                    </button>
                                    <button 
                                        onClick={() => {
                                            if (interviewMode === 'video') {
                                                setShowVideoPreview(true);
                                            } else {
                                                startInterview();
                                            }
                                        }} 
                                        disabled={isProcessing}
                                        className="btn btn-primary"
                                    >
                                        {isProcessing ? "Starting..." : interviewMode === 'video' ? "📹 Camera Check" : "🚀 Start Interview"}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
                
                {/* Video Preview Modal */}
                {showVideoPreview && (
                    <div className="video-preview-overlay">
                        <VideoPreview
                            onReady={() => {
                                setShowVideoPreview(false);
                                startInterview();
                            }}
                            onCancel={() => setShowVideoPreview(false)}
                        />
                    </div>
                )}
            </div>
        );
    }

    // Render Video Interview view
    if (interviewStarted && interviewMode === 'video') {
        return (
            <VideoInterview
                sessionId={sessionId}
                onEndInterview={endVideoInterview}
                onSendAudio={analyzeVideoAudio}
                conversationHistory={conversationHistory}
                isProcessing={isProcessing}
                isSpeaking={isSpeaking}
                currentScore={currentScore}
                averageScore={averageScore}
                questionCount={questionCount}
                elapsedTime={elapsedTime}
                remainingTime={remainingTime}
                isTimeWarning={isTimeWarning}
                avatarState={avatarState}
                avatarInfo={avatarInfo}
                settings={settings}
                enableTTS={enableTTS}
            />
        );
    }

    // Render Audio interview view
    return (
        <div className="interview-container">
            {renderNotification()}
            {renderAuthHeader()}
            {renderAuthModal()}
            {/* Hidden audio element for TTS */}
            <audio ref={ttsAudioRef} style={{ display: 'none' }} />
            
            {/* Interview Timer Bar */}
            <motion.div 
                className={`timer-bar ${isTimeWarning ? 'warning' : ''} ${isTimeUp ? 'time-up' : ''}`}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <div className="timer-info">
                    <span className="timer-elapsed">⏱️ {formatTime(elapsedTime)}</span>
                    <span className="timer-remaining">
                        {isTimeUp ? '⏰ Time\'s Up!' : `${formatTime(remainingTime)} remaining`}
                    </span>
                </div>
                <div className="timer-progress">
                    <motion.div 
                        className="timer-progress-bar" 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (elapsedTime / (selectedDuration * 60)) * 100)}%` }}
                        transition={{ duration: 0.5 }}
                    />
                </div>
            </motion.div>
            
            <div className="interview-header">
                <div className="header-info">
                    <motion.span 
                        className="topic-badge"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500 }}
                    >
                        {selectedTopic.toUpperCase()}
                    </motion.span>
                    <span className="company-badge">{selectedCompany.toUpperCase()}</span>
                    <span className="question-count">Q#{questionCount}</span>
                    {averageScore && (
                        <ScoreBadge score={averageScore} maxScore={10} />
                    )}
                </div>
                <div className="header-actions">
                    {isSpeaking && <span className="speaking-indicator">🔊 Speaking...</span>}
                    <button 
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className={`btn btn-small btn-ghost ${soundEnabled ? '' : 'muted'}`}
                        title={soundEnabled ? 'Mute sounds' : 'Unmute sounds'}
                    >
                        {soundEnabled ? '🔊' : '🔇'}
                    </button>
                    <button 
                        onClick={() => { setShowCoaching(!showCoaching); if (!showCoaching) fetchLiveCoaching(); }}
                        className={`btn btn-coaching ${showCoaching ? 'active' : ''}`}
                    >
                        🎯 Coach
                    </button>
                    <button onClick={endInterview} className="btn btn-danger" disabled={isProcessing}>
                        End Interview
                    </button>
                </div>
            </div>
            
            {/* Two Column Layout - Avatar Left, Content Right */}
            <div className="interview-main-grid">
                {/* Left Side - AI Avatar Panel */}
                <motion.aside 
                    className="avatar-panel"
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                >
                    <div className="ai-avatar-section">
                        {/* 3D Avatar with GLB model - gender based on voice selection */}
                        <Avatar3D 
                            state={avatarState}
                            audioLevel={audioLevel}
                            score={currentScore}
                            size="large"
                            interviewerName={avatarInfo.name}
                            gender={avatarInfo.gender}
                            isSpeaking={isSpeaking}
                        />
                        {isSpeaking && (
                            <AudioVisualizer 
                                mode="circular"
                                isActive={true}
                                audioLevel={0.5 + Math.random() * 0.3}
                                color="primary"
                                size="medium"
                            />
                        )}
                    </div>
                    
                    {/* Avatar Name Badge */}
                    <div className="avatar-name-badge">
                        <span className="avatar-status-dot" />
                        <span className="avatar-name">{avatarInfo.name}</span>
                        <span className="avatar-role">AI Interviewer</span>
                    </div>
                </motion.aside>
                
                {/* Right Side - Content Panel */}
                <div className="content-panel">
            
            {/* Phase 6: Live Coaching Panel */}
            <AnimatePresence>
            {showCoaching && (
                <motion.div 
                    className="coaching-panel"
                    initial={{ opacity: 0, x: 300 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 300 }}
                >
                    <div className="coaching-header">
                        <h3>🎯 Live Interview Coach</h3>
                        <button className="close-btn" onClick={() => setShowCoaching(false)}>×</button>
                    </div>
                    
                    {isLoadingCoaching ? (
                        <div className="coaching-loading">
                            <div className="spinner"></div>
                            <p>Analyzing your performance...</p>
                        </div>
                    ) : liveCoaching ? (
                        <div className="coaching-content">
                            {/* Overall Status */}
                            <div className={`coaching-status ${liveCoaching.overall_performance?.score >= 7 ? 'good' : liveCoaching.overall_performance?.score >= 5 ? 'ok' : 'needs-work'}`}>
                                <span className="status-emoji">{liveCoaching.overall_performance?.emoji}</span>
                                <div className="status-info">
                                    <span className="status-score">{liveCoaching.overall_performance?.score}/10</span>
                                    <span className="status-message">{liveCoaching.overall_performance?.message}</span>
                                </div>
                            </div>
                            
                            {/* Key Metrics */}
                            <div className="coaching-metrics">
                                <div className="metric">
                                    <span className="metric-label">Confidence</span>
                                    <div className="metric-bar">
                                        <div className="metric-fill" style={{width: `${(liveCoaching.metrics?.confidence_score || 0) * 10}%`}}></div>
                                    </div>
                                    <span className="metric-value">{liveCoaching.metrics?.confidence_score}/10</span>
                                </div>
                                <div className="metric">
                                    <span className="metric-label">Filler Words</span>
                                    <div className="metric-bar">
                                        <div className="metric-fill warning" style={{width: `${Math.min(100, (liveCoaching.metrics?.filler_ratio_percent || 0) * 5)}%`}}></div>
                                    </div>
                                    <span className="metric-value">{liveCoaching.metrics?.filler_ratio_percent}%</span>
                                </div>
                                <div className="metric">
                                    <span className="metric-label">STAR Method</span>
                                    <div className="metric-bar">
                                        <div className="metric-fill" style={{width: `${liveCoaching.metrics?.star_completeness_percent || 0}%`}}></div>
                                    </div>
                                    <span className="metric-value">{liveCoaching.metrics?.star_completeness_percent}%</span>
                                </div>
                            </div>
                            
                            {/* Top Filler Words */}
                            {liveCoaching.top_filler_words && liveCoaching.top_filler_words.length > 0 && (
                                <div className="filler-words-section">
                                    <h4>⚠️ Your Top Filler Words</h4>
                                    <div className="filler-tags">
                                        {liveCoaching.top_filler_words.map(([word, count], idx) => (
                                            <span key={idx} className="filler-tag">"{word}" × {count}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            {/* Strengths & Improvements */}
                            <div className="coaching-feedback">
                                {liveCoaching.strengths?.length > 0 && (
                                    <div className="feedback-section strengths">
                                        <h4>✅ Strengths</h4>
                                        <ul>
                                            {liveCoaching.strengths.map((s, i) => <li key={i}>{s}</li>)}
                                        </ul>
                                    </div>
                                )}
                                {liveCoaching.improvements?.length > 0 && (
                                    <div className="feedback-section improvements">
                                        <h4>📈 Areas to Improve</h4>
                                        <ul>
                                            {liveCoaching.improvements.map((s, i) => <li key={i}>{s}</li>)}
                                        </ul>
                                    </div>
                                )}
                            </div>
                            
                            {/* Quick Tips */}
                            <div className="quick-tips">
                                <h4>💡 Quick Tips</h4>
                                {liveCoaching.quick_tips?.map((tip, i) => (
                                    <div key={i} className="tip">{tip}</div>
                                ))}
                            </div>
                            
                            {/* Action Buttons */}
                            <div className="coaching-actions">
                                <button onClick={fetchSpeechAnalysis} className="btn btn-secondary btn-small">
                                    📊 Speech Analysis
                                </button>
                                <button onClick={fetchLiveCoaching} className="btn btn-secondary btn-small">
                                    🔄 Refresh
                                </button>
                            </div>
                            
                            {/* Speech Analysis Results */}
                            {speechAnalysis && (
                                <div className="speech-analysis-detail">
                                    <h4>📊 Last Answer Analysis</h4>
                                    <div className="analysis-grid">
                                        <div className="analysis-item">
                                            <span className="label">Words</span>
                                            <span className="value">{speechAnalysis.speech_quality?.word_count}</span>
                                        </div>
                                        <div className="analysis-item">
                                            <span className="label">Clarity</span>
                                            <span className="value">{speechAnalysis.speech_quality?.clarity_score}/10</span>
                                        </div>
                                        <div className="analysis-item">
                                            <span className="label">Confidence</span>
                                            <span className="value">{speechAnalysis.speech_quality?.confidence_score}/10</span>
                                        </div>
                                        <div className="analysis-item">
                                            <span className="label">STAR</span>
                                            <span className="value">{speechAnalysis.star_analysis?.completeness_percent}%</span>
                                        </div>
                                    </div>
                                    
                                    {/* STAR Components */}
                                    <div className="star-breakdown">
                                        <div className={`star-component ${speechAnalysis.star_analysis?.detected_components?.situation ? 'found' : ''}`}>S</div>
                                        <div className={`star-component ${speechAnalysis.star_analysis?.detected_components?.task ? 'found' : ''}`}>T</div>
                                        <div className={`star-component ${speechAnalysis.star_analysis?.detected_components?.action ? 'found' : ''}`}>A</div>
                                        <div className={`star-component ${speechAnalysis.star_analysis?.detected_components?.result ? 'found' : ''}`}>R</div>
                                    </div>
                                    
                                    {/* Coaching Tips */}
                                    {speechAnalysis.coaching_tips?.length > 0 && (
                                        <div className="coaching-tips-list">
                                            {speechAnalysis.coaching_tips.slice(0, 3).map((tip, i) => (
                                                <div key={i} className={`coaching-tip ${tip.priority}`}>
                                                    <span className="tip-icon">{tip.icon}</span>
                                                    <div className="tip-content">
                                                        <strong>{tip.title}</strong>
                                                        <p>{tip.tip}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="coaching-empty">
                            <p>Answer a few questions to receive coaching feedback.</p>
                            <button onClick={fetchLiveCoaching} className="btn btn-primary">
                                Get Coaching
                            </button>
                        </div>
                    )}
                </motion.div>
            )}
            </AnimatePresence>

            <div className="chat-container">
                {conversationHistory.map((msg, index) => (
                    <div key={index} className={`message ${msg.role}`}>
                        <div className="message-avatar">
                            {msg.role === "assistant" ? "🤖" : "👤"}
                        </div>
                        <div className="message-content">
                            <div className="message-header">
                                <span className="message-role">
                                    {msg.role === "assistant" ? "Interviewer" : "You"}
                                </span>
                                {msg.score && (
                                    <span className="message-score">Score: {msg.score}/10</span>
                                )}
                            </div>
                            <p>{msg.content}</p>
                        </div>
                    </div>
                ))}
                
                {isProcessing && (
                    <div className="message assistant">
                        <div className="message-avatar">🤖</div>
                        <div className="message-content">
                            <span className="message-role">Interviewer</span>
                            <div className="typing-indicator">
                                <span></span><span></span><span></span>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>

            <motion.div 
                className="recording-controls"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
            >
                {/* Enhanced Audio Visualizer */}
                <AnimatePresence>
                    {isRecording && (
                        <motion.div 
                            className="recording-visualizer-enhanced"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                        >
                            <div className="recording-timer">
                                <motion.span 
                                    className="rec-dot"
                                    animate={{ opacity: [1, 0.3, 1] }}
                                    transition={{ duration: 1, repeat: Infinity }}
                                />
                                REC {formatTime(recordingTime)}
                            </div>
                            <AudioVisualizer 
                                mode={visualizerMode}
                                isActive={isRecording}
                                audioLevel={audioLevel}
                                color="danger"
                                size="medium"
                            />
                            <div className="visualizer-mode-selector">
                                {['bars', 'wave', 'circular', 'orb'].map(mode => (
                                    <button
                                        key={mode}
                                        className={`mode-btn ${visualizerMode === mode ? 'active' : ''}`}
                                        onClick={() => setVisualizerMode(mode)}
                                    >
                                        {mode === 'bars' && '📊'}
                                        {mode === 'wave' && '〰️'}
                                        {mode === 'circular' && '⭕'}
                                        {mode === 'orb' && '🔮'}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
                
                {/* Enhanced Record Button */}
                <RecordButton
                    isRecording={isRecording}
                    isProcessing={isProcessing}
                    isDisabled={isSpeaking}
                    audioLevel={audioLevel}
                    onStart={startRecording}
                    onStop={stopRecording}
                    size="large"
                    showLevel={true}
                    label={true}
                />
                
                {/* Processing Indicator */}
                <AnimatePresence>
                    {isProcessing && !isRecording && (
                        <motion.div 
                            className="processing-indicator"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <TypingIndicator variant="wave" color="primary" text="AI is thinking..." />
                        </motion.div>
                    )}
                </AnimatePresence>
                
                {audioURL && !isProcessing && !isRecording && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <audio src={audioURL} controls className="audio-playback" />
                    </motion.div>
                )}
            </motion.div>
                </div> {/* End content-panel */}
            </div> {/* End interview-main-grid */}
        </div>
    );
};

export default AudioRecorder;