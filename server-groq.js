import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config(); // fallback to .env for production

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- Configuration ---
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const PORT = process.env.PORT || 3003;

// --- AI Helper ---
async function askAI(prompt, maxTokens = 1000) {
  if (!GROQ_API_KEY) {
    throw new Error('Missing GROQ_API_KEY in .env.local — get one free at console.groq.com/keys');
  }

  const response = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful study assistant. Write in a clear, friendly, and natural tone — like a smart classmate who takes great notes. Avoid robotic language, bullet-point overload, and corporate jargon. Be concise but thorough.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.75,
      max_tokens: maxTokens
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || `Groq API error (${response.status})`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from AI');
  return content;
}

// --- Web Search (free, no key needed) ---
async function searchWeb(topic) {
  try {
    const response = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(topic)}&format=json&no_html=1`
    );
    const data = await response.json();
    const results = [];

    if (data.Abstract) {
      results.push({ type: 'summary', content: data.Abstract });
    }
    if (data.RelatedTopics?.length > 0) {
      results.push({
        type: 'relatedTopics',
        items: data.RelatedTopics.slice(0, 3).map(t => t.Text || t.FirstURL)
      });
    }
    return results;
  } catch {
    return [];
  }
}

// --- Routes ---

// Analyze a transcript and categorize it
app.post('/api/analyze-note', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) {
      return res.status(400).json({ error: 'No text provided' });
    }

    const raw = await askAI(
      `Read this voice note transcript and tell me:
- What's the main topic? (1-2 words)
- Give me 3-5 tags that fit
- Write a quick 1-2 sentence summary
- What category does it fall into? (meeting, idea, todo, personal, or standup)

Here's the transcript: "${text}"

Reply as JSON with keys: topic, tags, summary, category`,
      500
    );

    let analysis;
    try {
      analysis = JSON.parse(raw);
    } catch {
      analysis = { topic: 'Note', tags: 'recording', summary: text.substring(0, 100), category: 'personal' };
    }

    const tags = Array.isArray(analysis.tags)
      ? analysis.tags
      : String(analysis.tags || 'recording').split(',').map(t => t.trim());

    const topic = (analysis.topic || 'Note').trim();
    const genericTopics = ['note', 'recording', 'personal', 'meeting', 'idea', 'todo', 'standup'];
    const webInfo = genericTopics.includes(topic.toLowerCase()) ? [] : await searchWeb(topic);

    res.json({
      success: true,
      analysis: {
        topic,
        tags,
        summary: analysis.summary || text.substring(0, 100),
        category: analysis.category || 'personal',
        webInfo
      }
    });
  } catch (err) {
    console.error('Analysis error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Turn a transcript into a polished, human-sounding note
app.post('/api/generate-enriched-note', async (req, res) => {
  try {
    const { transcript, recordingTitle } = req.body;
    if (!transcript) {
      return res.status(400).json({ error: 'No transcript provided' });
    }

    const note = await askAI(
      `I just recorded a lecture. Here's the raw transcript:

"${transcript}"

Title: ${recordingTitle || 'Untitled'}

Turn this into well-structured study notes using this exact markdown format:

# Topic Title

## Overview
Write 2-3 sentences summarizing what was covered. Be specific — don't say "the lecture covered X", just explain X directly.

## Key Concepts
For each important concept, use this format:

### Concept Name
Explain it clearly in 2-3 sentences. Use a real-world analogy if it helps. If a concept is technical, break it down simply.

## Key Takeaways
- Bullet each main point (keep each to 1-2 sentences)
- Focus on what matters most for understanding the topic

## Action Items
- [ ] Specific things to study or do next
- [ ] Resources to look up

## Go Deeper
Suggest 2-3 specific topics or questions to explore next, with a brief reason why each one matters.

Rules:
- Write like a smart classmate, not a textbook
- Use **bold** for important terms when first introduced
- If the transcript is short or unclear, focus on what IS there — don't pad with filler
- Never start with "Here's a cleaned-up version" or meta commentary — jump straight into the notes
- Use analogies and examples to make concepts click`,
      2500
    );

    res.json({ success: true, enrichedNote: note });
  } catch (err) {
    console.error('Generation error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- Start ---
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Model: ${GROQ_MODEL}`);
  console.log(`API Key: ${GROQ_API_KEY ? 'loaded' : 'MISSING!'}`);
});
