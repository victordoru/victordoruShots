// src/pages/Home.jsx

import React, { useEffect, useMemo, useState } from "react";
import api from "@/utils/axiosInstance";

const AccentLine = () => (
  <span className="mt-6 block h-px w-24 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
);

const buildColumns = (photos, columns = 3) => {
  const output = Array.from({ length: columns }, () => []);
  photos.forEach((photo, index) => {
    output[index % columns].push(photo);
  });
  return output;
};


const Home = () => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPhotos = async () => {
      try {
        setLoading(true);
        const { data } = await api.get("/photos/public", {
          params: { limit: 9 },
        });
        setPhotos(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error fetching gallery", err);
        setError("No se pudieron cargar las fotografías.");
      } finally {
        setLoading(false);
      }
    };

    fetchPhotos();
  }, []);

  const columns = useMemo(() => buildColumns(photos, 3), [photos]);

  const imageBase = import.meta.env.VITE_URL_BACKEND;

  return (
    <div className="relative z-10 flex w-full flex-col items-center pb-24 pt-28 sm:pt-36">
      <section className="flex w-full max-w-5xl flex-col items-center px-4 text-center text-white">
        <h1 className="text-balance font-semibold uppercase tracking-tight text-4xl leading-tight sm:text-5xl md:text-[4.5rem]">
          Hi, I'm Victor,
          <span className="mx-2 inline-block text-white/60 transition-colors duration-300 hover:text-white">
            just another web developer
          </span>
          . But you know what? I love riding waves, the ocean, traveling, and
          <span className="mx-2 inline-block text-white/60 transition-colors duration-300 hover:text-white">
            capturing those moments.
          </span>
        </h1>
      </section>

      <section className="mt-20 flex w-full flex-col items-center gap-10 px-6 text-white sm:px-10 lg:px-16">
        {loading && (
          <p className="text-sm uppercase tracking-[0.3em] text-white/60">
            Cargando galería...
          </p>
        )}
        {error && !loading && (
          <p className="text-sm text-red-300">{error}</p>
        )}
        {!loading && !error && photos.length === 0 && (
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">
            Aún no hay fotografías. Súbelas desde Content Management.
          </p>
        )}

        {!loading && photos.length > 0 && (
          <div className="grid w-full max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {columns.map((column, columnIndex) => (
              <div className="flex flex-col gap-12" key={`column-${columnIndex}`}>
                {column.map((photo) => (
                  <a
                    key={photo._id}
                    href={`/photo/${photo._id}`}
                    className="group block overflow-hidden rounded-2xl shadow-[0_0_54px_9px_rgba(68,46,94,0.45)] transition-all duration-500 hover:shadow-[0_0_70px_12px_rgba(68,46,94,0.6)]"
                  >
                    <img
                      src={`${imageBase}${photo.imagePath}`}
                      alt={photo.title || "Fotografía"}
                      className="h-full w-full object-cover transition duration-500 grayscale contrast-[1.3] group-hover:grayscale-0 group-hover:contrast-100"
                      loading="lazy"
                    />
                  </a>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-24 flex w-full max-w-4xl flex-col items-center text-center text-white">
        <h2 className="text-3xl font-semibold uppercase tracking-[0.4em] sm:text-4xl">Servicios</h2>
        <AccentLine />
      </section>

      <section className="mt-12 flex w-full max-w-4xl flex-col items-center text-center text-white">
        <h2 className="text-3xl font-semibold uppercase tracking-[0.4em] sm:text-4xl">Sobre mí</h2>
        <AccentLine />
      </section>
    </div>
  );
};

export default Home;
