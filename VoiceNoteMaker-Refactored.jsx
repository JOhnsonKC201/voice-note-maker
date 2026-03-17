import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Mic, Square, Play, Download, Trash2, Plus, AlertCircle } from 'lucide-react';

// Constants
const CONFIG = {
  AUDIO: {
    FFT_SIZE: 256,
    MIME_TYPE: 'audio/webm',
    SAMPLE_RATE: 16000
  },
  STORAGE: {
    DEBOUNCE_MS: 1000,
    NOTES_KEY: 'voiceNotes',
    API_KEY: 'geminiApiKey',
    MAX_SIZE_MB: 5
  },
  API: {
    GEMINI_ENDPOINT: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    TIMEOUT_MS: 60000
  },
  UI: {
    MAX_TITLE_LENGTH: 100,
    MAX_NOTE_LENGTH: 5000,
    DEBOUNCE_STORAGE_MS: 1000
  }
};

const COLORS = {
  dark: { bg: '#1a1a1a', stroke: '#3b82f6', canvasBg: '#111827' },
  light: { bg: '#f5f5f5', stroke: '#2563eb', canvasBg: '#ffffff' }
};

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('VoiceNoteMaker Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="text-red-600" size={24} />
              <h1 className="text-xl font-bold text-red-600">Something went wrong</h1>
            </div>
            <p className="text-gray-700 mb-4">{this.state.error?.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Custom Hook: useAudioRecorder
const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState(null);

  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);
  const audioContext = useRef(null);
  const analyser = useRef(null);
  const dataArray = useRef(null);
  const stream = useRef(null);
  const timerInterval = useRef(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (timerInterval.current) clearInterval(timerInterval.current);
    if (stream.current) {
      stream.current.getTracks().forEach(track => track.stop());
      stream.current = null;
    }
    if (mediaRecorder.current) {
      if (mediaRecorder.current.state !== 'inactive') {
        mediaRecorder.current.stop();
      }
      mediaRecorder.current = null;
    }
    if (audioContext.current) {
      if (audioContext.current.state === 'running') {
        audioContext.current.close();
      }
      audioContext.current = null;
    }
    analyser.current = null;
    dataArray.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Timer interval
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerInterval.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
    } else {
      if (timerInterval.current) clearInterval(timerInterval.current);
    }
    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, [isRecording, isPaused]);

  const startRecording = useCallback(async (onRecordingComplete) => {
    try {
      setError(null);
      stream.current = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true }
      });

      audioContext.current = new (window.AudioContext || window.webkitAudioContext)();
      analyser.current = audioContext.current.createAnalyser();
      analyser.current.fftSize = CONFIG.AUDIO.FFT_SIZE;
      dataArray.current = new Uint8Array(analyser.current.frequencyBinCount);

      const source = audioContext.current.createMediaStreamSource(stream.current);
      source.connect(analyser.current);

      audioChunks.current = [];
      mediaRecorder.current = new MediaRecorder(stream.current, {
        mimeType: CONFIG.AUDIO.MIME_TYPE
      });

      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunks.current.push(e.data);
        }
      };

      mediaRecorder.current.onstop = () => {
        const audioBlob = new Blob(audioChunks.current, { type: CONFIG.AUDIO.MIME_TYPE });
        const audioUrl = URL.createObjectURL(audioBlob);
        onRecordingComplete({ blob: audioBlob, url: audioUrl, duration: recordingTime });
      };

      mediaRecorder.current.onerror = (e) => {
        setError(`Recording error: ${e.error}`);
      };

      mediaRecorder.current.start();
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
    } catch (err) {
      const errorMsg = err.name === 'NotAllowedError' 
        ? 'Microphone access denied. Please allow microphone access.'
        : `Error starting recording: ${err.message}`;
      setError(errorMsg);
      cleanup();
    }
  }, [recordingTime, cleanup]);

  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
    }
    setIsRecording(false);
    setIsPaused(false);
  }, []);

  const pauseRecording = useCallback(() => {
    if (mediaRecorder.current) {
      if (isPaused) {
        mediaRecorder.current.resume();
      } else {
        mediaRecorder.current.pause();
      }
      setIsPaused(!isPaused);
    }
  }, [isPaused]);

  return {
    isRecording,
    isPaused,
    recordingTime,
    error,
    analyser,
    dataArray,
    startRecording,
    stopRecording,
    pauseRecording,
    cleanup
  };
};

