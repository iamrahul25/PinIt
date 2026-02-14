import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  Info, 
  X, 
  Loader2 
} from 'lucide-react';

/**
 * A Dynamic Notification/Pop-up Component
 * @param {string} type - 'success' | 'error' | 'warning' | 'info'
 * @param {string} message - The text content
 * @param {function} onClose - Function to remove the notification
 * @param {number} duration - Auto-close time in ms (default 5000)
 */
const Notification = ({ type = 'info', message, onClose, duration = 5000 }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300); // Wait for exit animation
  };

  const themes = {
    success: {
      icon: <CheckCircle2 className="w-6 h-6 text-emerald-500" />,
      bg: "bg-emerald-50/90 border-emerald-200",
      text: "text-emerald-900",
      progress: "bg-emerald-500",
      label: "Success"
    },
    error: {
      icon: <XCircle className="w-6 h-6 text-rose-500" />,
      bg: "bg-rose-50/90 border-rose-200",
      text: "text-rose-900",
      progress: "bg-rose-500",
      label: "Error"
    },
    warning: {
      icon: <AlertCircle className="w-6 h-6 text-amber-500" />,
      bg: "bg-amber-50/90 border-amber-200",
      text: "text-amber-900",
      progress: "bg-amber-500",
      label: "Warning"
    },
    info: {
      icon: <Info className="w-6 h-6 text-blue-500" />,
      bg: "bg-blue-50/90 border-blue-200",
      text: "text-blue-900",
      progress: "bg-blue-500",
      label: "Information"
    }
  };

  const config = themes[type] || themes.info;

  return (
    <div 
      className={`
        relative overflow-hidden min-w-[320px] max-w-md 
        ${config.bg} border rounded-xl shadow-lg backdrop-blur-md
        transition-all duration-300 ease-in-out transform
        ${isExiting ? 'translate-x-full opacity-0 scale-95' : 'translate-x-0 opacity-100 scale-100'}
        flex items-start p-4 mb-4 select-none
      `}
    >
      {/* Icon Section */}
      <div className="flex-shrink-0 mt-0.5">
        {config.icon}
      </div>

      {/* Content Section */}
      <div className="ml-4 flex-1">
        <h4 className={`text-sm font-bold uppercase tracking-wider mb-0.5 ${config.text}`}>
          {config.label}
        </h4>
        <p className={`text-sm opacity-80 ${config.text}`}>
          {message}
        </p>
      </div>

      {/* Close Button */}
      <button 
        onClick={handleClose}
        className="ml-4 flex-shrink-0 opacity-40 hover:opacity-100 transition-opacity"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Animated Progress Bar */}
      <div className="absolute bottom-0 left-0 h-1 w-full bg-black/5">
        <div 
          className={`h-full ${config.progress} transition-all duration-[5000ms] ease-linear`}
          style={{ width: isExiting ? '0%' : '100%' }}
        />
      </div>
    </div>
  );
};

export default Notification;