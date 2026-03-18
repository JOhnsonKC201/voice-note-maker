import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Pause, Play, RotateCcw, AlertCircle, Download, Trash2, ChevronDown, FileText, Search as SearchIcon } from 'lucide-react';
import AudioWaveform from './components/AudioWaveform';
import SearchBar from './components/SearchBar';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3003/api';
// Glass card style
const glass = `backdrop-blur-xl bg-white/80 dark:bg-white/[0.08] border border-white/60 dark:border-white/[0.08]
               rounded-2xl shadow-[0_8px_40px_rgba(99,102,241,0.08),0_2px_8px_rgba(0,0,0,0.04)]
               dark:shadow-[0_8px_40px_rgba(0,0,0,0.4)]`;

// Animations
const fadeInUp = {
  initial: { opacity: 0, y: 24, filter: 'blur(8px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  transition: { duration: 0.5, ease: 'easeOut' }
};

// Markdown renderer
function renderMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold text-gray-800 dark:text-gray-200 mt-4 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-indigo-700 dark:text-indigo-400 mt-6 mb-2 pb-1 border-b border-indigo-100 dark:border-indigo-900">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-gray-900 dark:text-white mb-3">$1</h1>')
    .replace(/^- \[ \] (.+)$/gm, '<div class="flex items-start gap-2 ml-2 my-1"><input type="checkbox" class="mt-1 accent-indigo-600" /><span class="text-gray-700 dark:text-gray-300">$1</span></div>')
    .replace(/^- \[x\] (.+)$/gm, '<div class="flex items-start gap-2 ml-2 my-1"><input type="checkbox" checked class="mt-1 accent-indigo-600" /><span class="text-gray-500 line-through">$1</span></div>')
    .replace(/^- (.+)$/gm, '<div class="flex items-start gap-2 ml-2 my-1"><span class="text-indigo-400 mt-0.5">&#8226;</span><span class="text-gray-700 dark:text-gray-300">$1</span></div>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-gray-900 dark:text-white font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n\n/g, '<div class="my-3"></div>')
    .replace(/\n/g, '<br />');
}

// Pulsing rings
function RecordingPulse() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute w-20 h-20 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(239,68,68,0.3) 0%, transparent 70%)',
          }}
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 3, opacity: 0 }}
          transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.7, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

