import React, { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import AudioRecorder from './AudioRecorder';
import { ThemeProvider } from './components/theme/ThemeProvider';
import ConfettiCelebration, { useConfetti } from './components/effects/ConfettiCelebration';
import SettingsPanel from './components/settings/SettingsPanel';
import { useXPSystem, LevelProgressBar, XPGainPopup, AchievementUnlock } from './components/gamification/XPSystem';
import Dashboard from './components/dashboard/Dashboard';
import { LandingPage } from './components/landing';
import { useKeyboardShortcuts, KeyboardShortcutsHelp } from './hooks/useKeyboardShortcuts.jsx';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { AuthModal } from './components/auth';
import { Settings, BarChart2, Home, Trophy, Sparkles, LogIn, LogOut, User, Rocket } from 'lucide-react';
import './App.css';
import './components/gamification/XPSystem.css';
import './components/theme/ThemeProvider.css';

function AppContent() {
  const [currentView, setCurrentView] = useState('landing'); // 'landing', 'home', 'interview', 'dashboard'
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login');
  
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
      {/* Navigation Header */}
      <header className="app-header">
        <motion.div 
          className="logo-section"
          whileHover={{ scale: 1.02 }}
          onClick={() => setCurrentView('landing')}
        >
          <Sparkles className="logo-icon" />
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
              <div className="welcome-section">
                <h1 className="main-title">
                  <span className="gradient-text">Setup Your</span>
                  <br />
                  <span className="highlight-text">Mock Interview</span>
                </h1>
                <p className="main-subtitle">
                  Configure your interview session and start practicing with ProCoach AI
                </p>
              </div>
              <AudioRecorder 
                settings={settings}
                onInterviewComplete={handleInterviewComplete}
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