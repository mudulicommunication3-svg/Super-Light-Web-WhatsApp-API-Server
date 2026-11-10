import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getGeminiClient() {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.use('/api/gemini/chat', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.post('/api/gemini/chat', async (req, res) => {
    try {
      const { message, history, mode, storeContext } = req.body || {};
      const userMessage = String(message || '').trim();

      if (!userMessage) {
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      if (!process.env.GEMINI_API_KEY) {
        res.status(500).json({
          error:
            'GEMINI_API_KEY is not configured. Please check Settings > Secrets panel.',
        });
        return;
      }

      let selectedModel = 'gemini-3.8-flash';
      if (mode === 'fast') {
        selectedModel = 'gemini-3.1-flash-lite';
      } else if (mode === 'complex') {
        selectedModel = 'gemini-4-argon';
      }

      const systemInstruction = [
        'You are the official AI Shopping Assistant for "Munna Mobile & Grocery" (ମୁନ୍ନା ମୋବାଇଲ୍ ଆଣ୍ଡ ଗ୍ରୋସରୀ), located in Niali, Odisha.',
        'Role & Tone:',
        '- Be warm, polite, concise, and helpful to local customers and the shop owner.',
        '- Reply in the language the customer uses (Odia, English, or Odia written in English script). If the customer writes in Odia or asks for Odia, always respond in clear, natural Odia alongside helpful price/stock details.',
        '- NEVER invent or guess product prices, MRPs, or stock quantities. ONLY use the live store catalog data provided in the context below.',
        '- If a product has stock > 0, mention its live Selling Price, MRP, discount savings, and available stock count.',
        '- If a product has stock <= 0, politely inform the customer that it is currently Out of Stock (ଷ୍ଟକ୍ ନାହିଁ) and suggest similar in-stock items from the catalog.',
        '- Keep answers brief, scannable (use bullet points for multiple items), and practical for mobile shoppers.',
        '',
        'LIVE STORE CONTEXT & CATALOG:',
        typeof storeContext === 'string' && storeContext.trim()
          ? storeContext
          : 'No live catalog snapshot provided.',
      ].join('\n');

      const formattedHistory = Array.isArray(history)
        ? history
            .filter(
              (item) =>
                item &&
                (item.role === 'user' || item.role === 'model') &&
                typeof item.text === 'string' &&
                item.text.trim() !== ''
            )
            .slice(-16)
            .map((item) => ({
              role: item.role,
              parts: [{ text: String(item.text) }],
            }))
        : [];

      const ai = getGeminiClient();

      let response;
      try {
        const chat = ai.chats.create({
          model: selectedModel,
          history: formattedHistory,
          config: {
            systemInstruction,
          },
        });
        response = await chat.sendMessage({
          message: userMessage,
        });
      } catch (primaryErr) {
        // If complex/pro model is unavailable on free tier, fallback smoothly to gemini-3.8-flash
        if (selectedModel !== 'gemini-3.8-flash') {
          selectedModel = 'gemini-3.8-flash';
          const fallbackChat = ai.chats.create({
            model: selectedModel,
            history: formattedHistory,
            config: {
              systemInstruction,
            },
          });
          response = await fallbackChat.sendMessage({
            message: userMessage,
          });
        } else {
          throw primaryErr;
        }
      }

      const replyText =
        response && typeof response.text === 'string'
          ? response.text
          : 'କ୍ଷମା କରିବେ, ବର୍ତ୍ତମାନ ଉତ୍ତର ମିଳିପାରିଲା ନାହିଁ। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।';

      res.json({
        reply: replyText,
        model: selectedModel,
      });
    } catch (error) {
      const errMessage =
        error instanceof Error ? error.message : 'Failed to generate AI response';
      const statusCode =
        errMessage.includes('429') || errMessage.includes('RESOURCE_EXHAUSTED')
          ? 429
          : errMessage.includes('403') || errMessage.includes('PERMISSION_DENIED')
          ? 403
          : 500;

      res.status(statusCode).json({
        error: errMessage,
      });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
