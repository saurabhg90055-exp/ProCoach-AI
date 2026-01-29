import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
    Maximize2, Minimize2, Clock, MessageSquare, Star,
    ChevronLeft, ChevronRight, Download, Share2, Bookmark,
    Flag, ThumbsUp, AlertCircle, X
} from 'lucide-react';
import './InterviewReplay.css';

/**
 * Interview Replay component
 * Allows users to review their recorded interviews with highlights and markers
 */
const InterviewReplay = ({
    recordingUrl,
    transcript = [], // Array of { timestamp, speaker, text, score }
    highlights = [], // Array of { timestamp, type, label }
    expressionData = [], // Array of { timestamp, confidence, eyeContact, emotion }
    duration = 0,
    onClose,
    onExport,
    interviewTitle = 'Interview Replay'
}) => {
    // Playback state
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    
    // UI state
    const [showTranscript, setShowTranscript] = useState(true);
    const [showHighlights, setShowHighlights] = useState(true);
    const [showExpressions, setShowExpressions] = useState(false);
    const [activeHighlight, setActiveHighlight] = useState(null);
    const [bookmarks, setBookmarks] = useState([]);

    const videoRef = useRef(null);
    const progressRef = useRef(null);
    const containerRef = useRef(null);

    // Format time
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Video event handlers
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleTimeUpdate = () => setCurrentTime(video.currentTime);
        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleEnded = () => {
            setIsPlaying(false);
            setCurrentTime(0);
        };

        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('ended', handleEnded);

        return () => {
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('ended', handleEnded);
        };
    }, []);

    // Toggle play/pause
    const togglePlay = useCallback(() => {
        if (!videoRef.current) return;
        if (isPlaying) {
            videoRef.current.pause();
        } else {
            videoRef.current.play();
        }
    }, [isPlaying]);

    // Seek to time
    const seekTo = useCallback((time) => {
        if (!videoRef.current) return;
        videoRef.current.currentTime = Math.max(0, Math.min(time, duration));
    }, [duration]);

    // Skip forward/backward
    const skip = useCallback((seconds) => {
        seekTo(currentTime + seconds);
    }, [currentTime, seekTo]);

    // Handle progress bar click
    const handleProgressClick = useCallback((e) => {
        if (!progressRef.current || !duration) return;
        const rect = progressRef.current.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        seekTo(percent * duration);
    }, [duration, seekTo]);

    // Change playback rate
    const changePlaybackRate = useCallback(() => {
        const rates = [0.5, 0.75, 1, 1.25, 1.5, 2];
        const currentIndex = rates.indexOf(playbackRate);
        const nextRate = rates[(currentIndex + 1) % rates.length];
        setPlaybackRate(nextRate);
        if (videoRef.current) {
            videoRef.current.playbackRate = nextRate;
        }
    }, [playbackRate]);

    // Toggle mute
    const toggleMute = useCallback(() => {
        if (!videoRef.current) return;
        videoRef.current.muted = !isMuted;
        setIsMuted(!isMuted);
    }, [isMuted]);

    // Toggle fullscreen
    const toggleFullscreen = useCallback(() => {
        if (!containerRef.current) return;
        
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    }, []);

    // Add bookmark at current time
    const addBookmark = useCallback(() => {
        const newBookmark = {
            id: Date.now(),
            time: currentTime,
            label: `Bookmark ${bookmarks.length + 1}`
        };
        setBookmarks(prev => [...prev, newBookmark].sort((a, b) => a.time - b.time));
    }, [currentTime, bookmarks.length]);

    // Remove bookmark
    const removeBookmark = useCallback((id) => {
        setBookmarks(prev => prev.filter(b => b.id !== id));
    }, []);

    // Find current transcript item
    const currentTranscriptIndex = transcript.findIndex((item, index) => {
        const nextItem = transcript[index + 1];
        return currentTime >= item.timestamp && 
               (!nextItem || currentTime < nextItem.timestamp);
    });

    // Find current expression data
    const currentExpression = expressionData.find((item, index) => {
        const nextItem = expressionData[index + 1];
        return currentTime >= item.timestamp && 
               (!nextItem || currentTime < nextItem.timestamp);
    });

    // Get highlight type color
    const getHighlightColor = (type) => {
        switch (type) {
            case 'good': return '#22c55e';
            case 'excellent': return '#8b5cf6';
            case 'improve': return '#eab308';
            case 'important': return '#ef4444';
            default: return '#60a5fa';
        }
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT') return;
            
            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'ArrowLeft':
                    skip(-5);
                    break;
                case 'ArrowRight':
                    skip(5);
                    break;
                case 'm':
                    toggleMute();
                    break;
                case 'f':
                    toggleFullscreen();
                    break;
                case 'b':
                    addBookmark();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [togglePlay, skip, toggleMute, toggleFullscreen, addBookmark]);

    return (
        <div 
            ref={containerRef}
            className={`interview-replay ${isFullscreen ? 'fullscreen' : ''}`}
        >
            {/* Header */}
            <div className="replay-header">
                <div className="header-left">
                    <h2>{interviewTitle}</h2>
                    <span className="duration-badge">
                        <Clock size={14} />
                        {formatTime(duration)}
                    </span>
                </div>
                <div className="header-actions">
                    {onExport && (
                        <button className="header-btn" onClick={onExport} title="Export">
                            <Download size={18} />
                        </button>
                    )}
                    <button className="header-btn" onClick={addBookmark} title="Add Bookmark (B)">
                        <Bookmark size={18} />
                    </button>
                    {onClose && (
                        <button className="header-btn close" onClick={onClose} title="Close">
                            <X size={18} />
                        </button>
                    )}
                </div>
            </div>

            <div className="replay-content">
                {/* Video Panel */}
                <div className="video-panel">
                    <div className="video-container">
                        <video
                            ref={videoRef}
                            src={recordingUrl}
                            className="replay-video"
                            onClick={togglePlay}
                        />

                        {/* Expression Overlay */}
                        {showExpressions && currentExpression && (
                            <div className="expression-overlay">
                                <div className="expr-item">
                                    <span>Confidence</span>
                                    <div className="expr-bar">
                                        <div 
                                            className="expr-fill confidence"
                                            style={{ width: `${currentExpression.confidence}%` }}
                                        />
                                    </div>
                                    <span>{currentExpression.confidence}%</span>
                                </div>
                                <div className="expr-item">
                                    <span>Eye Contact</span>
                                    <div className="expr-bar">
                                        <div 
                                            className="expr-fill eye-contact"
                                            style={{ width: `${currentExpression.eyeContact}%` }}
                                        />
                                    </div>
                                    <span>{currentExpression.eyeContact}%</span>
                                </div>
                                <div className="expr-item emotion">
                                    <span>{currentExpression.emotion}</span>
                                </div>
                            </div>
                        )}

                        {/* Play Overlay */}
                        {!isPlaying && (
                            <div className="play-overlay" onClick={togglePlay}>
                                <motion.div
                                    className="play-button"
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                >
                                    <Play size={40} />
                                </motion.div>
                            </div>
                        )}
                    </div>

                    {/* Progress Bar */}
                    <div className="progress-container">
                        <div 
                            ref={progressRef}
                            className="progress-bar"
                            onClick={handleProgressClick}
                        >
                            <div 
                                className="progress-fill"
                                style={{ width: `${(currentTime / duration) * 100}%` }}
                            />
                            
                            {/* Highlight Markers */}
                            {showHighlights && highlights.map((highlight, idx) => (
                                <div
                                    key={idx}
                                    className="highlight-marker"
                                    style={{ 
                                        left: `${(highlight.timestamp / duration) * 100}%`,
                                        backgroundColor: getHighlightColor(highlight.type)
                                    }}
                                    title={highlight.label}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        seekTo(highlight.timestamp);
                                    }}
                                />
                            ))}

                            {/* Bookmark Markers */}
                            {bookmarks.map((bookmark) => (
                                <div
                                    key={bookmark.id}
                                    className="bookmark-marker"
                                    style={{ left: `${(bookmark.time / duration) * 100}%` }}
                                    title={bookmark.label}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        seekTo(bookmark.time);
                                    }}
                                />
                            ))}
                        </div>
                        
                        <div className="time-display">
                            <span>{formatTime(currentTime)}</span>
                            <span>/</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="replay-controls">
                        <div className="controls-left">
                            <button className="control-btn" onClick={() => skip(-10)} title="Back 10s">
                                <SkipBack size={18} />
                            </button>
                            <button 
                                className="control-btn play-pause"
                                onClick={togglePlay}
                                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                            >
                                {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                            </button>
                            <button className="control-btn" onClick={() => skip(10)} title="Forward 10s">
                                <SkipForward size={18} />
                            </button>
                        </div>

                        <div className="controls-center">
                            <button 
                                className="speed-btn"
                                onClick={changePlaybackRate}
                                title="Playback Speed"
                            >
                                {playbackRate}x
                            </button>
                        </div>

                        <div className="controls-right">
                            <button 
                                className="control-btn"
                                onClick={toggleMute}
                                title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                            >
                                {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                            </button>
                            <button
                                className={`control-btn ${showExpressions ? 'active' : ''}`}
                                onClick={() => setShowExpressions(!showExpressions)}
                                title="Show Expressions"
                            >
                                <AlertCircle size={18} />
                            </button>
                            <button
                                className="control-btn"
                                onClick={toggleFullscreen}
                                title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
                            >
                                {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="replay-sidebar">
                    {/* Tabs */}
                    <div className="sidebar-tabs">
                        <button 
                            className={showTranscript ? 'active' : ''}
                            onClick={() => { setShowTranscript(true); setShowHighlights(false); }}
                        >
                            <MessageSquare size={14} />
                            Transcript
                        </button>
                        <button
                            className={showHighlights && !showTranscript ? 'active' : ''}
                            onClick={() => { setShowHighlights(true); setShowTranscript(false); }}
                        >
                            <Star size={14} />
                            Highlights
                        </button>
                    </div>

                    {/* Transcript View */}
                    {showTranscript && (
                        <div className="transcript-view">
                            {transcript.map((item, index) => (
                                <div 
                                    key={index}
                                    className={`transcript-item ${index === currentTranscriptIndex ? 'active' : ''} ${item.speaker}`}
                                    onClick={() => seekTo(item.timestamp)}
                                >
                                    <div className="item-header">
                                        <span className="speaker-label">
                                            {item.speaker === 'ai' ? '🤖 AI' : '👤 You'}
                                        </span>
                                        <span className="item-time">
                                            {formatTime(item.timestamp)}
                                        </span>
                                    </div>
                                    <p className="item-text">{item.text}</p>
                                    {item.score && (
                                        <div className="item-score">
                                            <Star size={12} />
                                            {item.score}/10
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Highlights View */}
                    {showHighlights && !showTranscript && (
                        <div className="highlights-view">
                            {highlights.length > 0 ? (
                                highlights.map((highlight, index) => (
                                    <div
                                        key={index}
                                        className="highlight-item"
                                        onClick={() => seekTo(highlight.timestamp)}
                                    >
                                        <div 
                                            className="highlight-dot"
                                            style={{ backgroundColor: getHighlightColor(highlight.type) }}
                                        />
                                        <div className="highlight-info">
                                            <span className="highlight-label">{highlight.label}</span>
                                            <span className="highlight-time">{formatTime(highlight.timestamp)}</span>
                                        </div>
                                        <span 
                                            className="highlight-type"
                                            style={{ color: getHighlightColor(highlight.type) }}
                                        >
                                            {highlight.type}
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <div className="no-highlights">
                                    <Star size={24} />
                                    <p>No highlights yet</p>
                                </div>
                            )}

                            {/* Bookmarks */}
                            {bookmarks.length > 0 && (
                                <>
                                    <h4 className="bookmarks-title">Your Bookmarks</h4>
                                    {bookmarks.map((bookmark) => (
                                        <div
                                            key={bookmark.id}
                                            className="bookmark-item"
                                            onClick={() => seekTo(bookmark.time)}
                                        >
                                            <Bookmark size={14} />
                                            <span>{bookmark.label}</span>
                                            <span className="bookmark-time">{formatTime(bookmark.time)}</span>
                                            <button
                                                className="remove-bookmark"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeBookmark(bookmark.id);
                                                }}
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InterviewReplay;
