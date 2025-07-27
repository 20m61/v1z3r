/**
 * UI component type definitions
 */

import { ButtonHTMLAttributes, ReactNode } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  fullWidth?: boolean;
  isActive?: boolean;
}

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

export interface ColorPickerProps {
  color?: string;
  value?: string; // alias for color
  onChange: (color: string) => void;
  label?: string;
  presetColors?: string[];
  className?: string;
  simple?: boolean;
}