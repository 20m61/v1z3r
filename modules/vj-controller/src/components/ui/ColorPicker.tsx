import React, { useState } from 'react';
import { HexColorPicker, HexColorInput } from 'react-colorful';
import { motion, AnimatePresence } from 'framer-motion';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  label?: string;
  presetColors?: string[];
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

const ColorPicker: React.FC<ColorPickerProps> = ({
  color,
  onChange,
  label = 'カラー',
  presetColors = defaultPresetColors,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const togglePicker = () => {
    setIsOpen(!isOpen);
  };

  const handlePresetClick = (presetColor: string) => {
    onChange(presetColor);
  };

  return (
    <div className="relative">
      {label && <span className="text-sm text-gray-300 mb-1 block">{label}</span>}
      
      <div className="flex items-center space-x-2">
        <button
          type="button"
          className="w-8 h-8 rounded-full border border-gray-600 flex-shrink-0 cursor-pointer transition-transform hover:scale-105"
          style={{ backgroundColor: color }}
          onClick={togglePicker}
          aria-label="カラーを選択"
        />
        
        <HexColorInput
          color={color}
          onChange={onChange}
          prefixed
          className="bg-v1z3r-darker border border-gray-700 rounded px-2 py-1 w-24 text-sm focus:outline-none focus:ring-1 focus:ring-v1z3r-primary"
        />
      </div>
      
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            />
            
            <motion.div
              className="absolute z-50 mt-2 p-3 bg-v1z3r-darker border border-gray-700 rounded-lg shadow-lg"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <HexColorPicker color={color} onChange={onChange} />
              
              <div className="mt-3 grid grid-cols-8 gap-2">
                {presetColors.map((presetColor) => (
                  <button
                    key={presetColor}
                    type="button"
                    className="w-6 h-6 rounded-full border border-gray-600 cursor-pointer transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-v1z3r-primary"
                    style={{ backgroundColor: presetColor }}
                    onClick={() => handlePresetClick(presetColor)}
                    aria-label={`カラーを選択: ${presetColor}`}
                  />
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ColorPicker;
