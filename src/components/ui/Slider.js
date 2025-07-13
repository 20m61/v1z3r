"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const Slider = ({ min = 0, max = 100, step = 1, value, onChange, label, showValue = true, valueFormatter = (val) => val.toString(), className = '', color = '#00ccff' }) => {
    const [localValue, setLocalValue] = (0, react_1.useState)(value);
    (0, react_1.useEffect)(() => {
        setLocalValue(value);
    }, [value]);
    const handleChange = (e) => {
        const newValue = parseFloat(e.target.value);
        setLocalValue(newValue);
        onChange(newValue);
    };
    // スライダーの進行状況に基づいた背景スタイルを計算
    const percentage = ((localValue - min) / (max - min)) * 100;
    const backgroundStyle = {
        background: `linear-gradient(to right, ${color} 0%, ${color} ${percentage}%, #333 ${percentage}%, #333 100%)`
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: `w-full ${className}`, children: [(label || showValue) && ((0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between items-center mb-1", children: [label && (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-gray-300", children: label }), showValue && ((0, jsx_runtime_1.jsx)("span", { className: "text-sm font-medium text-v1z3r-primary", children: valueFormatter(localValue) }))] })), (0, jsx_runtime_1.jsx)("input", { type: "range", min: min, max: max, step: step, value: localValue, onChange: handleChange, className: "w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer", style: backgroundStyle })] }));
};
exports.default = Slider;
