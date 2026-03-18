import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle({ darkMode, onToggle }) {
  return (
    <motion.button
      onClick={onToggle}
      className="fixed top-4 right-4 z-50 p-3 rounded-full backdrop-blur-md
                 bg-white/20 dark:bg-white/10 border border-white/30 dark:border-white/10
                 shadow-lg hover:shadow-xl transition-shadow"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <motion.div
        initial={false}
        animate={{ rotate: darkMode ? 180 : 0 }}
        transition={{ duration: 0.4, ease: 'easeInOut' }}
      >
        {darkMode
          ? <Sun size={20} className="text-yellow-300" />
          : <Moon size={20} className="text-indigo-600" />
        }
      </motion.div>
    </motion.button>
  );
}
