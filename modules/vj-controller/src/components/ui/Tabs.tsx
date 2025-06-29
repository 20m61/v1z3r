import React, { useState, ReactNode } from 'react';
import { motion } from 'framer-motion';

interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  defaultTabId?: string;
  onChange?: (tabId: string) => void;
  className?: string;
}

const Tabs: React.FC<TabsProps> = ({
  tabs,
  defaultTabId,
  onChange,
  className = '',
}) => {
  const [activeTabId, setActiveTabId] = useState(defaultTabId || tabs[0]?.id);

  const handleTabClick = (tabId: string) => {
    setActiveTabId(tabId);
    if (onChange) {
      onChange(tabId);
    }
  };

  const activeTab = tabs.find(tab => tab.id === activeTabId);

  return (
    <div className={`w-full ${className}`}>
      <div className="flex overflow-x-auto border-b border-gray-800 mb-4 pb-1 hide-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`flex items-center px-4 py-2 mr-2 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTabId === tab.id
                ? 'text-v1z3r-primary border-b-2 border-v1z3r-primary -mb-[1px]'
                : 'text-gray-400 hover:text-gray-200'
            }`}
            onClick={() => handleTabClick(tab.id)}
            role="tab"
            aria-selected={activeTabId === tab.id}
          >
            {tab.icon && <span className="mr-2">{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="w-full tab-content">
        {activeTab && (
          <motion.div
            key={activeTabId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab.content}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Tabs;