// Sparkle effect on note generation
function Sparkles() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full bg-indigo-400"
          style={{
            left: `${20 + Math.random() * 60}%`,
            top: `${10 + Math.random() * 30}%`,
          }}
          initial={{ opacity: 1, scale: 1, y: 0 }}
          animate={{
            opacity: 0,
            scale: 0,
            y: -40 - Math.random() * 60,
            x: (Math.random() - 0.5) * 80,
          }}
          transition={{ duration: 0.8 + Math.random() * 0.5, delay: Math.random() * 0.3, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

// PDF/Print export — works on desktop and mobile
function exportPdf(noteHtml, date) {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const styledHtml = `<!DOCTYPE html><html><head><title>Lecture Note</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { font-family: Georgia, serif; max-width: 700px; margin: 40px auto; padding: 20px; color: #1a1a1a; line-height: 1.7; }
      h1 { font-size: 24px; border-bottom: 2px solid #4f46e5; padding-bottom: 8px; }
      h2 { font-size: 18px; color: #4f46e5; margin-top: 24px; }
      h3 { font-size: 16px; margin-top: 16px; }
      strong { color: #111; }
      .meta { color: #666; font-size: 13px; margin-bottom: 20px; }
      @media print { body { margin: 20px; } }
    </style>
  </head><body>
    <div class="meta">${date || new Date().toLocaleString()}</div>
    ${noteHtml}
  </body></html>`;

  if (isMobile) {
    // On mobile, open in a new tab so user can use browser's share/print/save-as-PDF
    const blob = new Blob([styledHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } else {
    // On desktop, use iframe print (triggers Save as PDF dialog)
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    doc.open();
    doc.write(styledHtml);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 250);
  }
}

class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className={`${glass} p-6 max-w-md`}>
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="text-red-500" size={24} />
              <h1 className="text-xl font-bold text-red-500">Something went wrong</h1>
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-4">{this.state.error?.message}</p>
            <button onClick={() => window.location.reload()} className="w-full bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition">
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function VoiceNoteMaker({ darkMode, user, synced, notes: savedNotes, addNote, removeNote }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [note, setNote] = useState(null);
  const [showSparkles, setShowSparkles] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [expandedNote, setExpandedNote] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [audioStream, setAudioStream] = useState(null);

  const timerRef = useRef(null);
  const recognitionRef = useRef(null);
  const recordingStateRef = useRef({ isRecording: false, isPaused: false });

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRecording, isPaused]);

  const filteredNotes = searchQuery
    ? savedNotes.filter(n =>
        n.transcript.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.note.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.date.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : savedNotes;

  const deleteNote = useCallback((id) => {
    removeNote(id);
    setExpandedNote(prev => prev === id ? null : prev);
  }, [removeNote]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setSeconds(0);
      setTranscript('');
      setNote(null);
      setShowSparkles(false);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        const isMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        setError(
          isMobile
            ? 'Safari doesn\'t support speech recognition. Please use Chrome on Android, or Chrome/Edge on desktop.'
            : 'Your browser doesn\'t support speech recognition. Try Chrome or Edge.'
        );
        stream.getTracks().forEach(t => t.stop());
        setAudioStream(null);
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.language = 'en-US';

      recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            setTranscript(prev => prev + event.results[i][0].transcript + ' ');
          }
        }
      };

      recognition.onerror = (event) => {
        // "aborted" on mobile is usually a temporary interruption, not a real error
        if (event.error === 'aborted') return;
        if (event.error === 'no-speech') return; // silence is not an error
        setError(`Mic error: ${event.error}. Make sure your microphone is connected.`);
      };

      // On mobile, speech recognition can stop unexpectedly. Auto-restart it.
      recognition.onend = () => {
        const state = recordingStateRef.current;
        if (state.isRecording && !state.isPaused) {
          try { recognition.start(); } catch {}
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
      recordingStateRef.current = { isRecording: true, isPaused: false };
    } catch (err) {
      setError(`Couldn't access microphone: ${err.message}`);
    }
  }, []);

  const pauseRecording = useCallback(() => {
    recordingStateRef.current.isPaused = true;
    recognitionRef.current?.stop();
    setIsPaused(true);
  }, []);

  const resumeRecording = useCallback(() => {
    recordingStateRef.current.isPaused = false;
    recognitionRef.current?.start();
    setIsPaused(false);
  }, []);

  const restartRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setTranscript('');
    setSeconds(0);
    setIsPaused(false);
    setTimeout(() => recognitionRef.current?.start(), 100);
  }, []);

  const stopRecording = useCallback(() => {
    recordingStateRef.current = { isRecording: false, isPaused: false };
    recognitionRef.current?.stop();
    setIsRecording(false);
    setIsPaused(false);
    if (audioStream) {
      audioStream.getTracks().forEach(t => t.stop());
      setAudioStream(null);
    }
    if (transcript.trim()) generateNote(transcript);
  }, [transcript, audioStream]);

  const generateNote = useCallback(async (text) => {
    setIsProcessing(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/generate-enriched-note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: text,
          recordingTitle: `Lecture - ${new Date().toLocaleString()}`
        })
      });

      const data = await res.json();
      if (data.success) {
        setNote(data.enrichedNote);
        setShowSparkles(true);
        setTimeout(() => setShowSparkles(false), 1500);
        addNote({
          id: Date.now(),
          date: new Date().toLocaleString(),
          transcript: text,
          note: data.enrichedNote,
          duration: seconds
        });
      } else {
        setError(data.error || 'Something went wrong generating your note.');
      }
    } catch {
      setError(`Can't reach the server. Is it running? (npm run dev:ai)`);
    } finally {
      setIsProcessing(false);
    }
  }, [seconds, addNote]);

  const downloadNote = useCallback((noteText, date) => {
    const content = `Lecture Note\n${date || new Date().toLocaleString()}\n\n${noteText}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lecture-note-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <ErrorBoundary>
      <div className="max-w-4xl mx-auto p-4 sm:p-8 pt-16">

        {/* Header */}
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <motion.h1
            className="text-4xl sm:text-5xl font-extrabold mb-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 dark:from-indigo-400 dark:via-purple-400 dark:to-blue-400 bg-clip-text text-transparent"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Lecture Note Maker
          </motion.h1>
          <motion.p
            className="text-gray-700 dark:text-gray-300 text-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Record your lecture, AI turns it into study notes
          </motion.p>
          <motion.p
            className="text-sm text-gray-500 dark:text-gray-400 mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {user && synced
              ? 'Signed in — notes synced across your devices'
              : 'All notes saved on your device — sign in to sync'}
          </motion.p>
        </motion.div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              className={`${glass} p-4 mb-6 flex gap-3 border-red-200 dark:border-red-900/30`}
              initial={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
              transition={{ duration: 0.3 }}
            >
              <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
              <div>
                <h3 className="font-semibold text-red-600 dark:text-red-400">Oops</h3>
                <p className="text-red-600 dark:text-red-300 text-sm">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Record */}
        <motion.div className={`${glass} p-6 sm:p-8 mb-6 relative overflow-hidden`} {...fadeInUp}>
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-t-2xl" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
              <Mic size={16} className="text-white" />
            </div>
            Record Your Lecture
          </h2>
          <div className="text-center">
            <motion.div
              className={`text-5xl font-mono font-bold mb-6 py-3 px-6 rounded-xl inline-block ${
                isRecording
                  ? 'text-red-500 dark:text-red-400 bg-red-50/50 dark:bg-red-950/20'
                  : 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20'
              }`}
              key={seconds}
              animate={isRecording ? { textShadow: ['0 0 10px rgba(239,68,68,0)', '0 0 20px rgba(239,68,68,0.3)', '0 0 10px rgba(239,68,68,0)'] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              {formatTime(seconds)}
            </motion.div>

            <div className="relative inline-block">
              {isRecording && !isPaused && <RecordingPulse />}
              <AnimatePresence mode="wait">
                {!isRecording ? (
                  <motion.button
                    key="start"
                    onClick={startRecording}
                    className="relative bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700
                               text-white font-bold py-4 px-10 rounded-2xl flex items-center justify-center gap-3
                               shadow-[0_4px_20px_rgba(239,68,68,0.25)] hover:shadow-[0_4px_40px_rgba(239,68,68,0.4)] transition-shadow
                               ring-2 ring-red-200 dark:ring-red-900/40 ring-offset-2 ring-offset-white/80 dark:ring-offset-gray-900/80"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                  >
                    <Mic size={24} /> Start Recording
                  </motion.button>
                ) : (
                  <motion.div
                    key="controls"
                    className="flex items-center gap-3"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                  >
                    {/* Pause / Resume */}
                    <motion.button
                      onClick={isPaused ? resumeRecording : pauseRecording}
                      className={`relative font-bold py-3 px-5 rounded-2xl flex items-center justify-center gap-2
                                 text-white shadow-lg transition-shadow ${
                                   isPaused
                                     ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:shadow-[0_0_20px_rgba(34,197,94,0.3)]'
                                     : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:shadow-[0_0_20px_rgba(245,158,11,0.3)]'
                                 }`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {isPaused ? <><Play size={18} /> Resume</> : <><Pause size={18} /> Pause</>}
                    </motion.button>

                    {/* Stop (center, bigger, red) */}
                    <motion.button
                      onClick={stopRecording}
                      className="relative bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700
                                 hover:shadow-[0_0_30px_rgba(239,68,68,0.3)]
                                 text-white font-bold py-4 px-10 rounded-2xl flex items-center justify-center gap-3
                                 shadow-lg transition-shadow"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Square size={24} /> Stop
                    </motion.button>

                    {/* Restart */}
                    <motion.button
                      onClick={restartRecording}
                      className="relative bg-gradient-to-r from-indigo-500 to-purple-600
                                 hover:shadow-[0_0_20px_rgba(99,102,241,0.3)]
                                 text-white font-bold py-3 px-5 rounded-2xl flex items-center justify-center gap-2
                                 shadow-lg transition-shadow"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <RotateCcw size={18} /> Restart
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Waveform */}
            <AnimatePresence>
              {isRecording && !isPaused && audioStream && (
                <AudioWaveform stream={audioStream} darkMode={darkMode} />
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {transcript && (
              <motion.div
                className="mt-6 p-4 rounded-xl bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2 text-sm">What you said:</h3>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{transcript}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Processing */}
        <AnimatePresence>
          {transcript && !note && (
            <motion.div className={`${glass} p-6 sm:p-8 mb-6`} {...fadeInUp}>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Turn It Into Notes</h2>
              {isProcessing ? (
                <div className="flex flex-col items-center justify-center gap-4 py-10">
                  <div className="relative">
                    <motion.div
                      className="w-14 h-14 rounded-full border-4 border-indigo-200 dark:border-indigo-900 border-t-indigo-600 dark:border-t-indigo-400"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                    <motion.div
                      className="absolute inset-2 rounded-full border-4 border-purple-200 dark:border-purple-900 border-b-purple-600 dark:border-b-purple-400"
                      animate={{ rotate: -360 }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    />
                  </div>
                  <motion.p
                    className="text-gray-600 dark:text-gray-400"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    AI is writing your notes...
                  </motion.p>
                </div>
              ) : (
                <motion.button
                  onClick={() => generateNote(transcript)}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700
                             text-white font-bold py-3 px-8 rounded-xl shadow-lg
                             hover:shadow-[0_0_25px_rgba(99,102,241,0.3)] transition-shadow"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Generate Note
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Generated Note */}
        <AnimatePresence>
          {note && (
            <motion.div
              className={`${glass} p-6 sm:p-8 mb-6 relative overflow-hidden`}
              initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            >
              {showSparkles && <Sparkles />}

              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Your Lecture Notes</h2>
                <div className="flex gap-2">
                  <motion.button
                    onClick={() => exportPdf(renderMarkdown(note))}
                    className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-semibold py-2 px-3 rounded-lg flex items-center gap-1.5 text-sm"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    title="Export as PDF"
                  >
                    <FileText size={16} /> PDF
                  </motion.button>
                  <motion.button
                    onClick={() => downloadNote(note)}
                    className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-semibold py-2 px-3 rounded-lg flex items-center gap-1.5 text-sm"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Download size={16} /> TXT
                  </motion.button>
                </div>
              </div>
              <motion.div
                className="prose prose-sm max-w-none bg-white/50 dark:bg-white/5 p-6 rounded-xl border border-gray-100 dark:border-white/5 leading-relaxed text-gray-700 dark:text-gray-200"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(note) }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              />
              <motion.p
                className="text-xs text-green-600 dark:text-green-400 mt-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                {user && synced ? 'Saved & synced to cloud' : 'Saved to your device'}
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Saved Notes */}
        {savedNotes.length > 0 && (
          <motion.div className={`${glass} p-6 sm:p-8 mb-6 relative overflow-hidden`} {...fadeInUp}>
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-t-2xl" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <FileText size={16} className="text-white" />
              </div>
              Your Saved Notes
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1 bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded-full">{savedNotes.length}</span>
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 ml-11">
              {user && synced ? 'Synced across all your devices' : 'Stored on this device only. Sign in to sync'}
            </p>

            <SearchBar onSearch={setSearchQuery} resultCount={filteredNotes.length} />

            <div className="space-y-3">
              <AnimatePresence>
                {filteredNotes.map((saved, index) => (
                  <motion.div
                    key={saved.id}
                    className="border border-gray-200/80 dark:border-white/10 rounded-xl overflow-hidden
                               hover:border-indigo-400 dark:hover:border-indigo-700
                               hover:shadow-[0_4px_20px_rgba(99,102,241,0.1)] dark:hover:shadow-[0_4px_20px_rgba(99,102,241,0.15)]
                               transition-all duration-200
                               bg-white/50 dark:bg-white/[0.03]"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20, height: 0 }}
                    transition={{ delay: index * 0.04, duration: 0.3 }}
                    layout
                  >
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/50 dark:hover:bg-white/5 transition"
                      onClick={() => setExpandedNote(expandedNote === saved.id ? null : saved.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 dark:text-gray-200 truncate">
                          {saved.transcript.substring(0, 60)}...
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-500">
                          {saved.date} &middot; {formatTime(saved.duration)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 ml-3">
                        <motion.button
                          onClick={(e) => { e.stopPropagation(); exportPdf(renderMarkdown(saved.note), saved.date); }}
                          className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg"
                          whileHover={{ scale: 1.15 }}
                          whileTap={{ scale: 0.9 }}
                          title="PDF"
                        >
                          <FileText size={15} />
                        </motion.button>
                        <motion.button
                          onClick={(e) => { e.stopPropagation(); downloadNote(saved.note, saved.date); }}
                          className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"
                          whileHover={{ scale: 1.15 }}
                          whileTap={{ scale: 0.9 }}
                          title="Download TXT"
                        >
                          <Download size={15} />
                        </motion.button>
                        <motion.button
                          onClick={(e) => { e.stopPropagation(); deleteNote(saved.id); }}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                          whileHover={{ scale: 1.15 }}
                          whileTap={{ scale: 0.9 }}
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </motion.button>
                        <motion.div
                          animate={{ rotate: expandedNote === saved.id ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown size={18} className="text-gray-400" />
                        </motion.div>
                      </div>
                    </div>

                    <AnimatePresence>
                      {expandedNote === saved.id && (
                        <motion.div
                          className="px-4 pb-4 border-t border-gray-100 dark:border-white/5"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <div className="mt-3 p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl mb-3">
                            <h4 className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 mb-1">Original transcript</h4>
                            <p className="text-sm text-indigo-900 dark:text-indigo-200 whitespace-pre-wrap">{saved.transcript}</p>
                          </div>
                          <div className="p-4 bg-white/50 dark:bg-white/5 rounded-xl">
                            <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">AI-generated notes</h4>
                            <div
                              className="text-sm leading-relaxed text-gray-700 dark:text-gray-200"
                              dangerouslySetInnerHTML={{ __html: renderMarkdown(saved.note) }}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* How it works */}
        <motion.div className={`${glass} p-6 mb-8 relative overflow-hidden`} {...fadeInUp}>
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 rounded-t-2xl" />
          <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <span className="text-white text-sm font-bold">?</span>
            </div>
            How it works
          </h3>
          <ol className="text-sm text-gray-700 dark:text-gray-300 space-y-3">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold">1</span>
              <span>Hit <strong className="text-gray-900 dark:text-white">"Start Recording"</strong> and speak</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold">2</span>
              <span>See your speech transcribed live with a waveform visualizer</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold">3</span>
              <span>When you stop, AI reads your transcript and writes structured notes</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold">4</span>
              <span>Export as PDF or TXT. Notes auto-save on your device</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold">5</span>
              <span>Search through your notes anytime. They're always here</span>
            </li>
          </ol>
          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-white/10">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Works best on Chrome (desktop & Android). Safari/iOS doesn't support speech recognition.
              On mobile, PDF opens in a new tab. Use your browser's Share button to save or print.
            </p>
          </div>
        </motion.div>
      </div>
    </ErrorBoundary>
  );
}
