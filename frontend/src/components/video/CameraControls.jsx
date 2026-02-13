import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Camera, RefreshCw, ZoomIn, ZoomOut, Sun, Moon, 
    Star, Image, X, Check, Sliders, RotateCcw
} from 'lucide-react';
import './CameraControls.css';

/**
 * Advanced camera controls component
 * Supports: camera switching, zoom, brightness, blur background, virtual backgrounds
 */
const CameraControls = ({
    stream,
    videoRef,
    onStreamUpdate,
    isOpen,
    onClose,
    compact = false
}) => {
    const [cameras, setCameras] = useState([]);
    const [activeCamera, setActiveCamera] = useState(null);
    const [zoom, setZoom] = useState(1);
    const [brightness, setBrightness] = useState(100);
    const [contrast, setContrast] = useState(100);
    const [backgroundBlur, setBackgroundBlur] = useState(0);
    const [virtualBackground, setVirtualBackground] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const canvasRef = useRef(null);
    const virtualBgRef = useRef(null);

    // Predefined virtual backgrounds
    const virtualBackgrounds = [
        { id: 'none', name: 'None', type: 'none', value: null },
        { id: 'blur-light', name: 'Light Blur', type: 'blur', value: 5 },
        { id: 'blur-heavy', name: 'Heavy Blur', type: 'blur', value: 15 },
        { id: 'office', name: 'Office', type: 'image', value: '/backgrounds/office.jpg' },
        { id: 'nature', name: 'Nature', type: 'image', value: '/backgrounds/nature.jpg' },
        { id: 'abstract', name: 'Abstract', type: 'image', value: '/backgrounds/abstract.jpg' },
        { id: 'gradient', name: 'Gradient', type: 'gradient', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }
    ];

    // Get available cameras
    useEffect(() => {
        const getCameras = async () => {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = devices.filter(device => device.kind === 'videoinput');
                setCameras(videoDevices);

                if (stream) {
                    const currentTrack = stream.getVideoTracks()[0];
                    if (currentTrack) {
                        const settings = currentTrack.getSettings();
                        setActiveCamera(settings.deviceId);
                    }
                }
            } catch (err) {
                console.error('Error getting cameras:', err);
                setError('Could not access cameras');
            }
        };

        getCameras();
    }, [stream]);

    // Switch camera
    const switchCamera = useCallback(async (deviceId) => {
        if (!deviceId || deviceId === activeCamera) return;

        setIsLoading(true);
        setError(null);

        try {
            // Stop current video track
            if (stream) {
                stream.getVideoTracks().forEach(track => track.stop());
            }

            // Get new stream with selected camera
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    deviceId: { exact: deviceId },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: stream ? { 
                    deviceId: stream.getAudioTracks()[0]?.getSettings().deviceId 
                } : true
            });

            // Replace video track in existing stream if possible
            if (stream && stream.getAudioTracks().length > 0) {
                const audioTrack = stream.getAudioTracks()[0];
                const finalStream = new MediaStream([
                    newStream.getVideoTracks()[0],
                    audioTrack
                ]);
                
                if (onStreamUpdate) {
                    onStreamUpdate(finalStream);
                }
            } else {
                if (onStreamUpdate) {
                    onStreamUpdate(newStream);
                }
            }

            setActiveCamera(deviceId);
        } catch (err) {
            console.error('Error switching camera:', err);
            setError('Failed to switch camera');
        } finally {
            setIsLoading(false);
        }
    }, [stream, activeCamera, onStreamUpdate]);

    // Apply zoom (using CSS transform)
    const applyZoom = useCallback((newZoom) => {
        setZoom(newZoom);
        if (videoRef?.current) {
            videoRef.current.style.transform = `scale(${newZoom})`;
        }
    }, [videoRef]);

    // Apply video filters
    const applyFilters = useCallback(() => {
        if (videoRef?.current) {
            videoRef.current.style.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
        }
    }, [videoRef, brightness, contrast]);

    useEffect(() => {
        applyFilters();
    }, [brightness, contrast, applyFilters]);

    // Apply background blur using CSS
    const applyBackgroundBlur = useCallback((blurAmount) => {
        setBackgroundBlur(blurAmount);
        // Note: True background segmentation would require ML models like TensorFlow.js + BodyPix
        // This is a simplified version using CSS backdrop-filter
        if (videoRef?.current?.parentElement) {
            videoRef.current.parentElement.style.setProperty('--bg-blur', `${blurAmount}px`);
        }
    }, [videoRef]);

    // Set virtual background
    const setBackground = useCallback((bg) => {
        setVirtualBackground(bg);
        
        if (bg.type === 'blur') {
            applyBackgroundBlur(bg.value);
        } else if (bg.type === 'none') {
            applyBackgroundBlur(0);
        }
        // Note: Image backgrounds would require WebGL/Canvas processing
        // For full implementation, consider using MediaPipe or TensorFlow.js
    }, [applyBackgroundBlur]);

    // Reset all settings
    const resetSettings = useCallback(() => {
        setZoom(1);
        setBrightness(100);
        setContrast(100);
        setBackgroundBlur(0);
        setVirtualBackground(null);
        
        if (videoRef?.current) {
            videoRef.current.style.transform = 'scale(1)';
            videoRef.current.style.filter = 'brightness(100%) contrast(100%)';
        }
    }, [videoRef]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div 
                className={`camera-controls-panel ${compact ? 'compact' : ''}`}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                transition={{ duration: 0.2 }}
            >
                <div className="controls-header">
                    <Camera size={18} />
                    <span>Camera Settings</span>
                    <button className="close-btn" onClick={onClose}>
                        <X size={16} />
                    </button>
                </div>

                {error && (
                    <div className="controls-error">
                        <span>{error}</span>
                    </div>
                )}

                <div className="controls-content">
                    {/* Camera Selection */}
                    {cameras.length > 1 && (
                        <div className="control-section">
                            <label className="control-label">
                                <RefreshCw size={14} />
                                Camera Source
                            </label>
                            <div className="camera-list">
                                {cameras.map((camera, index) => (
                                    <button
                                        key={camera.deviceId}
                                        className={`camera-option ${activeCamera === camera.deviceId ? 'active' : ''}`}
                                        onClick={() => switchCamera(camera.deviceId)}
                                        disabled={isLoading}
                                    >
                                        {activeCamera === camera.deviceId && <Check size={14} />}
                                        <span>{camera.label || `Camera ${index + 1}`}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Zoom Control */}
                    <div className="control-section">
                        <label className="control-label">
                            <ZoomIn size={14} />
                            Zoom: {zoom.toFixed(1)}x
                        </label>
                        <div className="slider-control">
                            <ZoomOut size={14} />
                            <input
                                type="range"
                                min="1"
                                max="3"
                                step="0.1"
                                value={zoom}
                                onChange={(e) => applyZoom(parseFloat(e.target.value))}
                                className="control-slider"
                            />
                            <ZoomIn size={14} />
                        </div>
                    </div>

                    {/* Brightness Control */}
                    <div className="control-section">
                        <label className="control-label">
                            <Sun size={14} />
                            Brightness: {brightness}%
                        </label>
                        <div className="slider-control">
                            <Moon size={14} />
                            <input
                                type="range"
                                min="50"
                                max="150"
                                step="5"
                                value={brightness}
                                onChange={(e) => setBrightness(parseInt(e.target.value))}
                                className="control-slider"
                            />
                            <Sun size={14} />
                        </div>
                    </div>

                    {/* Advanced Toggle */}
                    <button 
                        className="advanced-toggle"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                    >
                        <Sliders size={14} />
                        {showAdvanced ? 'Hide' : 'Show'} Advanced
                    </button>

                    {/* Advanced Controls */}
                    <AnimatePresence>
                        {showAdvanced && (
                            <motion.div
                                className="advanced-controls"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                            >
                                {/* Contrast Control */}
                                <div className="control-section">
                                    <label className="control-label">
                                        Contrast: {contrast}%
                                    </label>
                                    <input
                                        type="range"
                                        min="50"
                                        max="150"
                                        step="5"
                                        value={contrast}
                                        onChange={(e) => setContrast(parseInt(e.target.value))}
                                        className="control-slider"
                                    />
                                </div>

                                {/* Virtual Backgrounds */}
                                <div className="control-section">
                                    <label className="control-label">
                                        <Star size={14} />
                                        Background
                                    </label>
                                    <div className="background-grid">
                                        {virtualBackgrounds.map((bg) => (
                                            <button
                                                key={bg.id}
                                                className={`bg-option ${virtualBackground?.id === bg.id ? 'active' : ''}`}
                                                onClick={() => setBackground(bg)}
                                                title={bg.name}
                                                style={bg.type === 'gradient' ? { background: bg.value } : {}}
                                            >
                                                {bg.type === 'none' && <X size={16} />}
                                                {bg.type === 'blur' && <Star size={16} />}
                                                {bg.type === 'image' && <Image size={16} />}
                                                <span className="bg-label">{bg.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <p className="hint-text">
                                        Note: Full background replacement requires ML model support
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Reset Button */}
                    <button className="reset-btn" onClick={resetSettings}>
                        <RotateCcw size={14} />
                        Reset All
                    </button>
                </div>

                {/* Hidden canvas for processing */}
                <canvas ref={canvasRef} style={{ display: 'none' }} />
            </motion.div>
        </AnimatePresence>
    );
};

export default CameraControls;
