// Named exports for JSX components
export { Button, type ButtonProps } from './components/Button';
export { Slider, type SliderProps } from './components/Slider';
export { ColorPicker, type ColorPickerProps } from './components/ColorPicker';

// Default exports for backward compatibility
export { default as ButtonDefault } from './components/Button';
export { default as SliderDefault } from './components/Slider';
export { default as ColorPickerDefault } from './components/ColorPicker';

// Main default export (Button as primary component)
export { default } from './components/Button';