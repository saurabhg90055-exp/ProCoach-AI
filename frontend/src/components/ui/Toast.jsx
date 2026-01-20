import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import './Toast.css';

/**
 * Toast Notification Component
 * Animated toast notifications with multiple variants
 */
const Toast = ({ 
  message, 
  type = 'info', // 'success' | 'error' | 'warning' | 'info'
  isVisible = true,
  onClose,
  duration = 4000,
  position = 'top-right' // 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center'
}) => {
  // Auto-dismiss using useEffect
  useEffect(() => {
    if (duration && isVisible && onClose) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, isVisible, onClose]);

  const icons = {
    success: <CheckCircle size={20} />,
    error: <AlertCircle size={20} />,
    warning: <AlertTriangle size={20} />,
    info: <Info size={20} />
  };

  const variants = {
    initial: { 
      opacity: 0, 
      y: position.includes('top') ? -20 : 20,
      scale: 0.95 
    },
    animate: { 
      opacity: 1, 
      y: 0,
      scale: 1 
    },
    exit: { 
      opacity: 0, 
      y: position.includes('top') ? -20 : 20,
      scale: 0.95 
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className={`toast toast-${type} position-${position}`}
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <span className="toast-icon">{icons[type]}</span>
          <span className="toast-message">{message}</span>
          {onClose && (
            <button className="toast-close" onClick={onClose}>
              <X size={16} />
            </button>
          )}
          
          {/* Progress bar for auto-dismiss */}
          {duration && (
            <motion.div 
              className="toast-progress"
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: duration / 1000, ease: 'linear' }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * Toast Container for managing multiple toasts
 */
export const ToastContainer = ({ toasts, onRemove, position = 'top-right' }) => {
  return (
    <div className={`toast-container position-${position}`}>
      <AnimatePresence>
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            isVisible={true}
            onClose={() => onRemove(toast.id)}
            duration={toast.duration}
            position={position}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default Toast;
