import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/solid';

const EmailVerificationBanner = () => {
  const { isAuthenticated, profile, isEmailConfirmed, resendConfirmationLink } = useAuth();
  const [isVisible, setIsVisible] = useState(true);
  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState({ message: '', type: '' });
  const location = useLocation();

  const handleResend = async () => {
    setIsResending(true);
    setResendStatus({ message: '', type: '' });
    const result = await resendConfirmationLink();
    setResendStatus({ message: result.message, type: result.success ? 'success' : 'error' });
    setIsResending(false);
    if (result.success) {
      setTimeout(() => {
        setResendStatus({ message: '', type: '' });
      }, 7000);
    }
  };

  const shouldRenderBanner = 
    isAuthenticated && 
    profile && 
    !isEmailConfirmed && 
    isVisible && 
    location.pathname !== '/profile';

  if (!shouldRenderBanner) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-[100] w-11/12 max-w-[550px] shadow-lg rounded-xl bg-gradient-to-r from-[#ff5758] to-[#953b3b] text-white" role="alert">
      <div className="p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-full">
            <InformationCircleIcon className="h-5 w-5 flex-shrink-0" />
          </div>
          <div className="text-sm">
            <div>
              <span className="font-semibold">Verifica tu email:</span> Para acceder a todas las funciones, por favor revisa tu correo 
              (<span className="font-medium">{profile.email}</span>) y haz clic en el enlace de confirmación.
            </div>
            {resendStatus.message && (
              <div className="mt-1.5">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${resendStatus.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {resendStatus.message}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <button
            onClick={handleResend}
            disabled={isResending}
            className="text-sm font-medium bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition-colors disabled:opacity-70"
          >
            {isResending ? 'Reenviando...' : 'Reenviar enlace'}
          </button>
          <button 
            onClick={() => setIsVisible(false)} 
            className="bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-colors"
            aria-label="Cerrar notificación"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationBanner; 