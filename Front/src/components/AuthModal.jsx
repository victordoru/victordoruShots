import { useState } from "react";
import PropTypes from 'prop-types';
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import SignIn from "@/pages/auth/SignIn";
import SignUp from "@/pages/auth/SignUp";
import EmailConfirmationModal from "@/components/EmailConfirmationModal";

const AuthModal = ({ onClose, redirectTo = null, isOpen }) => {
  const [activeTab, setActiveTab] = useState("signup");
  const [showEmailConfirmationCodeModal, setShowEmailConfirmationCodeModal] = useState(false);
  const [emailForCodeVerification, setEmailForCodeVerification] = useState("");

  const handleCloseAllModals = () => {
    setShowEmailConfirmationCodeModal(false);
    onClose(); // Call original onClose for AuthModal
  };

  const handleCodeVerificationRequired = (email) => {
    setEmailForCodeVerification(email);
    setShowEmailConfirmationCodeModal(true);
    // Cierra el AuthModal principal (pestañas) cuando se requiere verificación de código
    // pero mantiene el overlay para EmailConfirmationModal al no establecer isOpen como false aquí.
    // El componente padre (que controla isOpen para AuthModal) podría seguir pensando que AuthModal está abierto.
    // Esto será manejado por la lógica de renderizado a continuación.
    if (isOpen) { // Si AuthModal estaba abierto, llama a su onClose para ocultar la interfaz de pestañas
        onClose(); // Esto debería ocultar la parte de AuthModal
    }
  };

  // If only the EmailConfirmationModal should be visible
  if (showEmailConfirmationCodeModal) {
    return (
      <EmailConfirmationModal
        isOpen={true} // It's definitely open if we are in this block
        onClose={() => {
          setShowEmailConfirmationCodeModal(false);
          // After closing the code modal, we don't automatically re-open AuthModal.
          // The user would need to trigger AuthModal again if needed.
        }}
        email={emailForCodeVerification}
      />
    );
  }

  // If AuthModal itself is not supposed to be open, and code modal isn't either, render nothing.
  if (!isOpen) return null;

  // Render AuthModal (tabs)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
      <div 
        className="bg-white rounded-lg shadow-lg w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="absolute top-0 right-0 flex justify-end z-10 p-2">
          <button 
            onClick={handleCloseAllModals} // Close everything if this button is clicked
            className="flex items-center justify-center gap-2 bg-coral text-white px-4 py-2 rounded-full hover:bg-coral/90 transition-colors shadow-md"
            aria-label="Cerrar"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </button>
        </div>
        
        <div className="w-full">
          <div className="flex w-full rounded-t-lg overflow-hidden">
            <button
              className={`flex-1 py-3 transition-all duration-300 ${
                activeTab === "signup" 
                  ? "bg-white text-coral font-bold border-b-2 border-coral shadow-sm" 
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100"
              }`}
              onClick={() => setActiveTab("signup")}
            >
              <span className="flex items-center justify-center gap-2">
                Registrarse
              </span>
            </button>
            <button
              className={`flex-1 py-3 transition-all duration-300 ${
                activeTab === "login" 
                  ? "bg-white text-coral font-bold border-b-2 border-coral shadow-sm" 
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100"
              }`}
              onClick={() => setActiveTab("login")}
            >
              <span className="flex items-center justify-center gap-2">
                Iniciar sesión
              </span>
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 sm:px-10">
          {activeTab === "login" ? (
            <SignIn 
              redirectTo={redirectTo} 
              onClose={handleCloseAllModals} // If sign-in is successful from here, close all modals
              isModal={true} 
              onCodeVerificationRequired={handleCodeVerificationRequired}
            />
          ) : (
            <SignUp 
              redirectTo={redirectTo} 
              onClose={handleCloseAllModals} // If sign-up (non-code path) is successful, close all modals
              isModal={true} 
              onCodeVerificationRequired={handleCodeVerificationRequired}
            />
          )}
        </div>
      </div>
    </div>
  );
};

AuthModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  redirectTo: PropTypes.string,
};

export default AuthModal; 