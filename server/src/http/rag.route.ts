import { Router } from 'express';
import { AzureOpenAI } from 'openai';
import { env } from '../env.js';
import { retrieve } from '../rag/retrieve.js';

export const ragRoute = Router();

const SYSTEM_PROMPT =
  'Eres Khumpi, el asistente de salud de Khumpai. ' +
  'Responde SOLO con la información de las FUENTES dadas, en español peruano sencillo y cálido. ' +
  'NO des dosis ni diagnósticos — eso lo decide su médico. ' +
  'Si las fuentes no responden la pregunta, dilo con honestidad y sugiere preguntar al médico. ' +
  'No escribas las fuentes dentro del texto: la app las muestra aparte como etiquetas.';

ragRoute.post('/api/rag/ask', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  const send = (o: unknown) => res.write(`data: ${JSON.stringify(o)}\n\n`);
  const done = () => { send({ type: 'done' }); res.end(); };

  if (!env.AZURE_OPENAI_ENDPOINT || !env.AZURE_OPENAI_API_KEY) {
    send({ type: 'error', message: 'Azure OpenAI not configured: set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY in server/.env' });
    done();
    return;
  }

  const question: string = req.body?.question ?? '';
  if (!question.trim()) {
    send({ type: 'error', message: 'question is required' });
    done();
    return;
  }

  let hits: Awaited<ReturnType<typeof retrieve>>;
  try {
    hits = await retrieve(question, 4);
  } catch (err) {
    send({ type: 'error', message: `Retrieval failed: ${String(err)}` });
    done();
    return;
  }

  if (hits.length === 0) {
    send({ type: 'text', delta: 'Por ahora no tengo esa información en mis fuentes. Es mejor preguntárselo a tu médico.' });
    done();
    return;
  }

  // Build grounded context block
  const sourcesBlock = hits
    .map((h, i) => `[${i + 1}] (${h.source}) ${h.content}`)
    .join('\n\n');

  try {
    const client = new AzureOpenAI({
      endpoint: env.AZURE_OPENAI_ENDPOINT,
      apiKey: env.AZURE_OPENAI_API_KEY,
      apiVersion: env.AZURE_OPENAI_API_VERSION,
      deployment: env.AZURE_OPENAI_DEPLOYMENT,
    });

    const stream = await client.chat.completions.create({
      model: env.AZURE_OPENAI_DEPLOYMENT,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'system', content: `FUENTES:\n${sourcesBlock}` },
        { role: 'user', content: question },
      ] as any,
      stream: true,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const chunk of stream as AsyncIterable<any>) {
      const delta = chunk?.choices?.[0]?.delta?.content;
      if (typeof delta === 'string' && delta) {
        send({ type: 'text', delta });
      }
    }

    send({
      type: 'sources',
      sources: hits.map((h) => ({ source: h.source, sourceUrl: h.sourceUrl })),
    });
  } catch (err) {
    send({ type: 'error', message: String(err) });
  }

  done();
});
