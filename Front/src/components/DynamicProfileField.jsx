import React from 'react';

const DynamicProfileField = ({ field, value, onChange, className = '' }) => {
  const handleChange = (e) => {
    const newValue = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    onChange(field.key, newValue);
  };

  const renderField = () => {
    const baseClassName = `mt-1 block w-full border-gray-300 rounded-md shadow-sm ${className}`;

    switch (field.type) {
      case 'text':
      case 'email':
      case 'phone':
        return (
          <input
            type={field.type}
            id={field.key}
            value={value || ''}
            onChange={handleChange}
            placeholder={field.placeholder}
            className={baseClassName}
          />
        );

      case 'textarea':
        return (
          <textarea
            id={field.key}
            value={value || ''}
            onChange={handleChange}
            placeholder={field.placeholder}
            rows={3}
            className={baseClassName}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            id={field.key}
            value={value || ''}
            onChange={handleChange}
            placeholder={field.placeholder}
            className={baseClassName}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            id={field.key}
            value={value || ''}
            onChange={handleChange}
            className={baseClassName}
          />
        );

      case 'select':
        return (
          <select
            id={field.key}
            value={value || ''}
            onChange={handleChange}
            className={baseClassName}
          >
            <option value="">Selecciona una opción</option>
            {field.options?.map((option, index) => (
              <option key={index} value={typeof option === 'string' ? option : option.value}>
                {typeof option === 'string' ? option : option.label}
              </option>
            ))}
          </select>
        );

      case 'radio':
        return (
          <div className="space-y-2">
            {field.options?.map((option, index) => {
              const optionValue = typeof option === 'string' ? option : option.value;
              const optionLabel = typeof option === 'string' ? option : option.label;
              return (
                <label key={index} className="inline-flex items-center mr-4">
                  <input
                    type="radio"
                    name={field.key}
                    value={optionValue}
                    checked={value === optionValue}
                    onChange={handleChange}
                    className="form-radio h-4 w-4 text-coral"
                  />
                  <span className="ml-2">{optionLabel}</span>
                </label>
              );
            })}
          </div>
        );

      case 'checkbox':
        return (
          <div className="space-y-2">
            {field.options?.map((option, index) => {
              const optionValue = typeof option === 'string' ? option : option.value;
              const optionLabel = typeof option === 'string' ? option : option.label;
              const isChecked = Array.isArray(value) ? value.includes(optionValue) : false;
              return (
                <label key={index} className="inline-flex items-center mr-4">
                  <input
                    type="checkbox"
                    value={optionValue}
                    checked={isChecked}
                    onChange={(e) => {
                      let newValue = Array.isArray(value) ? [...value] : [];
                      if (e.target.checked) {
                        newValue.push(optionValue);
                      } else {
                        newValue = newValue.filter(v => v !== optionValue);
                      }
                      onChange(field.key, newValue);
                    }}
                    className="form-checkbox h-4 w-4 text-coral"
                  />
                  <span className="ml-2">{optionLabel}</span>
                </label>
              );
            })}
          </div>
        );

      case 'boolean':
        return (
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              checked={value === true || value === 'true'}
              onChange={(e) => onChange(field.key, e.target.checked)}
              className="form-checkbox h-4 w-4 text-coral"
            />
            <span className="ml-2">{field.placeholder || 'Sí'}</span>
          </label>
        );

      default:
        return (
          <input
            type="text"
            id={field.key}
            value={value || ''}
            onChange={handleChange}
            placeholder={field.placeholder}
            className={baseClassName}
          />
        );
    }
  };

  return (
    <div>
      <label htmlFor={field.key} className="block text-sm font-medium text-gray-700">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {renderField()}
      {field.description && (
        <p className="mt-1 text-xs text-gray-500">{field.description}</p>
      )}
    </div>
  );
};

export default DynamicProfileField;
