import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Subtitles, MessageSquareOff, Settings, Volume2, 
    VolumeX, Type, Palette, X
} from 'lucide-react';
import './LiveCaptions.css';

/**
 * Live Captions component for accessibility
 * Provides real-time speech-to-text captions during interviews
 * Uses Web Speech API for recognition
 */
const LiveCaptions = ({
    isActive = true,
    language = 'en-US',
    onTranscript,
    position = 'bottom',
    showControls = true
}) => {
    const [isEnabled, setIsEnabled] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [captions, setCaptions] = useState([]);
    const [currentCaption, setCurrentCaption] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [error, setError] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    
    // Caption settings
    const [settings, setSettings] = useState({
        fontSize: 'medium', // 'small', 'medium', 'large'
        backgroundColor: 'dark', // 'dark', 'light', 'transparent'
        textColor: 'white',
        maxCaptions: 3,
        autoHide: true,
        autoHideDelay: 5000
    });

    const recognitionRef = useRef(null);
    const captionTimeoutRef = useRef(null);
    const captionsContainerRef = useRef(null);

    // Check for Web Speech API support
    const isSpeechRecognitionSupported = useCallback(() => {
        return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    }, []);

    // Initialize speech recognition
    useEffect(() => {
        if (!isSpeechRecognitionSupported()) {
            setError('Speech recognition is not supported in this browser');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognition();

        const recognition = recognitionRef.current;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = language;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            setIsListening(true);
            setError(null);
        };

        recognition.onend = () => {
            setIsListening(false);
            // Restart if still enabled
            if (isEnabled && isActive) {
                try {
                    recognition.start();
                } catch (e) {
                    // Already started
                }
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'not-allowed') {
                setError('Microphone access denied. Please allow microphone access for captions.');
            } else if (event.error !== 'aborted') {
                setError(`Recognition error: ${event.error}`);
            }
            setIsListening(false);
        };

        recognition.onresult = (event) => {
            let interim = '';
            let final = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    final += transcript;
                } else {
                    interim += transcript;
                }
            }

            setInterimTranscript(interim);

            if (final) {
                const newCaption = {
                    id: Date.now(),
                    text: final.trim(),
                    timestamp: new Date()
                };

                setCaptions(prev => {
                    const updated = [...prev, newCaption];
                    // Keep only last N captions
                    return updated.slice(-settings.maxCaptions);
                });

                setCurrentCaption(final.trim());

                if (onTranscript) {
                    onTranscript(newCaption);
                }

                // Auto-hide current caption
                if (settings.autoHide) {
                    if (captionTimeoutRef.current) {
                        clearTimeout(captionTimeoutRef.current);
                    }
                    captionTimeoutRef.current = setTimeout(() => {
                        setCurrentCaption('');
                    }, settings.autoHideDelay);
                }
            }
        };

        return () => {
            if (recognition) {
                recognition.stop();
            }
            if (captionTimeoutRef.current) {
                clearTimeout(captionTimeoutRef.current);
            }
        };
    }, [language, isEnabled, isActive, settings.maxCaptions, settings.autoHide, settings.autoHideDelay, onTranscript, isSpeechRecognitionSupported]);

    // Start/stop recognition based on enabled state
    useEffect(() => {
        if (!recognitionRef.current) return;

        if (isEnabled && isActive) {
            try {
                recognitionRef.current.start();
            } catch (e) {
                // Already started
            }
        } else {
            recognitionRef.current.stop();
        }
    }, [isEnabled, isActive]);

    // Update language
    useEffect(() => {
        if (recognitionRef.current) {
            recognitionRef.current.lang = language;
        }
    }, [language]);

    // Toggle captions
    const toggleCaptions = useCallback(() => {
        setIsEnabled(prev => !prev);
        if (isEnabled) {
            setCaptions([]);
            setCurrentCaption('');
            setInterimTranscript('');
        }
    }, [isEnabled]);

    // Update setting
    const updateSetting = useCallback((key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    }, []);

    // Get font size class
    const getFontSizeClass = () => {
        switch (settings.fontSize) {
            case 'small': return 'font-small';
            case 'large': return 'font-large';
            default: return 'font-medium';
        }
    };

    // Get background class
    const getBackgroundClass = () => {
        switch (settings.backgroundColor) {
            case 'light': return 'bg-light';
            case 'transparent': return 'bg-transparent';
            default: return 'bg-dark';
        }
    };

    if (!isActive) return null;

    return (
        <div className={`live-captions ${position}`}>
            {/* Caption Display */}
            <AnimatePresence>
                {isEnabled && (currentCaption || interimTranscript) && (
                    <motion.div
                        className={`captions-display ${getFontSizeClass()} ${getBackgroundClass()}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        ref={captionsContainerRef}
                    >
                        {/* Final caption */}
                        {currentCaption && (
                            <p className="caption-text final">{currentCaption}</p>
                        )}
                        
                        {/* Interim transcript */}
                        {interimTranscript && (
                            <p className="caption-text interim">{interimTranscript}</p>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Error Display */}
            {error && (
                <div className="captions-error">
                    <span>{error}</span>
                    <button onClick={() => setError(null)}>
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Controls */}
            {showControls && (
                <div className="captions-controls">
                    <motion.button
                        className={`caption-toggle ${isEnabled ? 'active' : ''}`}
                        onClick={toggleCaptions}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        title={isEnabled ? 'Turn off captions' : 'Turn on captions'}
                    >
                        {isEnabled ? <Subtitles size={18} /> : <MessageSquareOff size={18} />}
                        <span>{isEnabled ? 'CC On' : 'CC Off'}</span>
                        {isListening && <span className="listening-dot" />}
                    </motion.button>

                    <button
                        className="settings-btn"
                        onClick={() => setShowSettings(!showSettings)}
                        title="Caption settings"
                    >
                        <Settings size={16} />
                    </button>
                </div>
            )}

            {/* Settings Panel */}
            <AnimatePresence>
                {showSettings && (
                    <motion.div
                        className="captions-settings"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                    >
                        <div className="settings-header">
                            <span>Caption Settings</span>
                            <button onClick={() => setShowSettings(false)}>
                                <X size={16} />
                            </button>
                        </div>

                        <div className="settings-content">
                            {/* Font Size */}
                            <div className="setting-group">
                                <label>
                                    <Type size={14} />
                                    Font Size
                                </label>
                                <div className="setting-options">
                                    {['small', 'medium', 'large'].map(size => (
                                        <button
                                            key={size}
                                            className={settings.fontSize === size ? 'active' : ''}
                                            onClick={() => updateSetting('fontSize', size)}
                                        >
                                            {size.charAt(0).toUpperCase() + size.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Background */}
                            <div className="setting-group">
                                <label>
                                    <Palette size={14} />
                                    Background
                                </label>
                                <div className="setting-options">
                                    {['dark', 'light', 'transparent'].map(bg => (
                                        <button
                                            key={bg}
                                            className={settings.backgroundColor === bg ? 'active' : ''}
                                            onClick={() => updateSetting('backgroundColor', bg)}
                                        >
                                            {bg.charAt(0).toUpperCase() + bg.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Auto Hide */}
                            <div className="setting-group">
                                <label>Auto-hide captions</label>
                                <button
                                    className={`toggle-switch ${settings.autoHide ? 'on' : ''}`}
                                    onClick={() => updateSetting('autoHide', !settings.autoHide)}
                                >
                                    <span className="toggle-slider" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Transcript History (optional) */}
            {isEnabled && captions.length > 0 && (
                <div className="transcript-history">
                    {captions.map((caption) => (
                        <div key={caption.id} className="history-item">
                            <span className="history-time">
                                {caption.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                            <span className="history-text">{caption.text}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LiveCaptions;
