import React, { useState } from 'react';
import { clsx } from 'clsx';

export interface ColorPickerProps {
  color?: string;
  value?: string; // alias for color
  onChange: (color: string) => void;
  label?: string;
  presetColors?: string[];
  className?: string;
  /**
   * Use simple HTML color input instead of advanced picker
   * 
   * When true, renders a native HTML color input for simple color selection.
   * When false (default), renders an advanced color picker with preset colors and custom input.
   */
  simple?: boolean;
}

const defaultPresetColors = [
  '#00ccff', // primary
  '#ff3366', // secondary
  '#ff9900', // accent
  '#55ff55', // success
  '#ff5555', // error
  '#ffffff', // white
  '#9900ff', // purple
  '#00ff99', // teal
];

export const ColorPicker: React.FC<ColorPickerProps> = ({
  color,
  value,
  onChange,
  label = 'カラー',
  presetColors = defaultPresetColors,
  className = '',
  simple = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const currentColor = color || value || '#ffffff';

  const togglePicker = () => {
    setIsOpen(!isOpen);
  };

  const handlePresetClick = (presetColor: string) => {
    onChange(presetColor);
  };

  const handleColorInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  // Simple version - just HTML color input
  if (simple) {
    return (
      <div className={clsx('relative', className)}>
        {label && <span className="text-sm text-gray-300 mb-1 block">{label}</span>}
        <div className="flex items-center space-x-2">
          <input
            type="color"
            value={currentColor}
            onChange={handleColorInputChange}
            className="w-8 h-8 rounded-full border border-gray-600 cursor-pointer"
          />
          <input
            type="text"
            value={currentColor}
            onChange={handleColorInputChange}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 w-24 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>
    );
  }

  // Advanced version with preset colors
  return (
    <div className={clsx('relative', className)}>
      {label && <span className="text-sm text-gray-300 mb-1 block">{label}</span>}
      
      <div className="flex items-center space-x-2">
        <button
          type="button"
          className="w-8 h-8 rounded-full border border-gray-600 flex-shrink-0 cursor-pointer transition-transform hover:scale-105"
          style={{ backgroundColor: currentColor }}
          onClick={togglePicker}
          aria-label="カラーを選択"
        />
        
        <input
          type="text"
          value={currentColor}
          onChange={handleColorInputChange}
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 w-24 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          <div className="absolute z-50 mt-2 p-3 bg-gray-800 border border-gray-700 rounded-lg shadow-lg">
            <input
              type="color"
              value={currentColor}
              onChange={handleColorInputChange}
              className="w-full h-32 border border-gray-600 rounded"
            />
            
            <div className="mt-3 grid grid-cols-8 gap-2">
              {presetColors.map((presetColor) => (
                <button
                  key={presetColor}
                  type="button"
                  className="w-6 h-6 rounded-full border border-gray-600 cursor-pointer transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ backgroundColor: presetColor }}
                  onClick={() => handlePresetClick(presetColor)}
                  aria-label={`カラーを選択: ${presetColor}`}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Default export for backward compatibility
export default ColorPicker;