import React, { useEffect, useMemo, useState } from "react";
import api from "@/utils/axiosInstance";

const initialForm = {
  title: "",
  description: "",
  price: "",
  tags: "",
  camera: "",
  location: "",
  shotAt: "",
};

const ContentManagement = () => {
  const [form, setForm] = useState(initialForm);
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchPhotos();
  }, []);

  const fetchPhotos = async () => {
    try {
      const { data } = await api.get("/photos");
      setPhotos(data);
    } catch (err) {
      console.error("Error fetching photos", err);
      setError("No se pudieron cargar las fotos");
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
  };

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const resetForm = () => {
    setForm(initialForm);
    setImageFile(null);
    setPreview(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.title.trim()) {
      setError("El título es obligatorio");
      return;
    }

    if (!imageFile) {
      setError("Selecciona una imagen antes de guardar");
      return;
    }

    try {
      setIsSubmitting(true);
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (value) formData.append(key, value);
      });
      formData.append("image", imageFile);

      await api.post("/photos", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setSuccess("Imagen guardada correctamente");
      resetForm();
      await fetchPhotos();
    } catch (err) {
      console.error("Error creating photo", err);
      const message = err.response?.data?.message || "No se pudo guardar la imagen";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const sortedPhotos = useMemo(
    () =>
      [...photos].sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      ),
    [photos]
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-10 text-white">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-semibold uppercase tracking-[0.4em] sm:text-5xl">
          Content Management
        </h1>
        <p className="text-sm text-white/60 sm:text-base">
          Sube imágenes para tu catálogo. Los archivos se almacenan en el servidor y aquí guardamos la referencia con los datos clave.
        </p>
      </header>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur lg:p-8">
        <h2 className="mb-6 text-2xl font-semibold uppercase tracking-[0.3em] text-white">
          Nueva imagen
        </h2>
        <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-[1fr_280px]">
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-widest text-white/60">Título*</span>
                <input
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                  placeholder="Nombre de la fotografía"
                  required
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-widest text-white/60">Precio (€)</span>
                <input
                  name="price"
                  value={form.price}
                  onChange={handleChange}
                  type="number"
                  min="0"
                  step="0.01"
                  className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                  placeholder="0.00"
                />
              </label>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-widest text-white/60">Descripción</span>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={4}
                className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                placeholder="Notas sobre la toma, inspiración, contexto..."
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-widest text-white/60">Etiquetas</span>
                <input
                  name="tags"
                  value={form.tags}
                  onChange={handleChange}
                  className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                  placeholder="playa, analógico, verano"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-widest text-white/60">Cámara</span>
                <input
                  name="camera"
                  value={form.camera}
                  onChange={handleChange}
                  className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                  placeholder="Canon R6"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-widest text-white/60">Ubicación</span>
                <input
                  name="location"
                  value={form.location}
                  onChange={handleChange}
                  className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                  placeholder="Tarifa, Cádiz"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-widest text-white/60">Fecha de captura</span>
                <input
                  name="shotAt"
                  value={form.shotAt}
                  onChange={handleChange}
                  type="date"
                  className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                />
              </label>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
              <label className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-black/30 px-4 py-8 text-center text-white/70 transition hover:border-white/40 hover:text-white">
                <span className="text-xs uppercase tracking-[0.3em]">Selecciona una imagen</span>
                <span className="text-[0.7rem] text-white/40">JPEG, PNG o WebP</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </label>
              {preview && (
                <div className="h-32 w-full overflow-hidden rounded-2xl border border-white/10 sm:w-48">
                  <img src={preview} alt="Preview" className="h-full w-full object-cover" />
                </div>
              )}
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}
            {success && <p className="text-sm text-emerald-300">{success}</p>}

            <div className="flex flex-wrap gap-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-black transition hover:bg-white/80 disabled:cursor-not-allowed disabled:bg-white/40"
              >
                {isSubmitting ? "Guardando..." : "Guardar"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white/40 hover:text-white"
              >
                Limpiar
              </button>
            </div>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur lg:p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold uppercase tracking-[0.3em] text-white">
            Biblioteca
          </h2>
          <span className="text-xs uppercase tracking-[0.3em] text-white/40">
            {sortedPhotos.length} elementos
          </span>
        </div>

        {sortedPhotos.length === 0 ? (
          <p className="text-sm text-white/50">
            Aún no has añadido fotografías. Cuando subas una imagen aparecerá aquí con sus metadatos.
          </p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {sortedPhotos.map((photo) => (
              <article
                key={photo._id}
                className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-lg"
              >
                <div className="relative h-56 w-full overflow-hidden">
                  <img
                    src={`${import.meta.env.VITE_URL_BACKEND}${photo.imagePath}`}
                    alt={photo.title}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute left-4 top-4 rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/80 backdrop-blur">
                    {photo.price ? `${Number(photo.price).toFixed(2)} €` : "Sin precio"}
                  </span>
                </div>
                <div className="flex flex-col gap-3 p-5 text-sm text-white/80">
                  <header>
                    <h3 className="text-lg font-semibold uppercase tracking-[0.2em] text-white">
                      {photo.title}
                    </h3>
                    <p className="mt-2 text-xs uppercase tracking-[0.3em] text-white/40">
                      {photo.createdAt ? new Date(photo.createdAt).toLocaleDateString() : ""}
                    </p>
                  </header>
                  {photo.description && (
                    <p className="text-sm text-white/70">{photo.description}</p>
                  )}
                  <dl className="grid grid-cols-1 gap-2 text-xs text-white/50 sm:grid-cols-2">
                    {photo.metadata?.camera && (
                      <div>
                        <dt className="uppercase tracking-[0.3em]">Cámara</dt>
                        <dd className="mt-1 text-white/70">{photo.metadata.camera}</dd>
                      </div>
                    )}
                    {photo.metadata?.location && (
                      <div>
                        <dt className="uppercase tracking-[0.3em]">Ubicación</dt>
                        <dd className="mt-1 text-white/70">{photo.metadata.location}</dd>
                      </div>
                    )}
                    {photo.metadata?.shotAt && (
                      <div>
                        <dt className="uppercase tracking-[0.3em]">Capturada</dt>
                        <dd className="mt-1 text-white/70">
                          {new Date(photo.metadata.shotAt).toLocaleDateString()}
                        </dd>
                      </div>
                    )}
                  </dl>
                  {photo.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {photo.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-white/10 px-3 py-1 text-[0.65rem] uppercase tracking-[0.3em] text-white/60"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default ContentManagement;
