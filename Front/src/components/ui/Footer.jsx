import { Link } from "react-router-dom";
import Logo from "@/components/ui/Logo";
// Comentamos las importaciones no utilizadas para evitar errores de linter
// import GlobalNotifications from '@/components/GlobalNotifications';
// import UserNotifications from '@/components/UserNotifications';

export default function Footer({ border = false, isHome = false }) {
  return (
    <footer>
      <div className={`mx-auto px-4 sm:px-6  pt-20 pb-5 ${isHome ? "text-white bg-fondoNegro" : "text-black bg-white"}`}>
        {/* Top area: Blocks */}
        <div
          className={`grid gap-10 py-8 sm:grid-cols-12 md:py-12 max-w-[1300px] px-5 mx-auto `}
        >
          {/* 1st block */}
          <div className="space-y-2 sm:col-span-12 lg:col-span-4">
            <div>
              {isHome ? <img src="/images/winto-white.png" alt="logo" className="h-6 mb-3" /> : <Logo />}
            </div>
            <div className="text-sm ">
              &copy; Winto.app - All rights reserved.
            </div>
          </div>

          {/* 2nd block */}
          <div className="space-y-2 sm:col-span-6 md:col-span-3 lg:col-span-2">
            <h3 className="text-base font-medium">Contacto</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  className=" transition"
                  to="#0"
                >
                  hola@winto.com
                </Link>
              </li>
              <li>
                <Link
                  className=" transition"
                  to="#0"
                >
                  +34 654 057 767
                </Link>
              </li>
             
            </ul>
          </div>

          {/* 3rd block */}
          <div className="space-y-2 sm:col-span-6 md:col-span-3 lg:col-span-2">
            <h3 className="text-base font-medium">Produto</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  className=" transition"
                  to="/hazte-partner"
                >
                  Hazte partner
                </Link>
              </li>
              <li>
                <Link
                  className=" transition"
                  to="/legal/privacy"
                >
                  Política de privacidad
                </Link>
              </li>
              {/* <li className=" sm:hidden">
                <Link
                  className=" transition"
                  to="/legal/cookie"
                >
                  Política de cookies
                </Link>
              </li> */}
              <li className=" sm:hidden">
                <Link
                  className=" transition"
                  to="/legal/terms"
                >
                  Términos y condiciones
                </Link>
              </li>

              
            </ul>
          </div>

          {/* 4th block */}
          <div className="space-y-2 sm:col-span-6 md:col-span-3 lg:col-span-2 hidden sm:block">
            <h3 className="text-base font-medium">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li className="hidden sm:block">
                <Link
                  className=" transition"
                  to="/legal/cookie"
                >
                  Política de cookies
                </Link>
              </li>
              <li className="hidden sm:block">
                <Link
                  className=" transition"
                  to="/legal/terms"
                >
                  Términos y condiciones
                </Link>
              </li>
              <li className="hidden sm:block">
                <Link
                  className=" transition"
                  to="/legal/notice"
                >
                  Aviso Legal
                </Link>
              </li>
              
            </ul>
          </div>

          {/* 5th block */}
          <div className="space-y-2 sm:col-span-6 md:col-span-3 lg:col-span-2">
            <h3 className="text-base font-medium">Social</h3>
            <ul className="flex gap-3">
              <li>
                <Link
                  className="flex items-center justify-center text-red-500 hover:text-red-600 transition-colors"
                  to="https://www.instagram.com/winto.app/"
                  aria-label="Instagram"
                >
                  {/* Instagram Icon */}
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                  </svg>
                </Link>
              </li>
              <li>
                <Link
                  className="flex items-center justify-center text-red-500 hover:text-red-600 transition-colors"
                  to="https://www.facebook.com/winto.app/"
                  aria-label="Facebook"
                >
                  {/* Facebook Icon */}
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </Link>
              </li>
              <li>
                <Link
                  className="flex items-center justify-center text-red-500 hover:text-red-600 transition-colors"
                  to="https://www.linkedin.com/company/winto-app/"
                  aria-label="LinkedIn"
                >
                  {/* LinkedIn Icon */}
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Big text */}
      {/* <div className="relative -mt-16 h-60 w-full" aria-hidden="true">
        <div className="pointer-events-none absolute left-1/2 -z-10 -translate-x-1/2 text-center text-[348px] font-bold leading-none before:bg-gradient-to-b before:from-gray-200 before:to-gray-100/30 before:to-80% before:bg-clip-text before:text-transparent before:content-['Winto'] after:absolute after:inset-0 after:bg-gray-300/70 after:bg-clip-text after:text-transparent after:mix-blend-darken after:content-['Winto'] after:[text-shadow:0_1px_0_white]"></div>
       
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-2/3"
          aria-hidden="true"
        >
          <div className="h-56 w-56 rounded-full border-[20px] border-red-700 blur-[80px]"></div>
        </div>
      </div> */}
      
      {/* <GlobalNotifications />
      <UserNotifications /> */}
    </footer>
  );
}
