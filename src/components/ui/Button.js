"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const Button = ({ children, variant = 'primary', size = 'md', icon, fullWidth = false, isActive = false, className, ...props }) => {
    const baseClasses = 'inline-flex items-center justify-center font-medium transition-all duration-200 ease-in-out rounded-full focus:outline-none';
    const variantClasses = {
        primary: 'bg-v1z3r-primary text-black hover:bg-opacity-80',
        secondary: 'bg-v1z3r-secondary text-white hover:bg-opacity-80',
        outline: 'border border-v1z3r-primary text-v1z3r-primary hover:bg-v1z3r-primary hover:bg-opacity-10',
        ghost: 'text-v1z3r-light hover:bg-v1z3r-primary hover:bg-opacity-10'
    };
    const sizeClasses = {
        sm: 'px-3 py-1 text-sm',
        md: 'px-4 py-2',
        lg: 'px-6 py-3 text-lg'
    };
    const activeClasses = isActive
        ? 'ring-2 ring-v1z3r-primary ring-opacity-50'
        : '';
    const widthClass = fullWidth ? 'w-full' : '';
    const buttonClasses = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${activeClasses} ${widthClass} ${className || ''}`;
    // Framer Motionのmotion.buttonを使用する代わりに、通常のbuttonを使用
    return ((0, jsx_runtime_1.jsxs)("button", { className: buttonClasses, ...props, children: [icon && (0, jsx_runtime_1.jsx)("span", { className: "mr-2", children: icon }), children] }));
};
exports.default = Button;
