/**
 * UI component interfaces for lyrics-engine
 * These components will be provided by the main app
 */

import React from 'react';
import { ButtonProps, SliderProps, ColorPickerProps } from '../../types';

// Component registrations
let ButtonComponent: React.FC<ButtonProps> | null = null;
let SliderComponent: React.FC<SliderProps> | null = null;
let ColorPickerComponent: React.FC<ColorPickerProps> | null = null;

export function registerUIComponents(components: {
  Button: React.FC<ButtonProps>;
  Slider: React.FC<SliderProps>;
  ColorPicker: React.FC<ColorPickerProps>;
}) {
  ButtonComponent = components.Button;
  SliderComponent = components.Slider;
  ColorPickerComponent = components.ColorPicker;
}

// Default fallback components
const DefaultButton: React.FC<ButtonProps> = ({ children, onClick, className = '' }) => (
  <button onClick={onClick} className={className}>
    {children}
  </button>
);

const DefaultSlider: React.FC<SliderProps> = ({ value, onChange, min = 0, max = 100, className = '' }) => (
  <input
    type="range"
    value={value}
    onChange={(e) => onChange(Number(e.target.value))}
    min={min}
    max={max}
    className={className}
  />
);

const DefaultColorPicker: React.FC<ColorPickerProps> = ({ value, color, onChange, className = '' }) => (
  <input
    type="color"
    value={value || color || '#ffffff'}
    onChange={(e) => onChange(e.target.value)}
    className={className}
  />
);

// Export components that use registered or default versions
export const Button: React.FC<ButtonProps> = (props) => {
  const Component = ButtonComponent || DefaultButton;
  return <Component {...props} />;
};

export const Slider: React.FC<SliderProps> = (props) => {
  const Component = SliderComponent || DefaultSlider;
  return <Component {...props} />;
};

export const ColorPicker: React.FC<ColorPickerProps> = (props) => {
  const Component = ColorPickerComponent || DefaultColorPicker;
  return <Component {...props} />;
};