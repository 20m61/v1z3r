import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';

export interface SliderProps {
  min?: number;
  max?: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  label?: string;
  showValue?: boolean;
  valueFormatter?: (value: number) => string;
  className?: string;
  color?: string;
}

const Slider: React.FC<SliderProps> = ({
  min = 0,
  max = 100,
  step = 1,
  value,
  onChange,
  label,
  showValue = true,
  valueFormatter = (val) => val.toString(),
  className = '',
  color = '#00ccff'
}) => {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    setLocalValue(newValue);
    onChange(newValue);
  };

  // スライダーの進行状況に基づいた背景スタイルを計算
  const percentage = ((localValue - min) / (max - min)) * 100;
  const backgroundStyle = {
    background: `linear-gradient(to right, ${color} 0%, ${color} ${percentage}%, #333 ${percentage}%, #333 100%)`
  };

  return (
    <div className={clsx('w-full', className)}>
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-1">
          {label && <span className="text-sm text-gray-300">{label}</span>}
          {showValue && (
            <span className="text-sm font-medium text-v1z3r-primary">
              {valueFormatter(localValue)}
            </span>
          )}
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={localValue}
        onChange={handleChange}
        className="w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer"
        style={backgroundStyle}
      />
    </div>
  );
};

export default Slider;