import { Router } from 'express';
import { AzureOpenAI } from 'openai';
import { env } from '../env.js';
// Shared system prompt + tool schemas (pure data, no front-end runtime deps).
import { KHUMPI_SYSTEM_PROMPT, FOUNDRY_TOOL_DEFINITIONS } from '../../../src/agent/foundryConfig';

export const agentRoute = Router();

agentRoute.post('/api/agent/chat', async (req, res) => {
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

  let messages = (req.body?.messages ?? []) as Array<{ role: string; content: string | null }>;
  if (messages[0]?.role !== 'system') {
    const nowCtx = `\n\n## Current context\nThe current date and time is ${new Date().toISOString()}.`;
    messages = [{ role: 'system', content: KHUMPI_SYSTEM_PROMPT + nowCtx }, ...messages];
  }

  try {
    const client = new AzureOpenAI({
      endpoint: env.AZURE_OPENAI_ENDPOINT,
      apiKey: env.AZURE_OPENAI_API_KEY,
      apiVersion: env.AZURE_OPENAI_API_VERSION,
      deployment: env.AZURE_OPENAI_DEPLOYMENT,
    });
    const stream = await client.chat.completions.create({
      model: env.AZURE_OPENAI_DEPLOYMENT,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- our message/tool shapes are looser than the SDK unions
      messages: messages as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON-schema tool literals
      tools: FOUNDRY_TOOL_DEFINITIONS as any,
      stream: true,
    });

    const acc = new Map<number, { id: string; name: string; arguments: string }>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- OpenAI streaming chunk
    for await (const chunk of stream as AsyncIterable<any>) {
      const choice = chunk?.choices?.[0];
      if (!choice) continue;
      if (typeof choice.delta?.content === 'string' && choice.delta.content) {
        send({ type: 'text', delta: choice.delta.content });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- streaming tool_call delta
      for (const tc of (choice.delta?.tool_calls ?? []) as any[]) {
        const idx: number = tc.index ?? 0;
        const cur = acc.get(idx) ?? { id: '', name: '', arguments: '' };
        if (tc.id) cur.id = tc.id;
        if (tc.function?.name) cur.name = tc.function.name;
        if (typeof tc.function?.arguments === 'string') cur.arguments += tc.function.arguments;
        acc.set(idx, cur);
      }
      if ((choice.finish_reason === 'tool_calls' || choice.finish_reason === 'stop') && acc.size > 0) {
        send({
          type: 'tool_calls',
          toolCalls: [...acc.entries()].sort(([a], [b]) => a - b).map(([, a]) => {
            let args: unknown = {};
            try { args = JSON.parse(a.arguments || '{}'); } catch { args = {}; }
            return { id: a.id, name: a.name, arguments: args };
          }),
        });
        acc.clear();
      }
    }
  } catch (err) {
    send({ type: 'error', message: String(err) });
  }
  done();
});
