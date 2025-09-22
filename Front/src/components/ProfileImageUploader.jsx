import { useState, useEffect, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { CameraIcon } from "@heroicons/react/24/outline";

/**
 * Componente para subir y manejar imágenes de perfil,
 * donde el elemento de "value" puede ser un string (imagen vieja) o un File (imagen nueva).
 */
const ProfileImageUploader = ({
  label,
  isMultiple = false,
  maxSizeMB = 2,
  accept = "image/*",
  value = [],  // puede contener string | File
  onChange = () => {},
}) => {
  const [previews, setPreviews] = useState([]);
  const [hovered, setHovered] = useState(false);

  // --------------------------------------------------------------------------------
  // Construir previews mezclando strings y files
  // --------------------------------------------------------------------------------
  useEffect(() => {
    if (!value || value.length === 0) {
      setPreviews([]);
      return;
    }

    let newPreviews = [];
    let filesToProcess = 0;

    value.forEach((item) => {
      if (typeof item === "string") {
        // item es una ruta antigua
        newPreviews.push({ src: item, isFile: false, name: item });
      } else if (item instanceof File) {
        // item es un File nuevo
        filesToProcess++;
      }
    });

    if (filesToProcess === 0) {
      // si no hay archivos nuevos, actualizamos previews ya
      setPreviews(newPreviews);
      return;
    }

    // Procesar los Files con FileReader
    let processed = 0;
    const filePreviews = [];

    value.forEach((item) => {
      if (item instanceof File) {
        const reader = new FileReader();
        reader.onloadend = () => {
          filePreviews.push({
            src: reader.result,
            isFile: true,
            name: item.name,
          });
          processed++;
          if (processed === filesToProcess) {
            // concatenamos los previews de string + file
            setPreviews([...newPreviews, ...filePreviews]);
          }
        };
        reader.readAsDataURL(item);
      }
    });
  }, [value]);

  // --------------------------------------------------------------------------------
  // Lógica para añadir archivos nuevos (drag & drop o input)
  // --------------------------------------------------------------------------------
  const handleFiles = (files) => {
    const validFiles = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Validar tipo
      if (!file.type.startsWith("image/")) {
        alert(`El archivo ${file.name} no es una imagen válida.`);
        continue;
      }
      // Validar tamaño
      const sizeMB = file.size / 1024 / 1024;
      if (sizeMB > maxSizeMB) {
        alert(`El archivo ${file.name} excede los ${maxSizeMB} MB.`);
        continue;
      }
      validFiles.push(file);
    }
    if (validFiles.length === 0) return;

    if (isMultiple) {
      onChange([...value, ...validFiles]); // agregamos los nuevos Files
    } else {
      onChange([validFiles[0]]); // reemplazamos por 1
    }
  };

  // --------------------------------------------------------------------------------
  // DRAG & DROP
  // --------------------------------------------------------------------------------
  const onDrop = useCallback(
    (acceptedFiles) => {
      handleFiles(acceptedFiles);
    },
    [value, isMultiple]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: isMultiple,
    accept,
  });

  // Si hay una imagen (previa o nueva), mostrarla con un overlay para cambiarla
  if (previews.length > 0) {
    return (
      <div className="mb-4">
        {label && (
          <label className="block text-gray-700 font-semibold mb-1">
            {label}
          </label>
        )}
        
        <div 
          className="relative w-24 h-24 mx-auto"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <img
            src={previews[0].src}
            alt="Foto de perfil"
            className="w-24 h-24 object-cover rounded-full border-2 border-coral/50 shadow-md"
          />
          
          <div 
            {...getRootProps()}
            className={`absolute inset-0 rounded-full flex flex-col items-center justify-center transition-all duration-200 cursor-pointer ${
              hovered || isDragActive ? 'bg-black bg-opacity-50' : 'bg-transparent'
            }`}
          >
            <input {...getInputProps()} />
            
            {isDragActive ? (
              <p className="text-white text-xs text-center">
                Suelta aquí...
              </p>
            ) : hovered && (
              <>
                <CameraIcon className="w-6 h-6 text-white mb-1" />
                <p className="text-white text-xs text-center">
                  Cambiar
                </p>
              </>
            )}
          </div>
        </div>
        
        <p className="text-xs text-gray-500 text-center mt-2">
          Haz clic para cambiar
        </p>
      </div>
    );
  }

  // Si no hay imagen, mostrar el dropzone regular
  return (
    <div className="mb-4">
      {label && (
        <label className="block text-gray-700 font-semibold mb-1">
          {label}
        </label>
      )}

      {/* Contenedor de drag & drop estilizado como círculo para coherencia */}
      <div
        {...getRootProps()}
        className={`p-4 w-24 h-24 mx-auto rounded-full border-2 border-dashed cursor-pointer flex flex-col items-center justify-center ${
          isDragActive ? "border-coral bg-coral/10" : "border-gray-300"
        }`}
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <p className="text-coral text-xs text-center">Suelta aquí...</p>
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-600">
            <CameraIcon className="mb-1 w-6 h-6 text-coral" />
            <p className="text-xs text-center">
              Añadir foto
            </p>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-500 text-center mt-2">
        (Máx. {maxSizeMB}MB)
      </p>
    </div>
  );
};

export default ProfileImageUploader;
