import React, { useState, useEffect, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { TrashIcon, PlusIcon } from "@heroicons/react/24/outline";

/**
 * Componente para subir y manejar un array de imágenes,
 * donde cada elemento de "value" puede ser un string (imagen vieja) o un File (imagen nueva).
 */
const ImageUploader = ({
  label,
  isMultiple = false,
  maxSizeMB = 2,
  accept = "image/*",
  value = [],  // puede contener string | File
  onChange = () => {},
}) => {
  const [previews, setPreviews] = useState([]);

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
  // Eliminar un elemento del array (sea string o File)
  // --------------------------------------------------------------------------------
  const handleRemove = (index) => {
    const newValue = [...value];
    newValue.splice(index, 1);
    onChange(newValue);
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

  return (
    <div className="mb-4">
      {label && (
        <label className="block text-gray-700 font-semibold mb-1">
          {label}
        </label>
      )}

      {/* Contenedor de drag & drop */}
      <div
        {...getRootProps()}
        className={`p-4 w-full border-2 border-dashed rounded cursor-pointer ${
          isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300"
        }`}
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <p className="text-blue-600 text-center">Suelta los archivos aquí...</p>
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-600">
            <PlusIcon className="mb-2 w-5 h-5" />
            <p className="text-sm">
              Arrastra y suelta{" "}
              {isMultiple ? "imágenes" : "una imagen"}, o haz clic para
              seleccionarlas.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              (Máximo {maxSizeMB}MB por imagen)
            </p>
          </div>
        )}
      </div>

      {/* Previews */}
      {previews.length > 0 && (
        <div className="flex flex-wrap gap-4 mt-3">
          {previews.map((item, index) => (
            <div key={index} className="relative w-32 h-32">
              {/* item.src puede ser dataURL (si isFile) o la ruta string */}
              <img
                src={item.src}
                alt={item.name}
                className="w-32 h-32 object-cover rounded border border-gray-200"
              />
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
