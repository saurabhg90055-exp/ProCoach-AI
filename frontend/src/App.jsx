import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import AudioRecorder from './AudioRecorder';
import { ThemeProvider, useTheme } from './components/theme/ThemeProvider';
import ConfettiCelebration, { useConfetti } from './components/effects/ConfettiCelebration';
import SettingsPanel from './components/settings/SettingsPanel';
import { useXPSystem, LevelProgressBar, XPGainPopup, AchievementUnlock } from './components/gamification/XPSystem';
import Dashboard from './components/dashboard/Dashboard';
import { LandingPage } from './components/landing';
import { useKeyboardShortcuts, KeyboardShortcutsHelp } from './hooks/useKeyboardShortcuts.jsx';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { AuthModal } from './components/auth';
import { Settings, BarChart2, Home, Trophy, Star, LogIn, LogOut, User, Rocket } from 'lucide-react';
import './App.css';
import './components/gamification/XPSystem.css';
import './components/theme/ThemeProvider.css';

function AppContent() {
  const [currentView, setCurrentView] = useState('landing'); // 'landing', 'home', 'interview', 'dashboard'
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login');
  const [backgroundBlur, setBackgroundBlur] = useState(0);
  const rafRef = useRef(null);
  const lastScrollY = useRef(0);

  const { themeName, theme } = useTheme();

  // Reset scroll position when view changes
  useEffect(() => {
    window.scrollTo(0, 0);
    lastScrollY.current = 0;
  }, [currentView]);

  useEffect(() => {
    if (currentView !== 'landing') {
      setBackgroundBlur(12);
      return undefined;
    }

    // Reset blur at beginning for landing page
    setBackgroundBlur(0);

    const handleScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        if (Math.abs(scrollY - lastScrollY.current) > 2) {
          const maxBlur = 14;
          const scrollThreshold = 500;
          const blur = Math.min((scrollY / scrollThreshold) * maxBlur, maxBlur);
          setBackgroundBlur(blur);
          lastScrollY.current = scrollY;
        }
        rafRef.current = null;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [currentView]);

  // Auth context
  const { user, isAuthenticated, isLoading: authLoading, logout, dashboardData, addXP, syncSettings } = useAuth();
  const toast = useToast();

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('appSettings');
    return saved ? JSON.parse(saved) : {
      autoSubmit: true,
      showHints: true,
      showTimer: true,
      keyboardShortcuts: true,
      soundEffects: true,
      textToSpeech: true,
      volume: 80,
      speechRate: 1,
      showAvatar: true,
      animations: true,
      compactMode: false,
      achievementAlerts: true,
      streakReminders: true,
      progressUpdates: true
    };
  });

  // XP System (for non-authenticated users, falls back to localStorage)
  const {
    totalXP,
    stats,
    levelInfo,
    unlockedAchievements,
    pendingXP,
    newAchievement,
    recordInterview,
    clearPendingXP,
    clearNewAchievement
  } = useXPSystem();

  // Use authenticated user's data if available
  const displayTotalXP = isAuthenticated && dashboardData ? dashboardData.xp?.total_xp : totalXP;
  const displayLevelInfo = isAuthenticated && dashboardData ? {
    level: dashboardData.xp?.level,
    progress: dashboardData.xp?.progress
  } : levelInfo;
  const displayStats = isAuthenticated && dashboardData ? dashboardData.stats : stats;
  const displayAchievements = isAuthenticated && dashboardData ? dashboardData.achievements?.unlocked : unlockedAchievements;

  // Confetti
  const confetti = useConfetti();

  // Keyboard shortcuts
  useKeyboardShortcuts({
    show_shortcuts: () => setShortcutsOpen(true),
    cancel_action: () => {
      setShortcutsOpen(false);
      setSettingsOpen(false);
      setAuthModalOpen(false);
    }
  }, settings.keyboardShortcuts);

  // Handle settings change
  const handleSettingsChange = async (newSettings) => {
    setSettings(newSettings);
    localStorage.setItem('appSettings', JSON.stringify(newSettings));

    // Sync with server if authenticated
    if (isAuthenticated) {
      await syncSettings(newSettings);
    }
  };

  // Handle interview complete
  const handleInterviewComplete = useCallback(async (score, difficulty, questionCount) => {
    // If authenticated, sync XP with server
    if (isAuthenticated) {
      const result = await addXP(score, difficulty, questionCount);
      if (result?.new_achievements?.length > 0) {
        result.new_achievements.forEach(achievement => {
          toast.success(`🏆 Achievement Unlocked: ${achievement.name}`);
        });
      }
    }

    // Also record locally for immediate UI feedback
    const xpGained = recordInterview(score, difficulty, questionCount);

    // Show XP gain toast
    if (xpGained > 0) {
      toast.success(`+${xpGained} XP earned!`);
    }

    // Trigger confetti for good scores
    if (score >= 70) {
      confetti.celebrate();
      toast.success(`Great job! Score: ${score.toFixed(0)}% 🎉`);
    } else if (score >= 50) {
      toast.info(`Good effort! Score: ${score.toFixed(0)}%`);
    } else {
      toast.info(`Keep practicing! Score: ${score.toFixed(0)}%`);
    }

    return xpGained;
  }, [recordInterview, confetti, isAuthenticated, addXP, toast]);

  const openAuthModal = (mode = 'login') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  return (
    <div className="app-container">
      {/* Simple Gradient Background */}
      <div className="app-background" />

      {/* AI-Themed Decorative Background Elements */}
      <div
        className="bg-decorations"
        style={{ filter: `blur(${backgroundBlur}px)` }}
      >
        {/* Left side elements */}
        <div className="deco-element deco-left-1">
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <circle cx="100" cy="100" r="80" fill="url(#grad1)" opacity="0.15" />
            <defs>
              <radialGradient id="grad1" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
              </radialGradient>
            </defs>
          </svg>
        </div>
        <div className="deco-element deco-left-2">
          <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <polygon points="50,5 95,50 50,95 5,50" fill="none" stroke="#6366f1" strokeWidth="1" opacity="0.2" />
            <polygon points="50,15 85,50 50,85 15,50" fill="none" stroke="#8b5cf6" strokeWidth="1" opacity="0.15" />
            <polygon points="50,25 75,50 50,75 25,50" fill="none" stroke="#a855f7" strokeWidth="1" opacity="0.1" />
          </svg>
        </div>
        <div className="deco-element deco-left-3">
          <svg viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg">
            <circle cx="75" cy="75" r="60" fill="none" stroke="#6366f1" strokeWidth="0.5" opacity="0.2" strokeDasharray="4 4" />
            <circle cx="75" cy="75" r="45" fill="none" stroke="#8b5cf6" strokeWidth="0.5" opacity="0.15" strokeDasharray="2 6" />
            <circle cx="75" cy="75" r="30" fill="none" stroke="#a855f7" strokeWidth="0.5" opacity="0.1" />
          </svg>
        </div>

        {/* Right side elements */}
        <div className="deco-element deco-right-1">
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <circle cx="100" cy="100" r="80" fill="url(#grad2)" opacity="0.12" />
            <defs>
              <radialGradient id="grad2" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ec4899" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
              </radialGradient>
            </defs>
          </svg>
        </div>
        <div className="deco-element deco-right-2">
          <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <path d="M60,10 L110,60 L60,110 L10,60 Z" fill="none" stroke="#ec4899" strokeWidth="1" opacity="0.15" />
            <circle cx="60" cy="60" r="35" fill="none" stroke="#f472b6" strokeWidth="0.5" opacity="0.2" strokeDasharray="3 3" />
          </svg>
        </div>
        <div className="deco-element deco-right-3">
          <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="40" fill="url(#grad3)" opacity="0.1" />
            <defs>
              <radialGradient id="grad3" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#f472b6" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
              </radialGradient>
            </defs>
          </svg>
        </div>

        {/* Floating dots pattern - left */}
        <div className="deco-dots deco-dots-left">
          <svg viewBox="0 0 100 200" xmlns="http://www.w3.org/2000/svg">
            {[...Array(8)].map((_, i) => (
              <circle
                key={i}
                cx={20 + (i % 3) * 30}
                cy={20 + Math.floor(i / 3) * 50 + (i % 2) * 20}
                r={2 + (i % 3)}
                fill="#6366f1"
                opacity={0.1 + (i % 3) * 0.05}
              />
            ))}
          </svg>
        </div>

        {/* Floating dots pattern - right */}
        <div className="deco-dots deco-dots-right">
          <svg viewBox="0 0 100 200" xmlns="http://www.w3.org/2000/svg">
            {[...Array(8)].map((_, i) => (
              <circle
                key={i}
                cx={20 + (i % 3) * 30}
                cy={20 + Math.floor(i / 3) * 50 + (i % 2) * 20}
                r={2 + (i % 3)}
                fill="#ec4899"
                opacity={0.1 + (i % 3) * 0.05}
              />
            ))}
          </svg>
        </div>

        {/* Neural network lines - left */}
        <div className="deco-neural deco-neural-left">
          <svg viewBox="0 0 150 300" xmlns="http://www.w3.org/2000/svg">
            <line x1="20" y1="50" x2="80" y2="100" stroke="#6366f1" strokeWidth="0.5" opacity="0.15" />
            <line x1="80" y1="100" x2="40" y2="160" stroke="#8b5cf6" strokeWidth="0.5" opacity="0.12" />
            <line x1="40" y1="160" x2="100" y2="200" stroke="#6366f1" strokeWidth="0.5" opacity="0.1" />
            <line x1="100" y1="200" x2="60" y2="260" stroke="#a855f7" strokeWidth="0.5" opacity="0.08" />
            <circle cx="20" cy="50" r="4" fill="#6366f1" opacity="0.2" />
            <circle cx="80" cy="100" r="3" fill="#8b5cf6" opacity="0.15" />
            <circle cx="40" cy="160" r="4" fill="#6366f1" opacity="0.12" />
            <circle cx="100" cy="200" r="3" fill="#a855f7" opacity="0.1" />
            <circle cx="60" cy="260" r="4" fill="#8b5cf6" opacity="0.08" />
          </svg>
        </div>

        {/* Neural network lines - right */}
        <div className="deco-neural deco-neural-right">
          <svg viewBox="0 0 150 300" xmlns="http://www.w3.org/2000/svg">
            <line x1="130" y1="40" x2="70" y2="90" stroke="#ec4899" strokeWidth="0.5" opacity="0.15" />
            <line x1="70" y1="90" x2="110" y2="150" stroke="#f472b6" strokeWidth="0.5" opacity="0.12" />
            <line x1="110" y1="150" x2="50" y2="210" stroke="#ec4899" strokeWidth="0.5" opacity="0.1" />
            <line x1="50" y1="210" x2="90" y2="270" stroke="#f472b6" strokeWidth="0.5" opacity="0.08" />
            <circle cx="130" cy="40" r="4" fill="#ec4899" opacity="0.2" />
            <circle cx="70" cy="90" r="3" fill="#f472b6" opacity="0.15" />
            <circle cx="110" cy="150" r="4" fill="#ec4899" opacity="0.12" />
            <circle cx="50" cy="210" r="3" fill="#f472b6" opacity="0.1" />
            <circle cx="90" cy="270" r="4" fill="#ec4899" opacity="0.08" />
          </svg>
        </div>
      </div>

      {/* Navigation Header */}
      <header className="app-header">
        <motion.div
          className="logo-section"
          whileHover={{ scale: 1.02 }}
          onClick={() => setCurrentView('landing')}
        >
          <span className="logo-text">ProCoach AI</span>
        </motion.div>

        <nav className="main-nav">
          <button
            className={`nav-btn ${currentView === 'landing' ? 'active' : ''}`}
            onClick={() => setCurrentView('landing')}
          >
            <Home size={18} />
            <span>Home</span>
          </button>
          <button
            className={`nav-btn ${currentView === 'home' ? 'active' : ''}`}
            onClick={() => setCurrentView('home')}
          >
            <Rocket size={18} />
            <span>Interview</span>
          </button>
          <button
            className={`nav-btn ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentView('dashboard')}
          >
            <BarChart2 size={18} />
            <span>Dashboard</span>
          </button>
          <button
            className={`nav-btn ${currentView === 'achievements' ? 'active' : ''}`}
            onClick={() => setCurrentView('achievements')}
          >
            <Trophy size={18} />
            <span>Achievements</span>
          </button>
        </nav>

        <div className="header-actions">
          {/* Level Progress Mini */}
          <div className="mini-level">
            <span className="level-badge">Lvl {displayLevelInfo.level}</span>
            <div className="mini-progress">
              <div
                className="mini-progress-fill"
                style={{ width: `${displayLevelInfo.progress}%` }}
              />
            </div>
          </div>

          {/* Auth Button */}
          {isAuthenticated ? (
            <div className="user-menu">
              <button className="user-btn" title={user?.username || 'User'}>
                <User size={18} />
                <span className="user-name">{user?.username || 'User'}</span>
              </button>
              <button
                className="logout-btn"
                onClick={() => {
                  logout();
                  toast.info('Logged out successfully');
                }}
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <button
              className="login-btn"
              onClick={() => openAuthModal('login')}
            >
              <LogIn size={18} />
              <span>Login</span>
            </button>
          )}

          <button
            className="settings-btn"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className={`app-main ${currentView === 'landing' ? 'landing-main' : ''}`}>
        <AnimatePresence mode="wait">
          {currentView === 'landing' && (
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="landing-view"
            >
              <LandingPage
                onStartSetup={() => setCurrentView('home')}
                stats={displayStats}
              />
            </motion.div>
          )}

          {currentView === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="home-view"
            >
              <AudioRecorder

                settings={settings}
                onInterviewComplete={handleInterviewComplete}
                onRequireAuth={() => openAuthModal('login')}
              />
            </motion.div>
          )}

          {currentView === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Dashboard
                stats={displayStats}
                totalXP={displayTotalXP}
                unlockedAchievements={displayAchievements}
                interviewHistory={JSON.parse(localStorage.getItem('interviewHistory') || '[]')}
              />
            </motion.div>
          )}

          {currentView === 'achievements' && (
            <motion.div
              key="achievements"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="achievements-view"
            >
              <div className="achievements-header">
                <h2>Your Achievements</h2>
                <p>Unlock achievements by practicing interviews</p>
              </div>
              <div className="achievements-content">
                <LevelProgressBar totalXP={displayTotalXP} showDetails={true} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* XP Gain Popup */}
      <AnimatePresence>
        {pendingXP && settings.progressUpdates && (
          <XPGainPopup xpGained={pendingXP} onComplete={clearPendingXP} />
        )}
      </AnimatePresence>

      {/* Achievement Unlock */}
      <AnimatePresence>
        {newAchievement && settings.achievementAlerts && (
          <AchievementUnlock
            achievement={newAchievement}
            onClose={clearNewAchievement}
          />
        )}
      </AnimatePresence>

      {/* Confetti Celebration */}
      <ConfettiCelebration
        trigger={confetti.trigger}
        originX={confetti.originX}
        originY={confetti.originY}
        onComplete={confetti.reset}
      />

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSettingsChange={handleSettingsChange}
      />

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
      />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;