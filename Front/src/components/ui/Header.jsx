import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Logo from "@/components/ui/Logo";
import { useAuth } from "@/context/AuthContext";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";

export default function Header() {
  const { isAuthenticated, profile, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Maneja la apertura/cierre del menú móvil
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Enlaces comunes para todos los usuarios
  const commonLinks = (
    <>
      <li>
        <Link
          to="/content-management"
          className={`relative text-gray-800 hover:text-gray-600 w-fit block after:block after:content-[''] after:absolute after:h-[2px] after:bg-red-400 after:w-full after:scale-x-0 after:hover:scale-x-100 after:transition after:duration-300 after:origin-left ${
            location.pathname.includes("/content-management") ? "after:scale-x-100" : ""
          }`}
          onClick={() => setIsMobileMenuOpen(false)}
        >
          content management
        </Link>
      </li>
      <li>
        <Link
          to="/hazte-partner"
          className={`relative text-gray-800 hover:text-gray-600 w-fit block after:block after:content-[''] after:absolute after:h-[2px] after:bg-red-400 after:w-full after:scale-x-0 after:hover:scale-x-100 after:transition after:duration-300 after:origin-left ${
            location.pathname.includes("/hazte-partner") ? "after:scale-x-100" : ""
          }`}
          onClick={() => setIsMobileMenuOpen(false)}
        >
          Hazte Partner
        </Link>
      </li>
      <li>
        <Link
          to="/contact"
          className={`relative text-gray-800 hover:text-gray-600 w-fit block after:block after:content-[''] after:absolute after:h-[2px] after:bg-red-400 after:w-full after:scale-x-0 after:hover:scale-x-100 after:transition after:duration-300 after:origin-left ${
            location.pathname.includes("/contact") ? "after:scale-x-100" : ""
          }`}
          onClick={() => setIsMobileMenuOpen(false)}
        >
          Contacta
        </Link>
      </li>
    </>
  );

  // Enlaces para usuarios no autenticados
  const unauthenticatedLinks = (
    <>
      <li className="ms-0 mt-5 md:ms-10 md:mt-0">
        <Link
          to="/signin"
          className="btn-sm bg-white text-gray-800 shadow hover:bg-gray-50"
          onClick={() => setIsMobileMenuOpen(false)} // Cierra el menú al hacer clic
        >
          Iniciar Sesión
        </Link>
      </li>
      <li>
        <Link
          to="/signup"
          className="btn-sm bg-gray-800 text-gray-200 shadow hover:bg-gray-900"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          Unirme
        </Link>
      </li>
    </>
  );
 
  // Enlaces para usuarios autenticados con rol "user"
  const userLinks = <></>;

  // Enlaces para usuarios autenticados con rol "partner"
  const partnerLinks = <></>;

  // Componente de avatar para usuarios autenticados - solo desktop
  const UserAvatar = () => (
    <li className="ms-0 md:ms-4 relative group">
      <div className="flex items-center cursor-pointer">
        <Link to="/profile">
          <span className="mr-2 text-gray-800 transition-colors duration-300 group-hover:text-coral">
            {profile?.name?.split(' ')[0] || "Usuario"}
          </span>
        </Link>
        <Link to="/profile">
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow transition-all duration-300 group-hover:border-coral group-hover:shadow-md group-hover:scale-110">
            {profile?.profilePicture ? (
              <img 
                src={profile.profilePicture} 
                alt={profile.name || "Usuario"}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-coral/20 flex items-center justify-center text-coral font-bold transition-colors duration-300 group-hover:bg-coral/30">
                {profile?.name?.charAt(0) || "U"}
              </div>
            )}
          </div>
        </Link>
      </div>

      {/* Menú desplegable - visible en hover */}
      <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-100 transform origin-top-right transition-all duration-200 
                     opacity-0 invisible scale-95 group-hover:opacity-100 group-hover:visible group-hover:scale-100">
        <Link 
          to="/profile" 
          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-coral"
        >
          Mi Perfil
        </Link>
        <Link 
          to="/profile" 
          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-coral"
        >
          Mis Eventos
        </Link>
        <Link 
          to="/content-management" 
          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-coral"
        >
          Content Management
        </Link>
        <Link 
          to="/orders-management" 
          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-coral"
        >
          Orders Management
        </Link>
        <div className="border-t border-gray-100 my-1"></div>
        <button
          onClick={() => logout()}
          className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 hover:text-red-700"
        >
          Cerrar Sesión
        </button>
      </div>
    </li>
  );

  // Versión móvil del menú de perfil
  const MobileProfileMenu = () => (
    isAuthenticated && (
      <>
        <div className="border-t border-gray-200 my-4"></div>
        {/* Cabecera del perfil en móvil */}
        <Link to="/profile" className="block" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow">
              {profile?.profilePicture ? (
                <img 
                  src={profile.profilePicture} 
                  alt={profile.name || "Usuario"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-coral/20 flex items-center justify-center text-coral font-bold">
                  {profile?.name?.charAt(0) || "U"}
                </div>
              )}
            </div>
            <div className="ml-3">
              <p className="font-medium text-gray-800">
                {profile?.name || "Usuario"}
              </p>
              <p className="text-sm text-gray-500">
                {profile?.email || ""}
              </p>
            </div>
          </div>
        </Link>
        <Link 
          to="/profile" 
          className="block py-2 text-base text-gray-700 hover:text-coral"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          Mi Perfil
        </Link>
        <Link 
          to="/profile" 
          className="block py-2 text-base text-gray-700 hover:text-coral"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          Mis Eventos
        </Link>
        <Link 
          to="/content-management" 
          className="block py-2 text-base text-gray-700 hover:text-coral"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          Content Management
        </Link>
        <Link 
          to="/orders-management" 
          className="block py-2 text-base text-gray-700 hover:text-coral"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          Orders Management
        </Link>
        <button
          onClick={() => {
            logout();
            setIsMobileMenuOpen(false);
          }}
          className="block w-full text-left py-2 text-base text-red-600 hover:text-red-700"
        >
          Cerrar Sesión
        </button>
      </>
    )
  );

  return (
    <header className="fixed top-2 z-30 w-full md:top-6">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative flex h-14 items-center justify-between gap-3 rounded-2xl bg-white/90 px-3 shadow-lg shadow-black/[0.03] backdrop-blur-sm before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:border before:border-transparent before:[background:linear-gradient(theme(colors.gray.100),theme(colors.gray.200))_border-box] before:[mask-composite:exclude_!important] before:[mask:linear-gradient(white_0_0)_padding-box,_linear-gradient(white_0_0)]">
          {/* Site branding */}
          <div className="flex flex-1 items-center">
            <Logo />
          </div>

          {/* Desktop navigation */}
          <nav className="hidden md:flex flex-1 items-center justify-end">
            <ul className="flex items-center gap-3">
              {commonLinks}
              {!isAuthenticated && unauthenticatedLinks}
              {isAuthenticated && profile?.role !== "user" && partnerLinks}
              {isAuthenticated && profile?.role === "user" && userLinks}
              {isAuthenticated && <UserAvatar />}
            </ul>
          </nav>

          {/* Mobile menu button */}
          <div className="flex md:hidden">
            <button
              onClick={toggleMobileMenu}
              type="button"
              className="inline-flex items-center justify-center rounded-md p-2 text-gray-800 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-red-500"
              aria-controls="mobile-menu"
              aria-expanded={isMobileMenuOpen}
            >
              <span className="sr-only">Open main menu</span>
              {isMobileMenuOpen ? (
                <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className="md:hidden">
        {/* Overlay */}
        <div
          className={`fixed inset-0 bg-black bg-opacity-50 transition-opacity duration-300 ${
            isMobileMenuOpen ? "opacity-50" : "opacity-0 pointer-events-none"
          }`}
          onClick={toggleMobileMenu}
          aria-hidden={!isMobileMenuOpen}
        ></div>

        {/* Menu panel */}
        <div
          className={`fixed top-0 left-0 w-3/4 max-w-xs bg-white h-full shadow-lg p-4 transform transition-transform duration-300 ease-in-out ${
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between mb-8">
            <Logo />
            <button
              onClick={toggleMobileMenu}
              type="button"
              className="inline-flex items-center justify-center rounded-md p-2 text-gray-800 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-red-500"
            >
              <span className="sr-only">Close main menu</span>
              <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
            </button>
          </div>
          <nav>
            <ul className="flex flex-col gap-4">
              {commonLinks}
              {!isAuthenticated && unauthenticatedLinks}
              {isAuthenticated && profile?.role === "partner" && partnerLinks}
              {isAuthenticated && profile?.role === "user" && userLinks}
            </ul>
            <MobileProfileMenu />
          </nav>
        </div>
      </div>
    </header>
  );
}
