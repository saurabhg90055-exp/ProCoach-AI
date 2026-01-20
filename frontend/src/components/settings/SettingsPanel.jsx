import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Settings, X, Volume2, VolumeX, Mic, Moon, Sun, 
    Keyboard, Bell, Eye, Zap, HelpCircle, User, Shield, Download
} from 'lucide-react';
import { ThemeSelector, useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import './SettingsPanel.css';

const SettingsPanel = ({ 
    isOpen, 
    onClose,
    settings,
    onSettingsChange
}) => {
    const { themeName, setTheme, availableThemes, themes } = useTheme();
    const { user, isAuthenticated, updateProfile } = useAuth();
    const toast = useToast();
    const [activeTab, setActiveTab] = useState('general');
    const [profileForm, setProfileForm] = useState({
        fullName: user?.full_name || '',
        email: user?.email || ''
    });
    const [isSaving, setIsSaving] = useState(false);

    const tabs = [
        { id: 'general', label: 'General', icon: <Settings size={18} /> },
        { id: 'audio', label: 'Audio', icon: <Volume2 size={18} /> },
        { id: 'display', label: 'Display', icon: <Eye size={18} /> },
        { id: 'notifications', label: 'Notifications', icon: <Bell size={18} /> },
        ...(isAuthenticated ? [{ id: 'profile', label: 'Profile', icon: <User size={18} /> }] : [])
    ];

    const handleToggle = (key) => {
        onSettingsChange({ ...settings, [key]: !settings[key] });
    };

    const handleSlider = (key, value) => {
        onSettingsChange({ ...settings, [key]: value });
    };
    
    const handleSaveProfile = async () => {
        setIsSaving(true);
        try {
            const result = await updateProfile({ full_name: profileForm.fullName });
            if (result && !result.detail) {
                toast.success('Profile updated successfully');
            } else {
                toast.error(result?.detail || 'Failed to update profile');
            }
        } catch (err) {
            toast.error('Failed to update profile');
        }
        setIsSaving(false);
    };
    
    const handleExportData = () => {
        // Export all user data as JSON
        const exportData = {
            settings,
            interviewHistory: JSON.parse(localStorage.getItem('interviewHistory') || '[]'),
            xpData: JSON.parse(localStorage.getItem('xpSystem') || '{}'),
            exportedAt: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-interviewer-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast.success('Data exported successfully');
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="settings-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                >
                    <motion.div
                        className="settings-panel"
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="settings-header">
                            <h2>Settings</h2>
                            <button className="close-btn" onClick={onClose}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="settings-tabs">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                                    onClick={() => setActiveTab(tab.id)}
                                >
                                    {tab.icon}
                                    <span>{tab.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Content */}
                        <div className="settings-content">
                            {/* General Tab */}
                            {activeTab === 'general' && (
                                <div className="settings-section">
                                    <div className="setting-item">
                                        <div className="setting-info">
                                            <span className="setting-label">Auto-submit answers</span>
                                            <span className="setting-desc">Automatically submit after speaking</span>
                                        </div>
                                        <ToggleSwitch 
                                            checked={settings?.autoSubmit ?? true}
                                            onChange={() => handleToggle('autoSubmit')}
                                        />
                                    </div>

                                    <div className="setting-item">
                                        <div className="setting-info">
                                            <span className="setting-label">Show hints</span>
                                            <span className="setting-desc">Display helpful hints during interview</span>
                                        </div>
                                        <ToggleSwitch 
                                            checked={settings?.showHints ?? true}
                                            onChange={() => handleToggle('showHints')}
                                        />
                                    </div>

                                    <div className="setting-item">
                                        <div className="setting-info">
                                            <span className="setting-label">Timer visible</span>
                                            <span className="setting-desc">Show countdown timer during questions</span>
                                        </div>
                                        <ToggleSwitch 
                                            checked={settings?.showTimer ?? true}
                                            onChange={() => handleToggle('showTimer')}
                                        />
                                    </div>

                                    <div className="setting-item">
                                        <div className="setting-info">
                                            <span className="setting-label">Keyboard shortcuts</span>
                                            <span className="setting-desc">Enable keyboard navigation</span>
                                        </div>
                                        <ToggleSwitch 
                                            checked={settings?.keyboardShortcuts ?? true}
                                            onChange={() => handleToggle('keyboardShortcuts')}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Audio Tab */}
                            {activeTab === 'audio' && (
                                <div className="settings-section">
                                    <div className="setting-item">
                                        <div className="setting-info">
                                            <span className="setting-label">Sound effects</span>
                                            <span className="setting-desc">Play sounds for actions</span>
                                        </div>
                                        <ToggleSwitch 
                                            checked={settings?.soundEffects ?? true}
                                            onChange={() => handleToggle('soundEffects')}
                                        />
                                    </div>

                                    <div className="setting-item">
                                        <div className="setting-info">
                                            <span className="setting-label">Text-to-speech</span>
                                            <span className="setting-desc">AI reads questions aloud</span>
                                        </div>
                                        <ToggleSwitch 
                                            checked={settings?.textToSpeech ?? true}
                                            onChange={() => handleToggle('textToSpeech')}
                                        />
                                    </div>

                                    <div className="setting-item column">
                                        <div className="setting-info">
                                            <span className="setting-label">Master volume</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            value={settings?.volume ?? 80}
                                            onChange={(e) => handleSlider('volume', parseInt(e.target.value))}
                                            className="volume-slider"
                                        />
                                        <span className="slider-value">{settings?.volume ?? 80}%</span>
                                    </div>

                                    <div className="setting-item column">
                                        <div className="setting-info">
                                            <span className="setting-label">Speech rate</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0.5"
                                            max="2"
                                            step="0.1"
                                            value={settings?.speechRate ?? 1}
                                            onChange={(e) => handleSlider('speechRate', parseFloat(e.target.value))}
                                            className="volume-slider"
                                        />
                                        <span className="slider-value">{settings?.speechRate ?? 1}x</span>
                                    </div>
                                </div>
                            )}

                            {/* Display Tab */}
                            {activeTab === 'display' && (
                                <div className="settings-section">
                                    <div className="setting-item column">
                                        <div className="setting-info">
                                            <span className="setting-label">Theme</span>
                                            <span className="setting-desc">Choose your color theme</span>
                                        </div>
                                        <div className="theme-grid">
                                            {availableThemes.map((name) => (
                                                <button
                                                    key={name}
                                                    className={`theme-btn ${themeName === name ? 'active' : ''}`}
                                                    onClick={() => setTheme(name)}
                                                    style={{
                                                        background: themes[name].colors.background
                                                    }}
                                                >
                                                    <span className="theme-color" style={{ background: themes[name].colors.primary }} />
                                                    <span className="theme-name">{themes[name].name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="setting-item">
                                        <div className="setting-info">
                                            <span className="setting-label">Show avatar</span>
                                            <span className="setting-desc">Display AI avatar during interview</span>
                                        </div>
                                        <ToggleSwitch 
                                            checked={settings?.showAvatar ?? true}
                                            onChange={() => handleToggle('showAvatar')}
                                        />
                                    </div>

                                    <div className="setting-item">
                                        <div className="setting-info">
                                            <span className="setting-label">Animations</span>
                                            <span className="setting-desc">Enable UI animations</span>
                                        </div>
                                        <ToggleSwitch 
                                            checked={settings?.animations ?? true}
                                            onChange={() => handleToggle('animations')}
                                        />
                                    </div>

                                    <div className="setting-item">
                                        <div className="setting-info">
                                            <span className="setting-label">Compact mode</span>
                                            <span className="setting-desc">Reduce spacing for smaller screens</span>
                                        </div>
                                        <ToggleSwitch 
                                            checked={settings?.compactMode ?? false}
                                            onChange={() => handleToggle('compactMode')}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Notifications Tab */}
                            {activeTab === 'notifications' && (
                                <div className="settings-section">
                                    <div className="setting-item">
                                        <div className="setting-info">
                                            <span className="setting-label">Achievement alerts</span>
                                            <span className="setting-desc">Show popup when earning achievements</span>
                                        </div>
                                        <ToggleSwitch 
                                            checked={settings?.achievementAlerts ?? true}
                                            onChange={() => handleToggle('achievementAlerts')}
                                        />
                                    </div>

                                    <div className="setting-item">
                                        <div className="setting-info">
                                            <span className="setting-label">Streak reminders</span>
                                            <span className="setting-desc">Remind to maintain practice streak</span>
                                        </div>
                                        <ToggleSwitch 
                                            checked={settings?.streakReminders ?? true}
                                            onChange={() => handleToggle('streakReminders')}
                                        />
                                    </div>

                                    <div className="setting-item">
                                        <div className="setting-info">
                                            <span className="setting-label">Progress updates</span>
                                            <span className="setting-desc">Show XP and level progress</span>
                                        </div>
                                        <ToggleSwitch 
                                            checked={settings?.progressUpdates ?? true}
                                            onChange={() => handleToggle('progressUpdates')}
                                        />
                                    </div>
                                </div>
                            )}
                            
                            {/* Profile Tab */}
                            {activeTab === 'profile' && isAuthenticated && (
                                <div className="settings-section">
                                    <div className="profile-header">
                                        <div className="profile-avatar">
                                            <User size={40} />
                                        </div>
                                        <div className="profile-info">
                                            <span className="profile-name">{user?.username}</span>
                                            <span className="profile-email">{user?.email}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="setting-item">
                                        <div className="setting-info">
                                            <span className="setting-label">Full Name</span>
                                        </div>
                                        <input 
                                            type="text"
                                            className="profile-input"
                                            value={profileForm.fullName}
                                            onChange={(e) => setProfileForm({...profileForm, fullName: e.target.value})}
                                            placeholder="Enter your full name"
                                        />
                                    </div>
                                    
                                    <div className="setting-item">
                                        <div className="setting-info">
                                            <span className="setting-label">Email</span>
                                        </div>
                                        <input 
                                            type="email"
                                            className="profile-input"
                                            value={user?.email || ''}
                                            disabled
                                        />
                                    </div>
                                    
                                    <div className="profile-actions">
                                        <button 
                                            className="save-profile-btn"
                                            onClick={handleSaveProfile}
                                            disabled={isSaving}
                                        >
                                            {isSaving ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    </div>
                                    
                                    <div className="settings-divider" />
                                    
                                    <div className="section-title">
                                        <Shield size={18} />
                                        <span>Data & Privacy</span>
                                    </div>
                                    
                                    <div className="setting-item">
                                        <div className="setting-info">
                                            <span className="setting-label">Export your data</span>
                                            <span className="setting-desc">Download all your interview history and settings</span>
                                        </div>
                                        <button className="export-btn" onClick={handleExportData}>
                                            <Download size={16} />
                                            Export
                                        </button>
                                    </div>
                                    
                                    <div className="setting-item">
                                        <div className="setting-info">
                                            <span className="setting-label">Account type</span>
                                            <span className="setting-desc">{user?.is_premium ? 'Premium' : 'Free'}</span>
                                        </div>
                                        {!user?.is_premium && (
                                            <span className="premium-badge">Upgrade</span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="settings-footer">
                            <button className="reset-btn" onClick={() => onSettingsChange({})}>
                                Reset to Defaults
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

// Toggle Switch Component
const ToggleSwitch = ({ checked, onChange }) => {
    return (
        <button
            className={`toggle-switch ${checked ? 'active' : ''}`}
            onClick={onChange}
            role="switch"
            aria-checked={checked}
        >
            <span className="toggle-slider" />
        </button>
    );
};

export default SettingsPanel;
