import { Hono } from 'hono';
import { receiveAiResult } from '../services/ai-results.js';

export const aiResultRoutes = new Hono();
aiResultRoutes.post('/results', async (c) => c.json(await receiveAiResult(c.req.raw, c.env)));
