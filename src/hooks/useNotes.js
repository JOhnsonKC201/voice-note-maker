import { useState, useEffect, useCallback, useRef } from 'react';
import { db, isConfigured } from '../firebase';

const STORAGE_KEY = 'lecture-notes';

function loadLocal() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function saveLocal(notes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function mergeNotes(localNotes, firestoreNotes) {
  const map = new Map();

  for (const note of localNotes) {
    map.set(note.id, { ...note, updatedAt: note.updatedAt || note.id });
  }

  for (const note of firestoreNotes) {
    const fsUpdated = note.updatedAt?.seconds ? note.updatedAt.seconds * 1000 : (note.updatedAt || note.id);
    const existing = map.get(note.id);
    if (!existing || fsUpdated > (existing.updatedAt || 0)) {
      map.set(note.id, { ...note, updatedAt: fsUpdated });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.id - a.id);
}

export function useNotes(user) {
  const [notes, setNotes] = useState(loadLocal);
  const [synced, setSynced] = useState(false);
  const mergedRef = useRef(false);

  useEffect(() => {
    if (!user || !isConfigured || !db) {
      setNotes(loadLocal());
      setSynced(false);
      mergedRef.current = false;
      return;
    }

    let unsub;

    async function setupSync() {
      const { collection, onSnapshot, doc, setDoc, serverTimestamp } = await import('firebase/firestore');
      const notesRef = collection(db, 'users', user.uid, 'notes');

      unsub = onSnapshot(notesRef, async (snapshot) => {
        const firestoreNotes = snapshot.docs.map(d => d.data());
        const localNotes = loadLocal();
        const merged = mergeNotes(localNotes, firestoreNotes);

        setNotes(merged);
        saveLocal(merged);
        setSynced(true);

        if (!mergedRef.current) {
          mergedRef.current = true;
          const fsIds = new Set(firestoreNotes.map(n => n.id));
          const localOnly = localNotes.filter(n => !fsIds.has(n.id));
          for (const note of localOnly) {
            await setDoc(doc(db, 'users', user.uid, 'notes', String(note.id)), {
              ...note,
              updatedAt: serverTimestamp()
            });
          }
        }
      }, (error) => {
        console.error('Firestore sync error:', error);
        setNotes(loadLocal());
      });
    }

    setupSync();
    return () => unsub?.();
  }, [user]);

  const addNote = useCallback(async (newNote) => {
    const noteWithTimestamp = { ...newNote, updatedAt: Date.now() };
    setNotes(prev => {
      const updated = [noteWithTimestamp, ...prev];
      saveLocal(updated);
      return updated;
    });
    if (user && isConfigured && db) {
      try {
        const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
        await setDoc(doc(db, 'users', user.uid, 'notes', String(newNote.id)), {
          ...noteWithTimestamp,
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        console.error('Failed to sync note:', err);
      }
    }
  }, [user]);

  const removeNote = useCallback(async (id) => {
    setNotes(prev => {
      const updated = prev.filter(n => n.id !== id);
      saveLocal(updated);
      return updated;
    });
    if (user && isConfigured && db) {
      try {
        const { doc, deleteDoc } = await import('firebase/firestore');
        await deleteDoc(doc(db, 'users', user.uid, 'notes', String(id)));
      } catch (err) {
        console.error('Failed to delete note from cloud:', err);
      }
    }
  }, [user]);

  return { notes, addNote, removeNote, synced };
}
