import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Monitor, MonitorOff, Maximize2, Minimize2, 
    Layout, AppWindow, X, Check
} from 'lucide-react';
import './ScreenShare.css';

/**
 * Screen Sharing component for technical interviews
 * Allows sharing entire screen, window, or browser tab
 */
const ScreenShare = ({
    onScreenShareStart,
    onScreenShareEnd,
    onScreenShareError,
    isInterviewActive = true,
    showPreview = true
}) => {
    const [isSharing, setIsSharing] = useState(false);
    const [screenStream, setScreenStream] = useState(null);
    const [shareType, setShareType] = useState(null); // 'screen', 'window', 'tab'
    const [isPipActive, setIsPipActive] = useState(false);
    const [showOptions, setShowOptions] = useState(false);
    const [error, setError] = useState(null);

    const previewVideoRef = useRef(null);
    const pipWindowRef = useRef(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (screenStream) {
                screenStream.getTracks().forEach(track => track.stop());
            }
        };
    }, [screenStream]);

    // Handle stream ended externally (user clicked browser stop)
    useEffect(() => {
        if (screenStream) {
            const videoTrack = screenStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.onended = () => {
                    stopSharing();
                };
            }
        }
    }, [screenStream]);

    // Start screen sharing
    const startSharing = useCallback(async (type = 'screen') => {
        try {
            setError(null);
            
            const displayMediaOptions = {
                video: {
                    displaySurface: type === 'window' ? 'window' : 
                                   type === 'tab' ? 'browser' : 'monitor',
                    logicalSurface: true,
                    cursor: 'always'
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            };

            // Some browsers support preferCurrentTab
            if (type === 'tab') {
                displayMediaOptions.preferCurrentTab = false;
            }

            const stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
            
            // Connect to preview video element
            if (previewVideoRef.current) {
                previewVideoRef.current.srcObject = stream;
            }

            setScreenStream(stream);
            setShareType(type);
            setIsSharing(true);
            setShowOptions(false);

            if (onScreenShareStart) {
                onScreenShareStart(stream, type);
            }

        } catch (err) {
            console.error('Error starting screen share:', err);
            const errorMessage = err.name === 'NotAllowedError' 
                ? 'Screen sharing permission denied'
                : 'Failed to start screen sharing';
            setError(errorMessage);
            
            if (onScreenShareError) {
                onScreenShareError(err);
            }
        }
    }, [onScreenShareStart, onScreenShareError]);

    // Stop screen sharing
    const stopSharing = useCallback(() => {
        if (screenStream) {
            screenStream.getTracks().forEach(track => track.stop());
        }
        
        if (previewVideoRef.current) {
            previewVideoRef.current.srcObject = null;
        }

        // Exit PiP if active
        if (document.pictureInPictureElement) {
            document.exitPictureInPicture();
        }

        setScreenStream(null);
        setShareType(null);
        setIsSharing(false);
        setIsPipActive(false);

        if (onScreenShareEnd) {
            onScreenShareEnd();
        }
    }, [screenStream, onScreenShareEnd]);

    // Toggle Picture-in-Picture
    const togglePip = useCallback(async () => {
        if (!previewVideoRef.current) return;

        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
                setIsPipActive(false);
            } else {
                await previewVideoRef.current.requestPictureInPicture();
                setIsPipActive(true);
            }
        } catch (err) {
            console.error('PiP error:', err);
        }
    }, []);

    // Get share type label
    const getShareTypeLabel = () => {
        switch (shareType) {
            case 'window': return 'Window';
            case 'tab': return 'Browser Tab';
            case 'screen': 
            default: return 'Entire Screen';
        }
    };

    // Share options
    const shareOptions = [
        { id: 'screen', label: 'Entire Screen', icon: Monitor, description: 'Share your entire screen' },
        { id: 'window', label: 'Window', icon: AppWindow, description: 'Share a specific window' },
        { id: 'tab', label: 'Browser Tab', icon: Layout, description: 'Share a browser tab' }
    ];

    if (!isInterviewActive) return null;

    return (
        <div className="screen-share-container">
            {/* Share Control Button */}
            {!isSharing ? (
                <div className="share-control">
                    <motion.button
                        className="share-btn"
                        onClick={() => setShowOptions(!showOptions)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <Monitor size={18} />
                        <span>Share Screen</span>
                    </motion.button>

                    {/* Share Options Dropdown */}
                    <AnimatePresence>
                        {showOptions && (
                            <motion.div
                                className="share-options"
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            >
                                <div className="options-header">
                                    <span>Choose what to share</span>
                                    <button 
                                        className="close-options"
                                        onClick={() => setShowOptions(false)}
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                                
                                <div className="options-list">
                                    {shareOptions.map((option) => (
                                        <button
                                            key={option.id}
                                            className="share-option"
                                            onClick={() => startSharing(option.id)}
                                        >
                                            <option.icon size={20} />
                                            <div className="option-text">
                                                <span className="option-label">{option.label}</span>
                                                <span className="option-desc">{option.description}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                {error && (
                                    <div className="share-error">
                                        {error}
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            ) : (
                /* Active Share Controls */
                <div className="active-share">
                    <div className="share-status">
                        <span className="share-indicator" />
                        <span>Sharing: {getShareTypeLabel()}</span>
                    </div>

                    <div className="share-actions">
                        {/* PiP Toggle */}
                        {document.pictureInPictureEnabled && (
                            <button
                                className={`action-btn ${isPipActive ? 'active' : ''}`}
                                onClick={togglePip}
                                title={isPipActive ? 'Exit Picture-in-Picture' : 'Picture-in-Picture'}
                            >
                                {isPipActive ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                            </button>
                        )}

                        {/* Stop Sharing */}
                        <button
                            className="stop-share-btn"
                            onClick={stopSharing}
                        >
                            <MonitorOff size={16} />
                            <span>Stop Sharing</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Preview Window */}
            <AnimatePresence>
                {isSharing && showPreview && !isPipActive && (
                    <motion.div
                        className="share-preview"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                    >
                        <div className="preview-header">
                            <span>Screen Preview</span>
                            <div className="preview-actions">
                                <button 
                                    className="preview-btn"
                                    onClick={togglePip}
                                    title="Pop out"
                                >
                                    <Maximize2 size={14} />
                                </button>
                                <button 
                                    className="preview-btn close"
                                    onClick={stopSharing}
                                    title="Stop sharing"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                        <video
                            ref={previewVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className="preview-video"
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Hidden video for PiP */}
            {!showPreview && (
                <video
                    ref={previewVideoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ display: 'none' }}
                />
            )}
        </div>
    );
};

export default ScreenShare;
