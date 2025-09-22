import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { useState, useEffect } from "react";

const ComingSoonPage = () => {
  const { profile } = useAuth();
  const [showScrollIndicator, setShowScrollIndicator] = useState(true);

  const firstName = profile?.name?.split(" ")[0] || "Usuario";

  useEffect(() => {
    const handleScroll = () => {
      // Hide the scroll indicator when the user scrolls down more than 100px
      if (window.scrollY > 100) {
        setShowScrollIndicator(false);
      } else {
        setShowScrollIndicator(true);
      }
    };

    // Add scroll event listener
    window.addEventListener("scroll", handleScroll);

    // Clean up the event listener when component unmounts
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <div className=" min-h-screen text-white pt-10">
      <div className="max-w-5xl mx-auto px-4 pt-10  sm:px-6 sm:pt-20">
        {/* Cabecera con Avatar */}
        <div className="text-center mb-10 sm:mb-2">
          <div className="mb-6 flex justify-center">
            <div className="w-24 h-24 rounded-full border-4 border-white shadow-xl overflow-hidden">
              {profile?.profilePicture ? (
                <img
                  src={profile.profilePicture}
                  alt={profile.name || "Usuario"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-white/20 flex items-center justify-center text-white font-bold text-4xl">
                  {profile?.name?.charAt(0) || "W"}
                </div>
              )}
            </div>
          </div>

          <h1 className="text-5xl md:text-[90px] font-bold  text-white italic">
            ¡Hola, <span className="text-black">{firstName}</span> !
          </h1>
          <p className="text-2xl md:text-4xl text-white max-w-2xl mx-auto mb-1 font-bold">
            Gracias por unirte a nosotros.
          </p>
        </div>

        {/* Imagen de mockups */}
        <div className="mx-auto max-h-[500px] mb-0 sm:mb-[200px] mt-4">
          <img
            src="/images/mockup3.png"
            alt="Winto App Mockup"
            className=" px-0 sm:px-10 w-full h-auto object-contain "
          />
        </div>
        {showScrollIndicator && (
          <div
            className="text-white text-2xl animate-bounce fixed bottom-0 left-1/2 transform -translate-x-1/2"
            id="scrollIndicator"
          >
            <ChevronDownIcon className="w-6 h-6" />
          </div>
        )}

        {/* Sección INFO */}

        <div className="sm:-mt-10 mt-0 bg-white/80 backdrop-blur-sm rounded-2xl p-8 mb-10 shadow-xl border border-white/20 relative overflow-hidden">
          <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center text-black relative">
            
            <span className="relative text-3xl italic"> ¡CASI LISTOS!</span>
          </h2>

          {/* Mensaje creativo deportivo */}
          <div className="mb-8 text-center">
            <div className="inline-block relative px-8 py-1">
              <div className="absolute inset-0 bg-coral/20 transform -skew-x-12"></div>
              <p className="text-xl font-bold text-coral mb-2 relative">
                🏆 ¡PREPARANDO TU EXPERIENCIA! 🏆
              </p>
            </div>
            <p className="text-lg text-black italic mt-4">
              {/*  &ldquo;El mejor entrenamiento no se ve hasta el día de la
              competición&rdquo; */}
            </p>
          </div>

          <p className="text-lg mb-6 text-black text-center">
            En <span className="font-bold text-coral">Winto</span> estamos
            haciendo los últimos sprints para revolucionar
            <span className="relative inline-block mx-1">
              <span className="relative z-10">tu experiencia deportiva</span>
              <span className="absolute bottom-0 left-0 w-full h-2 bg-coral/30"></span>
            </span>
            {/* . ¡Pronto cruzaremos juntos la línea de meta! */}
            Hemos recorrido el camino largo, ¡y ahora viene lo mejor!
          </p>

          {/* Contador de progreso estilo deportivo */}
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-6 dark:bg-gray-700">
            <div
              className="bg-coral h-2.5 rounded-full"
              style={{ width: "85%" }}
            ></div>
          </div>
          <p className="text-xs text-center text-black/60 -mt-5 mb-6">
            85% - ¡Estamos en la última vuelta!
          </p>

          <div className="bg-black/5 rounded-xl p-4 mb-6">
            <ul className="text-black space-y-2">
              <li className="flex items-center">
                <span className="mr-2 text-coral font-bold">🏃‍♂️</span>
                <span>Estamos afinando nuestros músculos digitales</span>
              </li>
              <li className="flex items-center">
                <span className="mr-2 text-coral font-bold">⏱️</span>
                <span>
                  Cronometrando cada detalle para tu experiencia perfecta
                </span>
              </li>
              <li className="flex items-center">
                <span className="mr-2 text-coral font-bold">🥇</span>
                <span>Puliendo el podio donde tus logros brillarán</span>
              </li>
            </ul>
          </div>

          <p className="text-lg mb-6 text-black text-center">
            Mientras tanto, puedes explorar nuestra página principal y conocer
            más sobre cómo vamos a transformar tu experiencia deportiva.
          </p>

          <div className="flex flex-col md:flex-row gap-4 justify-center mt-8">
            <Link
              to="/"
              className="btn-lg bg-white hover:bg-gray-100 text-coral font-medium text-center transform transition-transform hover:scale-105 shadow-md"
            >
              Explorar inicio
            </Link>
            <Link
              to="/hazte-partner"
              className="btn-lg bg-black hover:bg-black/80 text-white font-medium text-center transform transition-transform hover:scale-105 shadow-md"
            >
              Conoce Winto Partner
            </Link>
          </div>
        </div>

        {/* Footer con URL */}

        <div className="mt-10 sm:mt-20 mb-10 text-center">
          <div className="mb-8 sm:mb-16 text-center">
            <img
              src="/images/linea-meta.png"
              alt="Línea de meta"
              className="w-full rounded-lg mx-auto"
            />
          </div>

          <h1 className="text-5xl sm:text-6xl mb-3 mt-10 font-extrabold text-center text-black animate-pulse">
            ¿LISTO PARA COMPETIR?
          </h1>

          <h1 className="text-4xl  mb-[70px] font-bold text-center text-white">
            Be into Sports.
          </h1>

          {/* <div className="relative max-w-xs mx-auto mb-6 p-4 bg-white/10 rounded-lg backdrop-blur-sm border border-white/20">
            <div className="absolute -top-3 right-3 bg-coral text-white text-xs px-2 py-1 rounded-full">
              PRÓXIMAMENTE
            </div>
            <div className="flex justify-center mb-2">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20">
                <span className="text-white text-xl">🏁</span>
              </div>
            </div>
            <p className="text-white text-center text-sm">
              Tu carrera digital está a punto de comenzar
            </p>
          </div> */}

          <div className="text-center text-white">
            <p className="text-lg font-bold mb-2">www.winto.app</p>
            <p className="text-normal">
              Si tienes preguntas, contáctanos en{" "}
              <a
                href="mailto:info@winto.com"
                className="text-white hover:underline"
              >
                hola@winto.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComingSoonPage;
