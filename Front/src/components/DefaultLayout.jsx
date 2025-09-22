// src/components/DefaultLayout.jsx

import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import AOS from "aos";
import "aos/dist/aos.css";

import { useLocation } from "react-router-dom";
import Header from "@/components/ui/Header";
import Footer from "@/components/ui/Footer";

const GRID_LABELS = Array.from({ length: 30 }, (_, idx) =>
  String(idx + 1).padStart(2, "0")
);

const COLUMN_GRADIENTS = [
  "from-[#272727b4] via-[#1c1c1c3d] to-[#060606d4]",
  "from-[#242424b4] via-[#1111113d] to-[#050505d4]",
  "from-[#2d2d2db4] via-[#1414143d] to-[#040404d4]",
];


const DefaultLayout = ({ children }) => {
  const location = useLocation();
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 1024);

  const isHome = location.pathname === "/" || location.pathname === "/hazte-partner";
  const isContentManagement = location.pathname === "/content-management";
  const IsCommingSoon = location.pathname === "/coming-soon" || location.pathname === "/coming-soon/";
  const isEventListPage = location.pathname === "/events";

  useEffect(() => {
    AOS.init({
      once: true,
      disable: "phone",
      duration: 300,
      easing: "ease-out-cubic",
    });

    const handleResize = () => {
      setIsMobileView(window.innerWidth < 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isEventListPage && isMobileView) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isEventListPage, isMobileView]);
  const backgroundClass = isHome || isContentManagement
    ? "bg-[#0D0D0D] text-white"
    : IsCommingSoon
      ? "bg-coral text-white"
      : "bg-white text-slate-900";

  const showFooter = !(isEventListPage && isMobileView);

  return (
    <>
      <Header />
      <main
        className={`relative mx-auto min-h-screen overflow-hidden transition-colors duration-500 ease-in-out ${backgroundClass} ${
          isEventListPage ? "" : "px-0"
        } ${isEventListPage && isMobileView ? "overflow-hidden h-screen" : "overflow-auto"}`}
      >
        {(isHome || isContentManagement) && (
          <div className="absolute inset-0">
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-[#0D0D0D] via-[#151515ee] to-[#0D0D0D]" />
            <div className="relative h-full w-full">
              <div
                className="grid h-full w-full grid-cols-1 sm:grid-cols-3"
                style={{ gridAutoRows: "minmax(140px, 1fr)" }}
              >
                {GRID_LABELS.map((label, idx) => {
                  const gradient = COLUMN_GRADIENTS[idx % COLUMN_GRADIENTS.length];
                  return (
                    <div
                      key={label}
                      className="group relative flex h-full transform items-center justify-center overflow-hidden border border-transparent transition-all duration-500 ease-out hover:z-[1] hover:scale-[1.03]"
                    >
                      <div
                        className={`absolute inset-0 bg-gradient-to-l ${gradient} transition-colors duration-500 group-hover:bg-[#2a2a2a]`}
                      />
                      <div className="absolute inset-0 border border-transparent transition-colors duration-300 group-hover:border-white/20" />
                      <span className="relative z-10 translate-y-1 text-3xl font-semibold tracking-[0.3em] text-white/0 transition-all duration-500 group-hover:translate-y-0 group-hover:text-white/80">
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div
          className={`${
            isEventListPage ? "" : "px-4 sm:px-6 lg:px-12"
          } ${isEventListPage && isMobileView ? "flex h-full flex-col" : ""}`}
        >
          <div
            className={`relative z-10 mx-auto w-full ${
              isEventListPage ? "flex h-full flex-col" : isHome ? "max-w-6xl" : "max-w-5xl"
            }`}
          >
            {children}
          </div>
        </div>
        {showFooter && (
          <div className="relative z-10">
            <Footer border={true} isHome={isHome} />
          </div>
        )}
      </main>
    </>
  );
};

DefaultLayout.propTypes = {
  children: PropTypes.node.isRequired,
};

export default DefaultLayout;