// Custom Hook: useTranscription
const useTranscription = (apiKey) => {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [error, setError] = useState(null);

  const retryFetch = useCallback(async (fn, maxRetries = 3, delayMs = 1000) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (err) {
        if (i === maxRetries - 1) throw err;
        await new Promise(r => setTimeout(r, delayMs * Math.pow(2, i)));
      }
    }
  }, []);

  const transcribeAndSummarize = useCallback(async (audioBase64) => {
    if (!apiKey?.trim()) {
      setError('API key not configured');
      return null;
    }

    setIsTranscribing(true);
    setError(null);

    try {
      const response = await retryFetch(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.API.TIMEOUT_MS);

        try {
          const res = await fetch(
            `${CONFIG.API.GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    {
                      text: `Analyze this audio recording and provide:
1. **Transcription**: Full text of what was said
2. **Key Topics**: Main subjects discussed
3. **Summary**: 2-3 sentence summary
4. **Action Items**: Any tasks mentioned
5. **Important Quotes**: Notable statements

Format clearly with these sections.`
                    },
                    {
                      inline_data: {
                        mime_type: CONFIG.AUDIO.MIME_TYPE,
                        data: audioBase64
                      }
                    }
                  ]
                }]
              }),
              signal: controller.signal
            }
          );

          clearTimeout(timeoutId);
          return res;
        } catch (err) {
          clearTimeout(timeoutId);
          throw err;
        }
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message || 'API request failed');
      }

      if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error('Invalid API response');
      }

      const transcript = data.candidates[0].content.parts[0].text;
      setTranscribedText(transcript);
      return transcript;
    } catch (err) {
      const errorMsg = err.name === 'AbortError' 
        ? 'Transcription timeout. Try again.'
        : `Transcription error: ${err.message}`;
      setError(errorMsg);
      return null;
    } finally {
      setIsTranscribing(false);
    }
  }, [apiKey, retryFetch]);

  return {
    isTranscribing,
    transcribedText,
    error,
    setTranscribedText,
    transcribeAndSummarize
  };
};

// Custom Hook: useStorageWithDebounce
const useStorageWithDebounce = (key, initialValue, debounceMs = CONFIG.UI.DEBOUNCE_STORAGE_MS) => {
  const [value, setValue] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (err) {
      console.error(`Failed to load ${key}:`, err);
      return initialValue;
    }
  });

  const debounceTimer = useRef(null);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (err) {
        console.error(`Failed to save ${key}:`, err);
      }
    }, debounceMs);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [value, key, debounceMs]);

  return [value, setValue];
};

// Input Validation
const validateInput = {
  title: (title, maxLength = CONFIG.UI.MAX_TITLE_LENGTH) => {
    if (!title?.trim()) return { valid: false, error: 'Title is required' };
    if (title.length > maxLength) return { valid: false, error: `Max ${maxLength} characters` };
    return { valid: true, error: null };
  },
  note: (note, maxLength = CONFIG.UI.MAX_NOTE_LENGTH) => {
    if (note.length > maxLength) return { valid: false, error: `Max ${maxLength} characters` };
    return { valid: true, error: null };
  }
};

// Main Component
export default function VoiceNoteMaker() {
  const [notes, setNotes] = useStorageWithDebounce('voiceNotes', []);
  const [currentNote, setCurrentNote] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [showQuickNote, setShowQuickNote] = useState(false);
  const [quickNoteText, setQuickNoteText] = useState('');
  const [recordedAudio, setRecordedAudio] = useState(null);
  const [saveTitle, setSaveTitle] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(CONFIG.STORAGE.API_KEY) || '');
  const [showApiKeyInput, setShowApiKeyInput] = useState(!localStorage.getItem(CONFIG.STORAGE.API_KEY));
  const [globalError, setGlobalError] = useState(null);

  const canvasRef = useRef(null);
  const recorder = useAudioRecorder();
  const transcription = useTranscription(apiKey);

  // Waveform drawing with useCallback
  const drawWaveform = useCallback(() => {
    if (!recorder.analyser?.current || !recorder.dataArray?.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const colors = darkMode ? COLORS.dark : COLORS.light;

    recorder.analyser.current.getByteFrequencyData(recorder.dataArray.current);

    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = 2;
    ctx.beginPath();

    const bufferLength = recorder.dataArray.current.length;
    const sliceWidth = canvas.width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = recorder.dataArray.current[i] / 128.0;
      const y = (v * canvas.height) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }

    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    if (recorder.isRecording && !recorder.isPaused) {
      requestAnimationFrame(drawWaveform);
    }
  }, [darkMode, recorder.isRecording, recorder.isPaused]);

  // Trigger waveform drawing
  useEffect(() => {
    if (recorder.isRecording && !recorder.isPaused) {
      drawWaveform();
    }
  }, [recorder.isRecording, recorder.isPaused, drawWaveform]);

  // Handlers
  const handleStartRecording = useCallback(async () => {
    setGlobalError(null);
    await recorder.startRecording((audio) => {
      setRecordedAudio({
        ...audio,
        notes: currentNote
      });
      setShowSaveDialog(true);
    });
  }, [recorder, currentNote]);

  const handleSaveApiKey = useCallback(() => {
    const validation = validateInput.title(apiKey, 100);
    if (!validation.valid) {
      setGlobalError(validation.error);
      return;
    }
    localStorage.setItem(CONFIG.STORAGE.API_KEY, apiKey);
    setShowApiKeyInput(false);
    setGlobalError(null);
  }, [apiKey]);

  const handleSaveRecording = useCallback(() => {
    const titleValidation = validateInput.title(saveTitle);
    if (!titleValidation.valid) {
      setGlobalError(titleValidation.error);
      return;
    }

    if (!recordedAudio) return;

    const newNote = {
      id: Date.now(),
      title: saveTitle.trim(),
      text: recordedAudio.notes || transcription.transcribedText,
      audioUrl: recordedAudio.url,
      timestamp: new Date().toLocaleString(),
      duration: recordedAudio.duration,
      isRecording: true
    };

    setNotes([newNote, ...notes]);
    setShowSaveDialog(false);
    setRecordedAudio(null);
    setSaveTitle('');
    setCurrentNote('');
    transcription.setTranscribedText('');
    setGlobalError(null);
  }, [recordedAudio, saveTitle, notes, transcription]);

  const handleDownloadRecording = useCallback(() => {
    if (!recordedAudio || !saveTitle.trim()) {
      setGlobalError('Please enter a title');
      return;
    }

    const url = URL.createObjectURL(recordedAudio.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${saveTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${new Date().toISOString().slice(0, 10)}.webm`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    handleSaveRecording();
  }, [recordedAudio, saveTitle, handleSaveRecording]);

  const handleDeleteNote = useCallback((id) => {
    setNotes(notes.filter(n => n.id !== id));
  }, [notes]);

  const handleEditNote = useCallback((id, text) => {
    const noteValidation = validateInput.note(text);
    if (!noteValidation.valid) {
      setGlobalError(noteValidation.error);
      return;
    }
    setNotes(notes.map(n => n.id === id ? { ...n, text } : n));
    setEditingId(null);
  }, [notes]);

  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }, []);

  const bgClass = darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900';
  const cardClass = darkMode ? 'bg-gray-800' : 'bg-gray-50';
  const inputClass = darkMode 
    ? 'bg-gray-700 text-white border-gray-600' 
    : 'bg-white text-gray-900 border-gray-300';

  return (
    <ErrorBoundary>
      <div className={`min-h-screen ${bgClass} transition-colors duration-200`}>
        <div className="max-w-4xl mx-auto p-4 md:p-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Voice Note Maker</h1>
            <div className="flex gap-2">
              {!apiKey && (
                <button
                  onClick={() => setShowApiKeyInput(true)}
                  className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition"
                  aria-label="Setup API key"
                >
                  🔑 API Key
                </button>
              )}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
                aria-label="Toggle dark mode"
              >
                {darkMode ? '☀️' : '🌙'}
              </button>
            </div>
          </div>

          {/* Global Error */}
          {globalError && (
            <div className="bg-red-900 border border-red-600 text-red-200 p-4 rounded-lg mb-6 flex items-start gap-3">
              <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{globalError}</p>
                <button
                  onClick={() => setGlobalError(null)}
                  className="text-sm underline mt-1"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Recorder Errors */}
          {recorder.error && (
            <div className="bg-red-900 border border-red-600 text-red-200 p-4 rounded-lg mb-6">
              {recorder.error}
            </div>
          )}

          {/* API Key Setup */}
          {showApiKeyInput && (
            <div className={`${cardClass} rounded-lg p-6 shadow-lg border-2 border-purple-600 mb-6`}>
              <h2 className="text-lg font-bold mb-3">Setup Google Gemini API Key</h2>
              <p className="text-sm opacity-75 mb-3">
                Get free at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">aistudio.google.com</a> (No credit card)
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  aria-label="Gemini API key"
                  className={`flex-1 border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-600 ${inputClass}`}
                />
                <button
                  onClick={handleSaveApiKey}
                  className="bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 transition font-semibold"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {/* Recording UI */}
          <div className={`${cardClass} rounded-lg p-6 mb-6 shadow-lg`}>
            <div className="mb-4">
              <canvas
                ref={canvasRef}
                width={600}
                height={120}
                className={`w-full border rounded ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}
                aria-label="Audio waveform visualization"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <textarea
                value={currentNote}
                onChange={(e) => setCurrentNote(e.target.value.slice(0, CONFIG.UI.MAX_NOTE_LENGTH))}
                placeholder="Take notes while recording..."
                aria-label="Recording notes"
                className={`border rounded-lg p-3 h-32 focus:outline-none focus:ring-2 focus:ring-blue-600 ${inputClass}`}
              />

              <div className="flex flex-col justify-between">
                <div className="text-2xl font-mono font-bold text-blue-600 mb-2">
                  {formatTime(recorder.recordingTime)}
                </div>

                <div className="flex gap-2 flex-wrap">
                  {!recorder.isRecording ? (
                    <button
                      onClick={handleStartRecording}
                      className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition flex-1"
                      aria-label="Start recording"
                    >
                      <Mic size={20} /> Record
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => recorder.stopRecording()}
                        className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition flex-1"
                        aria-label="Stop recording"
                      >
                        <Square size={20} /> Stop
                      </button>
                      <button
                        onClick={() => recorder.pauseRecording()}
                        className={`px-4 py-2 rounded-lg transition flex-1 ${
                          recorder.isPaused
                            ? 'bg-green-600 hover:bg-green-700'
                            : 'bg-yellow-600 hover:bg-yellow-700'
                        } text-white`}
                        aria-label={recorder.isPaused ? 'Resume recording' : 'Pause recording'}
                      >
                        {recorder.isPaused ? '▶️' : '⏸️'}
                      </button>
                    </>
                  )}
                </div>

                {recorder.isRecording && (
                  <button
                    onClick={() => {
                      const time = `[${Math.floor(recorder.recordingTime / 60)}:${String(recorder.recordingTime % 60).padStart(2, '0')}]`;
                      setCurrentNote(currentNote + ' ' + time);
                    }}
                    className="mt-2 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition text-sm w-full"
                    aria-label="Insert timestamp"
                  >
                    + Timestamp
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Save Dialog */}
          {showSaveDialog && recordedAudio && (
            <div className={`${cardClass} rounded-lg p-6 shadow-lg border-2 border-blue-600 mb-6`}>
              <h2 className="text-xl font-bold mb-4">Save Recording</h2>

              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Title *</label>
                <input
                  type="text"
                  value={saveTitle}
                  onChange={(e) => setSaveTitle(e.target.value.slice(0, CONFIG.UI.MAX_TITLE_LENGTH))}
                  placeholder="e.g., Meeting Notes..."
                  maxLength={CONFIG.UI.MAX_TITLE_LENGTH}
                  aria-label="Recording title"
                  className={`border rounded-lg p-3 w-full focus:outline-none focus:ring-2 focus:ring-blue-600 ${inputClass}`}
                  autoFocus
                />
              </div>

              <div className="mb-4">
                <audio src={recordedAudio.url} controls className="w-full h-8" aria-label="Recording preview" />
              </div>

              {!transcription.transcribedText && apiKey && (
                <button
                  onClick={() => {
                    const reader = new FileReader();
                    reader.readAsDataURL(recordedAudio.blob);
                    reader.onload = () => {
                      transcription.transcribeAndSummarize(reader.result.split(',')[1]);
                    };
                  }}
                  disabled={transcription.isTranscribing}
                  className="w-full bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed mb-4"
                >
                  {transcription.isTranscribing ? '🤖 Analyzing...' : '🤖 Generate AI Notes'}
                </button>
              )}

              {transcription.transcribedText && (
                <div className="mb-4">
                  <label className="block text-sm font-semibold mb-2">✨ AI Notes</label>
                  <div className={`p-4 rounded border max-h-64 overflow-y-auto ${darkClass}`}>
                    <pre className="whitespace-pre-wrap text-sm font-sans">{transcription.transcribedText}</pre>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleDownloadRecording}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
                  aria-label="Download recording to device"
                >
                  <Download size={20} /> Download
                </button>
                <button
                  onClick={handleSaveRecording}
                  className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition font-semibold"
                  aria-label="Save recording to app"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setShowSaveDialog(false);
                    setRecordedAudio(null);
                    setSaveTitle('');
                    transcription.setTranscribedText('');
                  }}
                  className="flex-1 bg-gray-600 text-white px-4 py-3 rounded-lg hover:bg-gray-700 transition"
                  aria-label="Cancel save dialog"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Notes List */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Notes ({notes.length})</h2>
              <button
                onClick={() => setShowQuickNote(!showQuickNote)}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                aria-label="Create quick note"
              >
                <Plus size={20} /> Make a Note
              </button>
            </div>

            {showQuickNote && (
              <div className={`${cardClass} rounded-lg p-4 shadow border-2 border-green-600`}>
                <textarea
                  value={quickNoteText}
                  onChange={(e) => setQuickNoteText(e.target.value.slice(0, CONFIG.UI.MAX_NOTE_LENGTH))}
                  placeholder="Type your quick note..."
                  maxLength={CONFIG.UI.MAX_NOTE_LENGTH}
                  aria-label="Quick note text"
                  className={`border rounded-lg p-3 w-full h-24 focus:outline-none focus:ring-2 focus:ring-green-600 ${inputClass}`}
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => {
                      if (quickNoteText.trim()) {
                        setNotes([{
                          id: Date.now(),
                          text: quickNoteText,
                          audioUrl: null,
                          timestamp: new Date().toLocaleString(),
                          duration: 0,
                          isQuickNote: true
                        }, ...notes]);
                        setQuickNoteText('');
                        setShowQuickNote(false);
                      }
                    }}
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setShowQuickNote(false);
                      setQuickNoteText('');
                    }}
                    className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {notes.length === 0 ? (
              <div className={`${cardClass} rounded-lg p-8 text-center opacity-50`}>
                <p>No notes yet. Start recording!</p>
              </div>
            ) : (
              notes.map(note => (
                <div key={note.id} className={`${cardClass} rounded-lg p-4 shadow`}>
                  {editingId === note.id ? (
                    <div className="space-y-3">
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value.slice(0, CONFIG.UI.MAX_NOTE_LENGTH))}
                        maxLength={CONFIG.UI.MAX_NOTE_LENGTH}
                        aria-label="Edit note text"
                        className={`border rounded-lg p-3 w-full h-24 focus:outline-none focus:ring-2 focus:ring-blue-600 ${inputClass}`}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            handleEditNote(note.id, editingText);
                          }}
                          className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="flex-1 bg-gray-600 text-white px-3 py-2 rounded-lg hover:bg-gray-700 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          {note.title && <h3 className="text-lg font-bold mb-1">{note.title}</h3>}
                          <div className="flex items-center gap-2">
                            <p className="text-sm opacity-70">{note.timestamp}</p>
                            {note.isRecording && <span className="bg-red-600 text-white text-xs px-2 py-1 rounded">🎙️ Recording</span>}
                            {note.isQuickNote && <span className="bg-green-600 text-white text-xs px-2 py-1 rounded">📝 Note</span>}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingId(note.id);
                              setEditingText(note.text);
                            }}
                            className="p-2 hover:bg-blue-600 text-blue-600 hover:text-white rounded transition"
                            aria-label="Edit note"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="p-2 hover:bg-red-600 text-red-600 hover:text-white rounded transition"
                            aria-label="Delete note"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                      {note.audioUrl && <audio src={note.audioUrl} controls className="w-full mb-3 h-8" />}
                      {note.text && (
                        <p className="mt-3 p-3 bg-opacity-50 rounded border opacity-90">{note.text}</p>
                      )}
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
