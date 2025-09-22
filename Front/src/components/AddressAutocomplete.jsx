import React from 'react';
import PlacesAutocomplete, {
  geocodeByAddress,
  getLatLng,
} from 'react-places-autocomplete';
import useGoogleMaps from '@/utils/useGoogleMaps';

const AddressAutocomplete = ({ value, onChange, onSelect, isValid }) => {
  const { loaded, error } = useGoogleMaps(import.meta.env.VITE_GOOGLEMAPS_API_KEY);

  if (error) {
    return <div>Error al cargar Google Maps</div>;
  }

  if (!loaded) {
    return <div>Cargando...</div>;
  }

  const handleSelect = async (address) => {
    onChange(address); // Actualizamos el valor del input
    if (onSelect) {
      try {
        const results = await geocodeByAddress(address);
        const latLng = await getLatLng(results[0]);
        onSelect(latLng); // Confirmamos la selección
      } catch (error) {
        console.error('Error al obtener coordenadas:', error);
      }
    }
  };

  return (
    <PlacesAutocomplete
      value={value}
      onChange={onChange}
      onSelect={handleSelect}
      searchOptions={{ types: ['address'] }}
    >
      {({ getInputProps, suggestions, getSuggestionItemProps, loading }) => (
        <div className="relative">
          <input
            {...getInputProps({
              placeholder: 'Introduce una dirección...',
              className: 'location-search-input',
            })}
            className={`w-full border p-3 rounded-lg shadow-sm focus:outline-none ${
              isValid
                ? 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                : 'border-red-500 focus:ring-red-500 focus:border-red-500'
            }`}
          />
          <div className="absolute mt-2 w-full bg-white shadow-lg rounded-lg z-50">
            {loading && <div className="p-3 text-gray-500">Cargando...</div>}
            {suggestions.map((suggestion) => {
              const className = suggestion.active
                ? 'bg-gray-100 cursor-pointer'
                : 'bg-white cursor-pointer';
              return (
                <div
                  {...getSuggestionItemProps(suggestion, {
                    className: `p-3 border-b last:border-none text-sm text-gray-700 hover:bg-gray-200 ${className}`,
                  })}
                  key={suggestion.placeId}
                >
                  {suggestion.description}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </PlacesAutocomplete>
  );
};

export default AddressAutocomplete;
