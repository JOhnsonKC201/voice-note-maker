import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const HF_TOKEN = process.env.HF_TOKEN;
const HF_ENDPOINT = 'https://router.huggingface.co/v1';
const HF_MODEL = 'moonshotai/Kimi-K2-Instruct-0905';
const API_TEMPERATURE = 0.7;
const ANALYSIS_MAX_TOKENS = 500;
const GENERATION_MAX_TOKENS = 1000;

// Shared HuggingFace API call handler
async function callHuggingFaceAPI(prompt, maxTokens) {
  if (!HF_TOKEN) {
    throw new Error('HF_TOKEN not set in environment variables');
  }

  const response = await fetch(`${HF_ENDPOINT}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HF_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: HF_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: API_TEMPERATURE,
      max_tokens: maxTokens
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    const errorMsg = errorData.error?.message || `HuggingFace API error: ${response.status}`;
    throw new Error(errorMsg);
  }

  const data = await response.json();
  if (!data.choices?.[0]?.message?.content) {
    throw new Error('Invalid response from HuggingFace API');
  }

  return data.choices[0].message.content;
}

const ANALYSIS_PROMPT_TEMPLATE = (text) => `Analyze this voice recording transcript and provide:
1. Main topic (1-2 words)
2. Suggested tags (3-5 relevant tags, comma-separated)
3. Brief summary (1-2 sentences)
4. Suggested category (meeting, idea, todo, personal, standup)

Text: "${text}"

Format response as JSON with keys: topic, tags, summary, category`;

// Analyze note content and extract topics
app.post('/api/analyze-note', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'No text provided' });
    }

    const analysisPrompt = ANALYSIS_PROMPT_TEMPLATE(text);
    const analysisText = await callHuggingFaceAPI(analysisPrompt, ANALYSIS_MAX_TOKENS);

    // Parse the response
    let analysis = {};
    try {
      analysis = JSON.parse(analysisText);
    } catch (e) {
      // Fallback parsing if JSON fails
      analysis = {
        topic: 'Note',
        tags: 'recording',
        summary: text.substring(0, 100),
        category: 'personal'
      };
    }

    // Safely parse tags
    const tags = Array.isArray(analysis.tags)
      ? analysis.tags
      : String(analysis.tags || 'recording').split(',').map(t => t.trim());

    // Fetch web information about the topic (conditional)
    const topicToSearch = (analysis.topic || 'Note').trim();
    const isGenericTopic = ['note', 'recording', 'personal', 'meeting', 'idea', 'todo', 'standup'].includes(topicToSearch.toLowerCase());
    const webInfo = isGenericTopic ? [] : await searchWeb(topicToSearch);

    res.json({
      success: true,
      analysis: {
        topic: topicToSearch,
        tags: tags,
        summary: analysis.summary || text.substring(0, 100),
        category: analysis.category || 'personal',
        webInfo: webInfo
      }
    });
  } catch (err) {
    console.error('Analysis error:', err);
    res.status(500).json({ error: `Server error: ${err.message}` });
  }
});

// Search the web for information
async function searchWeb(topic) {
  try {
    // Using DuckDuckGo Instant Answer API (no API key needed)
    const response = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(topic)}&format=json&no_html=1`
    );

    const data = await response.json();

    let webInfo = [];

    if (data.Abstract) {
      webInfo.push({
        type: 'summary',
        content: data.Abstract
      });
    }

    if (data.RelatedTopics && data.RelatedTopics.length > 0) {
      webInfo.push({
        type: 'relatedTopics',
        items: data.RelatedTopics.slice(0, 3).map(t => t.Text || t.FirstURL)
      });
    }

    return webInfo;
  } catch (err) {
    console.error('Web search error:', err);
    return [];
  }
}

const GENERATION_PROMPT_TEMPLATE = (transcript, title) => `Create a detailed, enriched note based on this recording transcript:

Title: ${title}
Transcript: ${transcript}

Generate:
1. Key points (3-5 bullet points)
2. Action items (if any)
3. Important quotes (if any)
4. Follow-up topics

Format as a professional note.`;

// Generate enriched note from recording
app.post('/api/generate-enriched-note', async (req, res) => {
  try {
    const { transcript, recordingTitle } = req.body;

    if (!transcript) {
      return res.status(400).json({ error: 'No transcript provided' });
    }

    const prompt = GENERATION_PROMPT_TEMPLATE(transcript, recordingTitle);
    const enrichedContent = await callHuggingFaceAPI(prompt, GENERATION_MAX_TOKENS);

    res.json({
      success: true,
      enrichedNote: enrichedContent
    });
  } catch (err) {
    console.error('Generation error:', err);
    const errorMsg = err.message.includes('Invalid')
      ? 'Invalid or missing HuggingFace API key. Check .env.local'
      : err.message;
    res.status(500).json({ error: errorMsg });
  }
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🤗 Using HuggingFace API (Kimi-K2 model)`);
  console.log(`🌐 Web search: DuckDuckGo (no API key needed)`);
  console.log(`✅ AI-powered note analysis ready`);
});
