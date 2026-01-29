import { useState, useRef, useCallback } from 'react';

/**
 * Custom hook for video recording with MediaRecorder API
 * Supports recording both video+audio and audio-only modes
 */
const useVideoRecording = (options = {}) => {
    const {
        onRecordingComplete = null,
        onRecordingError = null,
        videoMimeType = 'video/webm;codecs=vp9,opus',
        audioMimeType = 'audio/webm;codecs=opus',
        videoBitsPerSecond = 2500000, // 2.5 Mbps
        audioBitsPerSecond = 128000, // 128 kbps
    } = options;

    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [recordingBlob, setRecordingBlob] = useState(null);
    const [recordingUrl, setRecordingUrl] = useState(null);
    const [recordingType, setRecordingType] = useState(null); // 'video' or 'audio'
    const [recordingError, setRecordingError] = useState(null);

    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const durationTimerRef = useRef(null);
    const startTimeRef = useRef(null);
    const streamRef = useRef(null);

    // Get supported MIME type
    const getSupportedMimeType = useCallback((isVideo = true) => {
        const videoTypes = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm',
            'video/mp4'
        ];
        const audioTypes = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg',
            'audio/mp4'
        ];

        const types = isVideo ? videoTypes : audioTypes;
        
        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }
        return isVideo ? 'video/webm' : 'audio/webm';
    }, []);

    // Start recording
    const startRecording = useCallback(async (stream, recordVideo = true) => {
        if (!stream) {
            const error = new Error('No media stream provided');
            setRecordingError(error.message);
            if (onRecordingError) onRecordingError(error);
            return false;
        }

        try {
            // Clear previous recording
            chunksRef.current = [];
            setRecordingBlob(null);
            if (recordingUrl) {
                URL.revokeObjectURL(recordingUrl);
                setRecordingUrl(null);
            }
            setRecordingError(null);

            // Store stream reference
            streamRef.current = stream;

            // Determine what to record
            const mimeType = getSupportedMimeType(recordVideo);
            setRecordingType(recordVideo ? 'video' : 'audio');

            // Create MediaRecorder with appropriate stream
            let recordingStream = stream;
            if (!recordVideo) {
                // Create audio-only stream
                const audioTracks = stream.getAudioTracks();
                recordingStream = new MediaStream(audioTracks);
            }

            const recorderOptions = {
                mimeType,
                ...(recordVideo 
                    ? { videoBitsPerSecond } 
                    : { audioBitsPerSecond }
                )
            };

            mediaRecorderRef.current = new MediaRecorder(recordingStream, recorderOptions);

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: mimeType });
                const url = URL.createObjectURL(blob);
                
                setRecordingBlob(blob);
                setRecordingUrl(url);
                setIsRecording(false);
                setIsPaused(false);

                if (onRecordingComplete) {
                    onRecordingComplete({
                        blob,
                        url,
                        duration: recordingDuration,
                        type: recordVideo ? 'video' : 'audio',
                        mimeType
                    });
                }
            };

            mediaRecorderRef.current.onerror = (event) => {
                const error = event.error || new Error('Recording error');
                setRecordingError(error.message);
                setIsRecording(false);
                if (onRecordingError) onRecordingError(error);
            };

            // Start recording with timeslice for chunked data
            mediaRecorderRef.current.start(1000); // Get data every second
            startTimeRef.current = Date.now();
            setIsRecording(true);
            setRecordingDuration(0);

            // Start duration timer
            durationTimerRef.current = setInterval(() => {
                if (!isPaused) {
                    setRecordingDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
                }
            }, 1000);

            return true;
        } catch (error) {
            console.error('Error starting recording:', error);
            setRecordingError(error.message);
            if (onRecordingError) onRecordingError(error);
            return false;
        }
    }, [recordingUrl, getSupportedMimeType, videoBitsPerSecond, audioBitsPerSecond, recordingDuration, isPaused, onRecordingComplete, onRecordingError]);

    // Stop recording
    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            
            if (durationTimerRef.current) {
                clearInterval(durationTimerRef.current);
                durationTimerRef.current = null;
            }
        }
    }, [isRecording]);

    // Pause recording
    const pauseRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording && !isPaused) {
            mediaRecorderRef.current.pause();
            setIsPaused(true);
        }
    }, [isRecording, isPaused]);

    // Resume recording
    const resumeRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording && isPaused) {
            mediaRecorderRef.current.resume();
            setIsPaused(false);
        }
    }, [isRecording, isPaused]);

    // Download recording
    const downloadRecording = useCallback((filename = 'recording') => {
        if (!recordingUrl || !recordingBlob) return;

        const extension = recordingType === 'video' ? 'webm' : 'webm';
        const link = document.createElement('a');
        link.href = recordingUrl;
        link.download = `${filename}.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [recordingUrl, recordingBlob, recordingType]);

    // Clear recording
    const clearRecording = useCallback(() => {
        if (recordingUrl) {
            URL.revokeObjectURL(recordingUrl);
        }
        chunksRef.current = [];
        setRecordingBlob(null);
        setRecordingUrl(null);
        setRecordingDuration(0);
        setRecordingError(null);
    }, [recordingUrl]);

    // Get recording data as base64
    const getBase64 = useCallback(async () => {
        if (!recordingBlob) return null;

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(recordingBlob);
        });
    }, [recordingBlob]);

    return {
        // State
        isRecording,
        isPaused,
        recordingDuration,
        recordingBlob,
        recordingUrl,
        recordingType,
        recordingError,
        
        // Actions
        startRecording,
        stopRecording,
        pauseRecording,
        resumeRecording,
        downloadRecording,
        clearRecording,
        getBase64,
        
        // Utilities
        getSupportedMimeType
    };
};

export default useVideoRecording;
