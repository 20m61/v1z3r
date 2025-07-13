"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_colorful_1 = require("react-colorful");
const framer_motion_1 = require("framer-motion");
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
const ColorPicker = ({ color, onChange, label = 'カラー', presetColors = defaultPresetColors, }) => {
    const [isOpen, setIsOpen] = (0, react_1.useState)(false);
    const togglePicker = () => {
        setIsOpen(!isOpen);
    };
    const handlePresetClick = (presetColor) => {
        onChange(presetColor);
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "relative", children: [label && (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-gray-300 mb-1 block", children: label }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", className: "w-8 h-8 rounded-full border border-gray-600 flex-shrink-0 cursor-pointer transition-transform hover:scale-105", style: { backgroundColor: color }, onClick: togglePicker, "aria-label": "\u30AB\u30E9\u30FC\u3092\u9078\u629E" }), (0, jsx_runtime_1.jsx)(react_colorful_1.HexColorInput, { color: color, onChange: onChange, prefixed: true, className: "bg-v1z3r-darker border border-gray-700 rounded px-2 py-1 w-24 text-sm focus:outline-none focus:ring-1 focus:ring-v1z3r-primary" })] }), (0, jsx_runtime_1.jsx)(framer_motion_1.AnimatePresence, { children: isOpen && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(framer_motion_1.motion.div, { className: "fixed inset-0 z-40", initial: { opacity: 0 }, animate: { opacity: 0.1 }, exit: { opacity: 0 }, onClick: () => setIsOpen(false) }), (0, jsx_runtime_1.jsxs)(framer_motion_1.motion.div, { className: "absolute z-50 mt-2 p-3 bg-v1z3r-darker border border-gray-700 rounded-lg shadow-lg", initial: { opacity: 0, y: -10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 }, transition: { duration: 0.2 }, children: [(0, jsx_runtime_1.jsx)(react_colorful_1.HexColorPicker, { color: color, onChange: onChange }), (0, jsx_runtime_1.jsx)("div", { className: "mt-3 grid grid-cols-8 gap-2", children: presetColors.map((presetColor) => ((0, jsx_runtime_1.jsx)("button", { type: "button", className: "w-6 h-6 rounded-full border border-gray-600 cursor-pointer transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-v1z3r-primary", style: { backgroundColor: presetColor }, onClick: () => handlePresetClick(presetColor), "aria-label": `カラーを選択: ${presetColor}` }, presetColor))) })] })] })) })] }));
};
exports.default = ColorPicker;
