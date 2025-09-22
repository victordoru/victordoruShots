// src/hooks/useGoogleMaps.js
import { useEffect, useState } from 'react';

const useGoogleMaps = (apiKey) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Verificar si el script ya está cargado
    if (window.google && window.google.maps) {
      console.log('Google Maps ya está cargado');
      setLoaded(true);
      return;
    }

    // Crear el script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;

    // Manejar eventos de carga y error
    script.onload = () => setLoaded(true);
    script.onerror = () => setError(true);

    document.head.appendChild(script);

    // Cleanup
    return () => {
      document.head.removeChild(script);
    };
  }, [apiKey]);

  return { loaded, error };
};

export default useGoogleMaps;
