import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Download, Video, FileVideo, Film, Trash2, 
    Play, Pause, Clock, HardDrive, Check, X,
    Loader
} from 'lucide-react';
import './RecordingDownload.css';

/**
 * Recording Download component
 * Allows users to download interview recordings in various formats
 */
const RecordingDownload = ({
    recordings = [], // Array of { blob, url, duration, type, timestamp }
    onDelete,
    onClearAll,
    sessionId,
    interviewTitle = 'Interview'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedRecording, setSelectedRecording] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isConverting, setIsConverting] = useState(false);
    const [downloadFormat, setDownloadFormat] = useState('original');
    const [error, setError] = useState(null);

    const previewRef = useRef(null);

    // Calculate total size
    const totalSize = recordings.reduce((sum, rec) => sum + (rec.blob?.size || 0), 0);
    const formatSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // Format duration
    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Format timestamp
    const formatTimestamp = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    };

    // Play preview
    const playPreview = useCallback((recording) => {
        setSelectedRecording(recording);
        if (previewRef.current && recording.url) {
            previewRef.current.src = recording.url;
            previewRef.current.play();
            setIsPlaying(true);
        }
    }, []);

    // Stop preview
    const stopPreview = useCallback(() => {
        if (previewRef.current) {
            previewRef.current.pause();
            previewRef.current.currentTime = 0;
        }
        setIsPlaying(false);
    }, []);

    // Download single recording
    const downloadRecording = useCallback((recording, index) => {
        if (!recording.url) return;

        const timestamp = new Date(recording.timestamp).toISOString().slice(0, 10);
        const extension = recording.type === 'video' ? 'webm' : 'webm';
        const filename = `${interviewTitle.replace(/\s+/g, '_')}_${timestamp}_part${index + 1}.${extension}`;

        const link = document.createElement('a');
        link.href = recording.url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [interviewTitle]);

    // Download all recordings as a merged file or zip
    const downloadAll = useCallback(async () => {
        if (recordings.length === 0) return;

        if (recordings.length === 1) {
            downloadRecording(recordings[0], 0);
            return;
        }

        // For multiple recordings, download them all separately
        // (True merging would require ffmpeg or similar)
        recordings.forEach((rec, idx) => {
            setTimeout(() => {
                downloadRecording(rec, idx);
            }, idx * 500); // Stagger downloads
        });
    }, [recordings, downloadRecording]);

    // Generate transcript placeholder (would need speech-to-text API)
    const downloadTranscript = useCallback(() => {
        // Placeholder - would integrate with speech-to-text service
        const transcript = `Interview Transcript
Date: ${new Date().toLocaleDateString()}
Session: ${sessionId || 'Unknown'}

[Transcript generation requires speech-to-text integration]

Total recordings: ${recordings.length}
Total duration: ${formatDuration(recordings.reduce((sum, r) => sum + (r.duration || 0), 0))}
`;

        const blob = new Blob([transcript], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${interviewTitle.replace(/\s+/g, '_')}_transcript.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [recordings, sessionId, interviewTitle]);

    // Handle video ended
    useEffect(() => {
        const video = previewRef.current;
        if (video) {
            const handleEnded = () => setIsPlaying(false);
            video.addEventListener('ended', handleEnded);
            return () => video.removeEventListener('ended', handleEnded);
        }
    }, []);

    if (recordings.length === 0) {
        return null;
    }

    return (
        <div className="recording-download">
            {/* Toggle Button */}
            <motion.button
                className="download-toggle"
                onClick={() => setIsOpen(!isOpen)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
            >
                <Video size={18} />
                <span>{recordings.length} Recording{recordings.length !== 1 ? 's' : ''}</span>
                <span className="size-badge">{formatSize(totalSize)}</span>
            </motion.button>

            {/* Download Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        className="download-panel"
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    >
                        <div className="panel-header">
                            <div className="header-title">
                                <FileVideo size={18} />
                                <span>Interview Recordings</span>
                            </div>
                            <button 
                                className="close-panel"
                                onClick={() => setIsOpen(false)}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Summary */}
                        <div className="recording-summary">
                            <div className="summary-item">
                                <Film size={14} />
                                <span>{recordings.length} clips</span>
                            </div>
                            <div className="summary-item">
                                <Clock size={14} />
                                <span>{formatDuration(recordings.reduce((sum, r) => sum + (r.duration || 0), 0))}</span>
                            </div>
                            <div className="summary-item">
                                <HardDrive size={14} />
                                <span>{formatSize(totalSize)}</span>
                            </div>
                        </div>

                        {/* Recording List */}
                        <div className="recordings-list">
                            {recordings.map((recording, index) => (
                                <div 
                                    key={index}
                                    className={`recording-item ${selectedRecording === recording ? 'selected' : ''}`}
                                >
                                    <div className="recording-info">
                                        <span className="recording-index">#{index + 1}</span>
                                        <div className="recording-details">
                                            <span className="recording-time">
                                                {formatTimestamp(recording.timestamp)}
                                            </span>
                                            <span className="recording-meta">
                                                {formatDuration(recording.duration || 0)} • {formatSize(recording.blob?.size || 0)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="recording-actions">
                                        <button
                                            className="action-btn play"
                                            onClick={() => isPlaying && selectedRecording === recording 
                                                ? stopPreview() 
                                                : playPreview(recording)
                                            }
                                            title={isPlaying && selectedRecording === recording ? 'Stop' : 'Play'}
                                        >
                                            {isPlaying && selectedRecording === recording 
                                                ? <Pause size={14} /> 
                                                : <Play size={14} />
                                            }
                                        </button>
                                        <button
                                            className="action-btn download"
                                            onClick={() => downloadRecording(recording, index)}
                                            title="Download"
                                        >
                                            <Download size={14} />
                                        </button>
                                        {onDelete && (
                                            <button
                                                className="action-btn delete"
                                                onClick={() => onDelete(index)}
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Preview Player */}
                        <div className="preview-container" style={{ display: selectedRecording ? 'block' : 'none' }}>
                            <video
                                ref={previewRef}
                                className="preview-player"
                                controls
                                playsInline
                            />
                        </div>

                        {/* Download All Actions */}
                        <div className="download-actions">
                            <button
                                className="download-all-btn"
                                onClick={downloadAll}
                                disabled={isConverting}
                            >
                                {isConverting ? (
                                    <>
                                        <Loader size={16} className="spinning" />
                                        <span>Processing...</span>
                                    </>
                                ) : (
                                    <>
                                        <Download size={16} />
                                        <span>Download All</span>
                                    </>
                                )}
                            </button>

                            <button
                                className="transcript-btn"
                                onClick={downloadTranscript}
                            >
                                <FileVideo size={16} />
                                <span>Get Transcript</span>
                            </button>

                            {onClearAll && (
                                <button
                                    className="clear-btn"
                                    onClick={onClearAll}
                                >
                                    <Trash2 size={16} />
                                    <span>Clear All</span>
                                </button>
                            )}
                        </div>

                        {error && (
                            <div className="download-error">
                                {error}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default RecordingDownload;
