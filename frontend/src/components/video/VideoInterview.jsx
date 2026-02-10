import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Camera, CameraOff, Mic, MicOff, Video, VideoOff, 
    Phone, Settings, Maximize2, Minimize2, Eye, 
    AlertCircle, CheckCircle, TrendingUp, Brain,
    MessageSquare, Clock, Zap, Monitor, Subtitles, Download,
    BarChart3
} from 'lucide-react';
import { AIAvatar, Avatar3D } from '../avatar';
import { AudioVisualizer } from '../audio';
import { TypingIndicator } from '../ui';
import ExpressionIndicator from './ExpressionIndicator';
import VideoCoachingTips from './VideoCoachingTips';
import CameraControls from './CameraControls';
import NetworkQuality from './NetworkQuality';
import ScreenShare from './ScreenShare';
import RecordingDownload from './RecordingDownload';
import LiveCaptions from './LiveCaptions';
import LanguageSelector from './LanguageSelector';
import ExpressionPanel from './ExpressionPanel';
import useFaceDetection from '../../hooks/useFaceDetection';
import useVideoRecording from '../../hooks/useVideoRecording';
import './VideoInterview.css';

const VideoInterview = ({
    sessionId,
    onEndInterview,
    onSendAudio,
    conversationHistory,
    isProcessing,
    isSpeaking,
    currentScore,
    averageScore,
    questionCount,
    elapsedTime,
    remainingTime,
    isTimeWarning,
    avatarState,
    avatarInfo,
    settings,
    enableTTS
}) => {
    // Debug: Log avatarInfo received
    console.log('[VideoInterview] avatarInfo:', avatarInfo);
    
    // Video states
    const [isCameraOn, setIsCameraOn] = useState(true);
    const [isMicOn, setIsMicOn] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [cameraError, setCameraError] = useState(null);
    const [stream, setStream] = useState(null);
    
    // Recording states
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioLevel, setAudioLevel] = useState(0);
    const [savedRecordings, setSavedRecordings] = useState([]);
    
    // Expression analysis states
    const [expressionData, setExpressionData] = useState({
        confidence: 0,
        eyeContact: 0,
        emotion: 'neutral',
        engagement: 0
    });
    const [expressionHistory, setExpressionHistory] = useState([]);
    
    // UI states
    const [showSettings, setShowSettings] = useState(false);
    const [showTranscript, setShowTranscript] = useState(true);
    const [showCameraControls, setShowCameraControls] = useState(false);
    const [showCaptions, setShowCaptions] = useState(false);
    const [interviewLanguage, setInterviewLanguage] = useState('en-US');
    const [networkQuality, setNetworkQuality] = useState(null);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [screenStream, setScreenStream] = useState(null);
    const [showExpressionPanel, setShowExpressionPanel] = useState(true);
    
    // Refs
    const videoRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const recordingTimerRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const containerRef = useRef(null);
    
    // Custom hooks for enhanced features
    const { 
        expressionData: faceExpressionData, 
        faceDetected, 
        isModelLoaded,
        isLoading: isModelLoading 
    } = useFaceDetection(videoRef, isCameraOn, {
        onExpressionUpdate: (data) => {
            setExpressionData(data);
            setExpressionHistory(prev => [...prev.slice(-100), { ...data, timestamp: Date.now() }]);
        }
    });
    
    const {
        isRecording: isVideoRecording,
        recordingDuration,
        recordingBlob,
        recordingUrl,
        startRecording: startVideoRecording,
        stopRecording: stopVideoRecording,
        downloadRecording
    } = useVideoRecording({
        onRecordingComplete: (data) => {
            setSavedRecordings(prev => [...prev, {
                ...data,
                timestamp: Date.now()
            }]);
        }
    });
    
    // Initialize camera and microphone
    useEffect(() => {
        initializeMedia();
        return () => {
            stopMediaStream();
        };
    }, []);
    
    const initializeMedia = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
            
            // Setup audio analyzer for visualization
            setupAudioAnalyzer(mediaStream);
            setCameraError(null);
        } catch (error) {
            console.error('Error accessing media devices:', error);
            setCameraError(error.message);
        }
    };
    
    const setupAudioAnalyzer = (mediaStream) => {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        const source = audioContextRef.current.createMediaStreamSource(mediaStream);
        source.connect(analyserRef.current);
        analyserRef.current.fftSize = 256;
        
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        
        const updateLevel = () => {
            if (analyserRef.current && isMicOn) {
                analyserRef.current.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                setAudioLevel(average / 255);
            }
            requestAnimationFrame(updateLevel);
        };
        updateLevel();
    };
    
    const stopMediaStream = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        if (screenStream) {
            screenStream.getTracks().forEach(track => track.stop());
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
        }
    };
    
    const toggleCamera = () => {
        if (stream) {
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsCameraOn(videoTrack.enabled);
            }
        }
    };
    
    const toggleMic = () => {
        if (stream) {
            const audioTrack = stream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMicOn(audioTrack.enabled);
            }
        }
    };
    
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };
    
    // Handle stream update from camera controls
    const handleStreamUpdate = (newStream) => {
        setStream(newStream);
        if (videoRef.current) {
            videoRef.current.srcObject = newStream;
        }
        setupAudioAnalyzer(newStream);
    };
    
    // Recording functions
    const startRecording = async () => {
        console.log('startRecording called', { stream: !!stream, isMicOn });
        
        if (!stream) {
            console.error('No media stream available. Trying to initialize...');
            await initializeMedia();
            return;
        }
        
        // Auto-enable mic if muted
        if (!isMicOn && stream) {
            const audioTrack = stream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = true;
                setIsMicOn(true);
            }
        }
        
        try {
            chunksRef.current = [];
            
            // Get only audio track for the audio recorder
            const audioTrack = stream.getAudioTracks()[0];
            if (!audioTrack) {
                console.error('No audio track available');
                return;
            }
            
            // Create audio-only stream for recording
            const audioStream = new MediaStream([audioTrack]);
            
            // Check supported mime types
            const mimeTypes = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/ogg;codecs=opus',
                'audio/mp4'
            ];
            
            let selectedMimeType = '';
            for (const mimeType of mimeTypes) {
                if (MediaRecorder.isTypeSupported(mimeType)) {
                    selectedMimeType = mimeType;
                    break;
                }
            }
            
            if (!selectedMimeType) {
                console.error('No supported audio mime type found');
                return;
            }
            
            mediaRecorderRef.current = new MediaRecorder(audioStream, {
                mimeType: selectedMimeType
            });
            
            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };
            
            mediaRecorderRef.current.onstop = async () => {
                const audioBlob = new Blob(chunksRef.current, { type: selectedMimeType });
                
                // Capture current expression data with the recording
                const capturedExpression = { ...expressionData };
                
                // Send audio with expression data
                if (onSendAudio) {
                    onSendAudio(audioBlob, capturedExpression);
                }
            };
            
            mediaRecorderRef.current.start();
            setIsRecording(true);
            setRecordingTime(0);
            
            // Also start video recording for replay (optional, don't fail if it errors)
            if (stream && startVideoRecording) {
                try {
                    startVideoRecording(stream, true);
                } catch (videoRecErr) {
                    console.warn('Video recording not available:', videoRecErr);
                }
            }
            
            recordingTimerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (error) {
            console.error('Error starting recording:', error);
        }
    };
    
    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearInterval(recordingTimerRef.current);
            
            // Stop video recording too (if available)
            if (stopVideoRecording) {
                try {
                    stopVideoRecording();
                } catch (e) {
                    console.warn('Error stopping video recording:', e);
                }
            }
        }
    };
    
    // Screen sharing handlers
    const handleScreenShareStart = (screenStream, type) => {
        setScreenStream(screenStream);
        setIsScreenSharing(true);
    };
    
    const handleScreenShareEnd = () => {
        setScreenStream(null);
        setIsScreenSharing(false);
    };
    
    // Network quality handler
    const handleNetworkQualityChange = (quality) => {
        setNetworkQuality(quality);
    };
    
    // Caption transcript handler
    const handleCaptionTranscript = (transcript) => {
        // Could be used to save transcripts or send to analytics
        console.log('Caption:', transcript);
    };
    
    // Delete recording
    const handleDeleteRecording = (index) => {
        setSavedRecordings(prev => prev.filter((_, i) => i !== index));
    };
    
    // Clear all recordings
    const handleClearAllRecordings = () => {
        savedRecordings.forEach(rec => {
            if (rec.url) {
                URL.revokeObjectURL(rec.url);
            }
        });
        setSavedRecordings([]);
    };
    
    // Expression data handler (called from ExpressionIndicator)
    const handleExpressionUpdate = useCallback((data) => {
        setExpressionData(data);
        setExpressionHistory(prev => [...prev.slice(-100), { ...data, timestamp: Date.now() }]);
    }, []);
    
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };
    
    return (
        <div 
            ref={containerRef}
            className={`video-interview-container ${isFullscreen ? 'fullscreen' : ''}`}
        >
            {/* Header Bar */}
            <div className="video-header">
                <div className="header-left">
                    <div className="session-info">
                        <Brain size={18} className="header-icon" />
                        <span>Video Interview</span>
                        <span className="question-badge">Q{questionCount}</span>
                    </div>
                    
                    {/* Language Selector */}
                    <LanguageSelector
                        value={interviewLanguage}
                        onChange={setInterviewLanguage}
                        compact
                    />
                </div>
                
                <div className="header-center">
                    <div className={`timer ${isTimeWarning ? 'warning' : ''}`}>
                        <Clock size={16} />
                        <span>{formatTime(remainingTime)}</span>
                    </div>
                    
                    {/* Network Quality Indicator */}
                    <NetworkQuality
                        stream={stream}
                        onQualityChange={handleNetworkQualityChange}
                        compact
                        position="inline"
                    />
                </div>
                
                <div className="header-right">
                    {averageScore && (
                        <div className="score-indicator">
                            <TrendingUp size={16} />
                            <span>{averageScore.toFixed(1)}/10</span>
                        </div>
                    )}
                    <button 
                        className="icon-btn"
                        onClick={toggleFullscreen}
                        title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                    >
                        {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>
                    <div className="expression-panel-toggle-wrapper">
                        <button
                            className={`icon-btn ${showExpressionPanel ? 'active' : ''}`}
                            onClick={() => setShowExpressionPanel(!showExpressionPanel)}
                            title={showExpressionPanel ? 'Hide Expression Panel' : 'Show Expression Panel'}
                        >
                            <BarChart3 size={18} />
                        </button>
                        {/* Expression Panel - Dropdown from header */}
                        <AnimatePresence>
                            {showExpressionPanel && (
                                <motion.div
                                    className="expression-panel-dropdown"
                                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <ExpressionPanel
                                        expressionData={expressionData}
                                        faceDetected={faceDetected}
                                        isRecording={isRecording}
                                        compact={false}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
            
            {/* Main Video Area */}
            <div className="video-main">
                {/* AI Interviewer Side */}
                <div className="interviewer-panel">
                    <div className="avatar-container avatar-container-video">
                        <Avatar3D 
                            state={isSpeaking ? 'speaking' : avatarState}
                            audioLevel={isSpeaking ? 0.6 : 0}
                            score={currentScore}
                            size="video"
                            userExpression={expressionData}
                            isSpeaking={isSpeaking}
                            gender={avatarInfo?.gender || 'male'}
                            interviewerName={avatarInfo?.name || 'ALEX'}
                        />
                    </div>
                    
                    <div className="interviewer-info">
                        <h3>{avatarInfo?.name || 'AI Interviewer'}</h3>
                        <span className={`status ${isSpeaking ? 'speaking' : 'idle'}`}>
                            {isSpeaking ? '🎙️ Speaking' : isProcessing ? '🤔 Thinking' : '👂 Listening'}
                        </span>
                    </div>
                    
                    {/* Current Question Display - hidden when transcript is open */}
                    <AnimatePresence>
                        {conversationHistory.length > 0 && !showTranscript && (
                            <motion.div 
                                className="current-question"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                            >
                                <MessageSquare size={16} />
                                <p>{conversationHistory[conversationHistory.length - 1]?.role === 'assistant' 
                                    ? conversationHistory[conversationHistory.length - 1]?.content 
                                    : conversationHistory[conversationHistory.length - 2]?.content}
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    
                    {isProcessing && (
                        <div className="processing-indicator">
                            <TypingIndicator variant="dots" color="primary" text="Analyzing..." />
                        </div>
                    )}
                    
                    {/* Real-time coaching tips */}
                    <div className="coaching-tips-container">
                        <VideoCoachingTips
                            expressionData={expressionData}
                            isRecording={isRecording}
                            isActive={!isProcessing && !isSpeaking}
                            compact={true}
                        />
                    </div>
                </div>
                
                {/* User Video Side */}
                <div className="user-panel">
                    <div className="video-wrapper">
                        {cameraError ? (
                            <div className="camera-error">
                                <CameraOff size={48} />
                                <p>Camera access denied</p>
                                <button onClick={initializeMedia} className="retry-btn">
                                    Try Again
                                </button>
                            </div>
                        ) : (
                            <>
                                <video 
                                    ref={videoRef}
                                    autoPlay 
                                    playsInline 
                                    muted
                                    className={`user-video ${!isCameraOn ? 'hidden' : ''}`}
                                />
                                {!isCameraOn && (
                                    <div className="camera-off-placeholder">
                                        <CameraOff size={48} />
                                        <span>Camera Off</span>
                                    </div>
                                )}
                            </>
                        )}
                        
                        {/* Recording Indicator */}
                        <AnimatePresence>
                            {isRecording && (
                                <motion.div 
                                    className="recording-badge"
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                >
                                    <span className="rec-dot" />
                                    <span>REC {formatTime(recordingTime)}</span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                        
                        {/* Face Detection Status */}
                        {isModelLoading && (
                            <div className="model-loading-indicator">
                                Loading face detection...
                            </div>
                        )}
                        
                        {/* Expression Overlay */}
                        {isCameraOn && (
                            <ExpressionIndicator 
                                videoRef={videoRef}
                                isActive={isCameraOn}
                                onExpressionUpdate={handleExpressionUpdate}
                                useRealDetection={isModelLoaded}
                                faceDetected={faceDetected}
                            />
                        )}
                        
                        {/* Screen Share Preview (Picture-in-Picture style) */}
                        {isScreenSharing && screenStream && (
                            <div className="screen-share-pip">
                                <video
                                    autoPlay
                                    playsInline
                                    muted
                                    ref={(el) => {
                                        if (el) el.srcObject = screenStream;
                                    }}
                                />
                            </div>
                        )}
                    </div>
                    
                    {/* Expression Stats - Always show compact bar in user panel */}
                    <div className="expression-stats">
                        <div className="stat-item">
                            <Eye size={14} />
                            <span className="stat-label">Eye Contact</span>
                            <div className="stat-bar">
                                <div 
                                    className="stat-fill eye-contact"
                                    style={{ width: `${expressionData.eyeContact}%` }}
                                />
                            </div>
                            <span className="stat-value">{expressionData.eyeContact}%</span>
                        </div>
                        <div className="stat-item">
                            <Zap size={14} />
                            <span className="stat-label">Confidence</span>
                            <div className="stat-bar">
                                <div 
                                    className="stat-fill confidence"
                                    style={{ width: `${expressionData.confidence}%` }}
                                />
                            </div>
                            <span className="stat-value">{expressionData.confidence}%</span>
                        </div>
                        <div className="stat-item emotion">
                            <span className="emotion-emoji">
                                {expressionData.emotion === 'happy' && '😊'}
                                {expressionData.emotion === 'neutral' && '😐'}
                                {expressionData.emotion === 'surprised' && '😮'}
                                {expressionData.emotion === 'thinking' && '🤔'}
                                {expressionData.emotion === 'nervous' && '😰'}
                            </span>
                            <span className="emotion-label">{expressionData.emotion}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Transcript Panel (Collapsible) */}
            <AnimatePresence>
                {showTranscript && (
                    <motion.div 
                        className="transcript-panel"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                    >
                        <div className="transcript-header">
                            <MessageSquare size={16} />
                            <span>Conversation</span>
                            <button 
                                className="collapse-btn"
                                onClick={() => setShowTranscript(false)}
                            >
                                ▼
                            </button>
                        </div>
                        <div className="transcript-content">
                            {conversationHistory.map((msg, idx) => (
                                <div key={idx} className={`transcript-msg ${msg.role}`}>
                                    <span className="msg-role">
                                        {msg.role === 'assistant' ? '🤖' : '👤'}
                                    </span>
                                    <p>{msg.content}</p>
                                    {msg.score && (
                                        <span className="msg-score">{msg.score}/10</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            
            {!showTranscript && (
                <button 
                    className="show-transcript-btn"
                    onClick={() => setShowTranscript(true)}
                >
                    <MessageSquare size={14} />
                    Show Transcript
                </button>
            )}
            
            {/* Live Captions */}
            <LiveCaptions
                isActive={showCaptions}
                language={interviewLanguage}
                onTranscript={handleCaptionTranscript}
                position="bottom"
                showControls={false}
            />
            
            {/* Camera Controls Panel */}
            <CameraControls
                stream={stream}
                videoRef={videoRef}
                onStreamUpdate={handleStreamUpdate}
                isOpen={showCameraControls}
                onClose={() => setShowCameraControls(false)}
            />
            
            {/* Control Bar */}
            <div className="video-controls">
                <div className="controls-left">
                    <button 
                        className={`control-btn ${!isMicOn ? 'off' : ''}`}
                        onClick={toggleMic}
                        title={isMicOn ? 'Mute' : 'Unmute'}
                    >
                        {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
                    </button>
                    <button 
                        className={`control-btn ${!isCameraOn ? 'off' : ''}`}
                        onClick={toggleCamera}
                        title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
                    >
                        {isCameraOn ? <Video size={20} /> : <VideoOff size={20} />}
                    </button>
                    <button 
                        className={`control-btn ${showCameraControls ? 'active' : ''}`}
                        onClick={() => setShowCameraControls(!showCameraControls)}
                        title="Camera settings"
                    >
                        <Settings size={20} />
                    </button>
                </div>
                
                <div className="controls-center">
                    {/* Screen Share */}
                    <ScreenShare
                        onScreenShareStart={handleScreenShareStart}
                        onScreenShareEnd={handleScreenShareEnd}
                        isInterviewActive={true}
                        showPreview={false}
                    />
                    
                    {/* Main Record Button */}
                    <motion.button
                        className={`record-btn ${isRecording ? 'recording' : ''}`}
                        onClick={isRecording ? stopRecording : startRecording}
                        disabled={isProcessing || isSpeaking}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        {isRecording ? (
                            <>
                                <span className="pulse-ring" />
                                <span className="btn-icon">⬛</span>
                                <span>Stop Recording</span>
                            </>
                        ) : (
                            <>
                                <Mic size={24} />
                                <span>Push to Talk</span>
                            </>
                        )}
                    </motion.button>
                    
                    {/* Captions Toggle */}
                    <button
                        className={`control-btn ${showCaptions ? 'active' : ''}`}
                        onClick={() => setShowCaptions(!showCaptions)}
                        title={showCaptions ? 'Hide Captions' : 'Show Captions'}
                    >
                        <Subtitles size={20} />
                    </button>
                    
                    {/* Audio Level Indicator */}
                    {isRecording && (
                        <div className="audio-level-bar">
                            <div 
                                className="level-fill"
                                style={{ width: `${audioLevel * 100}%` }}
                            />
                        </div>
                    )}
                </div>
                
                <div className="controls-right">
                    {/* Recording Download */}
                    {savedRecordings.length > 0 && (
                        <RecordingDownload
                            recordings={savedRecordings}
                            onDelete={handleDeleteRecording}
                            onClearAll={handleClearAllRecordings}
                            sessionId={sessionId}
                            interviewTitle="Video Interview"
                        />
                    )}
                    
                    <button 
                        className="control-btn end-call"
                        onClick={onEndInterview}
                        title="End Interview"
                    >
                        <Phone size={20} />
                        <span>End</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VideoInterview;
