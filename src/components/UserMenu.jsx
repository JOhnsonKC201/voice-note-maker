import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, LogOut, Cloud, CloudOff } from 'lucide-react';

export default function UserMenu({ user, loading, authError, synced, onLogin, onLogout }) {
  const [open, setOpen] = useState(false);

  if (loading) {
    return (
      <div className="fixed top-4 right-16 z-50 w-8 h-8 rounded-full bg-white/20 animate-pulse" />
    );
  }

  if (!user) {
    return (
      <div className="fixed top-4 right-16 z-50">
        <motion.button
          onClick={onLogin}
          className="flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md
                     bg-white/20 dark:bg-white/10 border border-white/30 dark:border-white/10
                     shadow-lg text-sm font-medium text-gray-800 dark:text-gray-200
                     hover:bg-white/30 dark:hover:bg-white/15 transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <LogIn size={16} />
          <span className="hidden sm:inline">Sign in with Google</span>
          <span className="sm:hidden">Sign in</span>
        </motion.button>

        <AnimatePresence>
          {authError && (
            <motion.div
              className="absolute right-0 mt-2 w-72 p-3 rounded-xl backdrop-blur-xl
                         bg-red-50/90 dark:bg-red-950/90 border border-red-200 dark:border-red-800
                         shadow-xl text-sm text-red-700 dark:text-red-300"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {authError}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-16 z-50">
      <motion.button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-full backdrop-blur-md
                   bg-white/20 dark:bg-white/10 border border-white/30 dark:border-white/10
                   shadow-lg hover:bg-white/30 dark:hover:bg-white/15 transition-colors"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {user.photoURL ? (
          <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">
            {user.displayName?.[0] || '?'}
          </div>
        )}
        <span className="hidden sm:inline text-sm font-medium text-gray-800 dark:text-gray-200 pr-1">
          {user.displayName?.split(' ')[0]}
        </span>
        {synced ? (
          <Cloud size={14} className="text-green-500" />
        ) : (
          <CloudOff size={14} className="text-gray-400" />
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute right-0 mt-2 w-64 rounded-xl backdrop-blur-xl overflow-hidden
                       bg-white/90 dark:bg-gray-900/90 border border-white/30 dark:border-white/10
                       shadow-xl"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            <div className="p-3 border-b border-gray-200 dark:border-white/10">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{user.displayName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                {synced ? (
                  <>
                    <Cloud size={12} className="text-green-500" />
                    <span className="text-xs text-green-600 dark:text-green-400">Synced across devices</span>
                  </>
                ) : (
                  <>
                    <CloudOff size={12} className="text-gray-400" />
                    <span className="text-xs text-gray-500">Saved locally</span>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={() => { setOpen(false); onLogout(); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-600 dark:text-red-400
                         hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              <LogOut size={16} /> Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
