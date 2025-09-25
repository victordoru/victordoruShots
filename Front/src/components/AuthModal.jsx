import { useState } from "react";
import PropTypes from 'prop-types';
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import SignIn from "@/pages/auth/SignIn";
import SignUp from "@/pages/auth/SignUp";

const AuthModal = ({ onClose, redirectTo = null, isOpen }) => {
  const [activeTab, setActiveTab] = useState("signup");

  const handleCloseAllModals = () => {
    onClose();
  };

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
            />
          ) : (
            <SignUp 
              redirectTo={redirectTo} 
              onClose={handleCloseAllModals} // If sign-up (non-code path) is successful, close all modals
              isModal={true}
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
