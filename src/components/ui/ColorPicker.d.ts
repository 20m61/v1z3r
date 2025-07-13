import React from 'react';
interface ColorPickerProps {
    color: string;
    onChange: (color: string) => void;
    label?: string;
    presetColors?: string[];
}
declare const ColorPicker: React.FC<ColorPickerProps>;
export default ColorPicker;
