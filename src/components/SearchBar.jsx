import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, X } from 'lucide-react';

export default function SearchBar({ onSearch, resultCount }) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => onSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, onSearch]);

  return (
    <motion.div
      className="relative mb-4"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your notes..."
        className="w-full pl-9 pr-20 py-2.5 rounded-xl bg-gray-50/80 dark:bg-white/5
                   border border-gray-200/80 dark:border-white/10
                   text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500
                   focus:outline-none focus:ring-2 focus:ring-indigo-400/50 dark:focus:ring-indigo-500/50
                   focus:border-indigo-400 dark:focus:border-indigo-500
                   backdrop-blur-sm transition-all text-sm shadow-sm"
      />
      {query && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <span className="text-xs text-gray-400">{resultCount} found</span>
          <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        </div>
      )}
    </motion.div>
  );
}
