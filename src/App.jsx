import { useState, useEffect } from 'react';
import AnimatedBackground from './components/AnimatedBackground';
import ThemeToggle from './components/ThemeToggle';
import UserMenu from './components/UserMenu';
import VoiceNoteMaker from './VoiceNoteMaker';
import { useAuth } from './hooks/useAuth';
import { useNotes } from './hooks/useNotes';

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const { user, loading, authError, login, logout } = useAuth();
  const { notes, addNote, removeNote, synced } = useNotes(user);

  return (
    <div className="relative min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-500">
      <AnimatedBackground darkMode={darkMode} />
      <div className="relative z-10">
        <UserMenu
          user={user}
          loading={loading}
          authError={authError}
          synced={synced}
          onLogin={login}
          onLogout={logout}
        />
        <ThemeToggle darkMode={darkMode} onToggle={() => setDarkMode(d => !d)} />
        <VoiceNoteMaker
          darkMode={darkMode}
          user={user}
          synced={synced}
          notes={notes}
          addNote={addNote}
          removeNote={removeNote}
        />
      </div>
    </div>
  );
}
