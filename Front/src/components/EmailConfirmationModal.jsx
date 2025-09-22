import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { CheckCircleIcon, XCircleIcon, KeyIcon } from '@heroicons/react/24/outline';
import api from '@/utils/axiosInstance';
import { useAuth } from '@/context/AuthContext';

const EmailConfirmationModal = ({ isOpen, onClose, email }) => {
  const [verificationCode, setVerificationCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [status, setStatus] = useState(null); // 'success', 'error', 'loading'
  const [statusMessage, setStatusMessage] = useState('');
  const { login } = useAuth();
  const initialCodeSentForEmailRef = useRef(null); // Ref to track if initial code was sent for the current email
  
  useEffect(() => {
    console.log('EmailConfirmationModal: useEffect [isOpen, email] triggered. isOpen:', isOpen, 'email:', email, 'initialCodeSentForEmailRef.current:', initialCodeSentForEmailRef.current);
    if (isOpen && email) {
      if (initialCodeSentForEmailRef.current !== email) { // Only send if it's a new opening or different email
        console.log('EmailConfirmationModal: useEffect condition met (new open/email). Calling handleResendCode.');
        setStatus(null);
        setStatusMessage('');
        setVerificationCode('');
        handleResendCode();
        initialCodeSentForEmailRef.current = email; // Mark that code was sent for this email this session
      } else {
        console.log('EmailConfirmationModal: useEffect condition met, but initial code already sent for this email session.');
      }
    } else if (!isOpen) {
      console.log('EmailConfirmationModal: Modal closed, resetting initialCodeSentForEmailRef.');
      initialCodeSentForEmailRef.current = null; // Reset when modal is closed
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, email]);
  
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleResendCode = async () => {
    console.log('EmailConfirmationModal: handleResendCode called. Countdown:', countdown, 'Status:', status);
    if (countdown > 0 || status === 'loading') {
      console.log('EmailConfirmationModal: handleResendCode GUARDED. Returning.');
      return;
    }
    console.log('EmailConfirmationModal: handleResendCode PROCEEDING.');
    setStatus('loading');
    setStatusMessage('Enviando código de verificación...');
    try {
      await api.post('/auth/send-verification-code/user', { email });
      setStatus('success');
      setStatusMessage('Se ha enviado un código de verificación a tu correo.');
      setCountdown(60);
    } catch (error) {
      console.error('Error al reenviar código:', error);
      setStatus('error');
      setStatusMessage(error.response?.data?.message || 'Error al enviar el código. Inténtalo de nuevo más tarde.');
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    if (!verificationCode || verificationCode.length !== 6) {
      setStatus('error');
      setStatusMessage('Por favor, introduce un código de 6 dígitos.');
      return;
    }
    setStatus('loading');
    setStatusMessage('Verificando código...');
    try {
      const response = await api.post('/auth/verify-email-code/user', { email, code: verificationCode });
      setStatus('success');
      setStatusMessage('¡Correo verificado con éxito!');
      await login(response.data.accessToken);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Error al verificar código:', error);
      setStatus('error');
      setStatusMessage(error.response?.data?.message || 'Error al verificar el código. Inténtalo de nuevo.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-60 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden transform transition-all">
        <div className="absolute top-0 right-0 pt-4 pr-4 z-10">
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Cerrar"
          >
            <XCircleIcon className="h-6 w-6" />
          </button>
        </div>
        
        <div className="p-6 pt-8 sm:p-8">
          <div className="text-center mb-6">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-coral-100 mb-4">
              <KeyIcon className="h-8 w-8 text-coral" />
            </div>
            <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2">Verifica tu Correo</h3>
            <p className="text-sm sm:text-base text-gray-600">
              Hemos enviado un código de 6 dígitos a <span className="font-medium text-coral">{email}</span>.
              Por favor, introduce el código a continuación.
            </p>
          </div>
          
          {status && (
            <div className={`mb-4 p-3.5 rounded-lg text-sm ${ 
              status === 'success' ? 'bg-green-50 border border-green-300 text-green-700' : 
              status === 'error' ? 'bg-red-50 border border-red-300 text-red-700' :
              'bg-blue-50 border border-blue-300 text-blue-700'
            }`}>
              <div className="flex items-center">
                {status === 'success' && <CheckCircleIcon className="h-5 w-5 mr-2 flex-shrink-0" />}
                {status === 'error' && <XCircleIcon className="h-5 w-5 mr-2 flex-shrink-0" />}
                {status === 'loading' && (
                  <svg className="animate-spin h-5 w-5 mr-2 flex-shrink-0 text-currentColor" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                <p>{statusMessage}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleVerifyCode} className="space-y-5">
            <div>
              <label htmlFor="verificationCode" className="sr-only">Código de Verificación</label>
              <input 
                type="text"
                id="verificationCode"
                name="verificationCode"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                placeholder="_ _ _ _ _ _"
                maxLength={6}
                className="w-full text-center text-2xl tracking-[0.3em] font-mono py-3 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral transition-colors placeholder-gray-400"
                required
              />
            </div>
            
            <div className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={status === 'loading' || verificationCode.length !== 6}
                className={`w-full py-3 px-4 rounded-lg text-white font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-coral ${ 
                  (status === 'loading' || verificationCode.length !== 6) 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-coral hover:bg-coral-dark'
                }`}
              >
                {status === 'loading' && statusMessage.startsWith('Verificando') ? 'Verificando...' : 'Verificar Código'}
              </button>
              <button
                type="button"
                onClick={handleResendCode}
                disabled={countdown > 0 || status === 'loading'}
                className={`w-full py-3 px-4 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-coral-light disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed`}
              >
                {countdown > 0 ? `Reenviar código en ${countdown}s` : (status === 'loading' && statusMessage.startsWith('Enviando') ? 'Enviando...' : 'Reenviar Código')}
              </button>
            </div>
          </form>

          <div className="mt-6 text-xs text-gray-500 text-center space-y-1">
            <p>Si no encuentras el correo, revisa tu carpeta de spam o correo no deseado.</p>
            <p>El código expirará en 10 minutos.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

EmailConfirmationModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  email: PropTypes.string.isRequired,
};

export default EmailConfirmationModal; 