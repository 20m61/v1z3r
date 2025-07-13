import React from 'react';
interface SliderProps {
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
declare const Slider: React.FC<SliderProps>;
export default Slider;
