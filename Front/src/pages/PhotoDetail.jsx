import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/utils/axiosInstance";

const DetailSkeleton = () => (
  <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-24 pt-24 text-white">
    <div className="h-[60vh] w-full animate-pulse rounded-3xl bg-white/10" />
    <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
      <div className="space-y-4">
        <div className="h-10 w-2/3 animate-pulse rounded-full bg-white/10" />
        <div className="h-3 w-full animate-pulse rounded-full bg-white/10" />
        <div className="h-3 w-4/5 animate-pulse rounded-full bg-white/10" />
      </div>
      <div className="h-48 animate-pulse rounded-3xl bg-white/10" />
    </div>
  </div>
);

const PhotoDetail = () => {
  const { photoId } = useParams();
  const navigate = useNavigate();
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPhoto = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/photos/public/${photoId}`);
        setPhoto(data);
      } catch (err) {
        console.error("Error fetching photo", err);
        setError("No encontramos esta fotografía.");
      } finally {
        setLoading(false);
      }
    };

    fetchPhoto();
  }, [photoId]);

  const imageBase = import.meta.env.VITE_URL_BACKEND;

  if (loading) return <DetailSkeleton />;

  if (error || !photo) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-4 pb-24 pt-24 text-center text-white">
        <p className="text-lg uppercase tracking-[0.3em]">{error || "No encontramos esta fotografía"}</p>
        <button
          onClick={() => navigate(-1)}
          className="rounded-full border border-white/30 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white/60"
        >
          Volver
        </button>
      </div>
    );
  }

  const {
    title,
    description,
    price,
    tags = [],
    metadata = {},
    createdAt,
  } = photo;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pb-24 pt-24 text-white">
      <button
        onClick={() => navigate(-1)}
        className="self-start rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white"
      >
        ← Volver
      </button>

      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 shadow-2xl">
        <img
          src={`${imageBase}${photo.imagePath}`}
          alt={title}
          className="h-full w-full max-h-[70vh] object-contain"
        />
      </div>

      <section className="grid gap-8 md:grid-cols-[2fr_1fr]">
        <article className="flex flex-col gap-4">
          <header className="space-y-2">
            <h1 className="text-3xl font-semibold uppercase tracking-[0.3em] md:text-4xl">
              {title}
            </h1>
            {createdAt && (
              <p className="text-xs uppercase tracking-[0.3em] text-white/40">
                Publicada el {new Date(createdAt).toLocaleDateString()}
              </p>
            )}
          </header>
          {description && <p className="text-sm text-white/70">{description}</p>}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-white/10 px-3 py-1 text-[0.6rem] uppercase tracking-[0.3em] text-white/60"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </article>

        <aside className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/60">Precio</p>
            <p className="mt-2 text-2xl font-semibold">
              {price ? `${Number(price).toFixed(2)} €` : "Consultar"}
            </p>
          </div>

          <dl className="space-y-3 text-xs text-white/60">
            {metadata.camera && (
              <div>
                <dt className="uppercase tracking-[0.3em]">Cámara</dt>
                <dd className="mt-1 text-white/80">{metadata.camera}</dd>
              </div>
            )}
            {metadata.location && (
              <div>
                <dt className="uppercase tracking-[0.3em]">Ubicación</dt>
                <dd className="mt-1 text-white/80">{metadata.location}</dd>
              </div>
            )}
            {metadata.shotAt && (
              <div>
                <dt className="uppercase tracking-[0.3em]">Capturada</dt>
                <dd className="mt-1 text-white/80">
                  {new Date(metadata.shotAt).toLocaleDateString()}
                </dd>
              </div>
            )}
          </dl>
        </aside>
      </section>
    </div>
  );
};

export default PhotoDetail;
