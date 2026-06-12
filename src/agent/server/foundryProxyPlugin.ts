/**
 * foundryProxyPlugin.ts — Vite dev-server middleware that proxies
 * chat.completions streaming calls to Azure AI Foundry.
 *
 * Node-only. Never imported by browser code.
 *
 * POST /api/foundry/chat
 *   Body: { messages: ChatMessage[] }
 *   Response: SSE stream of AgentSSEEvent objects
 */

import type { Plugin } from 'vite';
import { loadEnv } from 'vite';
import { AzureOpenAI } from 'openai';
import { KHUMPI_SYSTEM_PROMPT, FOUNDRY_TOOL_DEFINITIONS } from '../foundryConfig';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: string;
  content: string | null;
  tool_calls?: unknown;
  tool_call_id?: string;
  name?: string;
}

interface ToolCallAccumulator {
  id: string;
  name: string;
  arguments: string;
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export function foundryProxyPlugin(): Plugin {
  return {
    name: 'foundry-proxy',

    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '');
      const endpoint = env['AZURE_OPENAI_ENDPOINT'];
      const apiKey = env['AZURE_OPENAI_API_KEY'];
      const deployment = env['AZURE_OPENAI_DEPLOYMENT'];
      const apiVersion = env['AZURE_OPENAI_API_VERSION'] || '2024-12-01-preview';

      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'POST' || req.url !== '/api/foundry/chat') {
          next();
          return;
        }

        // Set SSE headers immediately so the client can start reading
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.flushHeaders?.();

        const writeEvent = (obj: Record<string, unknown>): void => {
          res.write(`data: ${JSON.stringify(obj)}\n\n`);
        };

        const done = (): void => {
          writeEvent({ type: 'done' });
          res.end();
        };

        // --- Config check ---------------------------------------------------
        if (!endpoint || !apiKey || !deployment) {
          writeEvent({
            type: 'error',
            message:
              'Azure OpenAI not configured: set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY and AZURE_OPENAI_DEPLOYMENT in .env',
          });
          done();
          return;
        }

        // --- Collect request body ------------------------------------------
        let body = '';
        try {
          await new Promise<void>((resolve, reject) => {
            req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
            req.on('end', resolve);
            req.on('error', reject);
          });
        } catch (err) {
          writeEvent({ type: 'error', message: `Failed to read request body: ${String(err)}` });
          done();
          return;
        }

        let messages: ChatMessage[];
        try {
          const parsed = JSON.parse(body) as { messages: ChatMessage[] };
          messages = parsed.messages ?? [];
        } catch (err) {
          writeEvent({ type: 'error', message: `Invalid JSON body: ${String(err)}` });
          done();
          return;
        }

        // Prepend system message (with current date/time context) if not present
        if (messages.length === 0 || messages[0].role !== 'system') {
          const nowContext =
            `\n\n## Current context\n` +
            `The current date and time is ${new Date().toISOString()}. ` +
            `Use it for every timestamp; for relative phrases like "esta mañana", "ayer", or "anoche", ` +
            `compute the timestamp from this current date — never invent a year.`;
          messages = [{ role: 'system', content: KHUMPI_SYSTEM_PROMPT + nowContext }, ...messages];
        }

        // --- Build Azure OpenAI client (key auth) & stream ------------------
        try {
          const client = new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment });

          const stream = await client.chat.completions.create({
            model: deployment,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- our ChatMessage shape is looser than the SDK's strict param union
            messages: messages as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tool defs are JSON-schema literals
            tools: FOUNDRY_TOOL_DEFINITIONS as any,
            stream: true,
          });

          // Accumulate tool-call fragments by index
          const toolCallMap = new Map<number, ToolCallAccumulator>();

          for await (const chunk of stream as AsyncIterable<unknown>) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- OpenAI streaming chunk, shape verified in spec
            const c = chunk as any;
            const choice = c?.choices?.[0];
            if (!choice) continue;

            const delta = choice.delta;
            const finishReason: string | null = choice.finish_reason ?? null;

            // Text delta
            if (typeof delta?.content === 'string' && delta.content.length > 0) {
              writeEvent({ type: 'text', delta: delta.content });
            }

            // Tool-call deltas — accumulate fragments by index
            if (Array.isArray(delta?.tool_calls)) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- streaming tool_call delta shape
              for (const tc of delta.tool_calls as any[]) {
                const idx: number = tc.index ?? 0;
                if (!toolCallMap.has(idx)) {
                  toolCallMap.set(idx, { id: tc.id ?? '', name: tc.function?.name ?? '', arguments: '' });
                }
                const acc = toolCallMap.get(idx)!;
                if (tc.id) acc.id = tc.id;
                if (tc.function?.name) acc.name = tc.function.name;
                if (typeof tc.function?.arguments === 'string') {
                  acc.arguments += tc.function.arguments;
                }
              }
            }

            // On finish: flush accumulated tool calls
            if (finishReason === 'tool_calls' || finishReason === 'stop') {
              if (toolCallMap.size > 0) {
                const toolCalls = Array.from(toolCallMap.entries())
                  .sort(([a], [b]) => a - b)
                  .map(([, acc]) => {
                    let parsed: unknown = {};
                    try {
                      parsed = JSON.parse(acc.arguments || '{}');
                    } catch {
                      parsed = {};
                    }
                    return { id: acc.id, name: acc.name, arguments: parsed };
                  });
                writeEvent({ type: 'tool_calls', toolCalls });
                toolCallMap.clear();
              }
            }
          }
        } catch (err) {
          writeEvent({ type: 'error', message: String(err) });
        }

        done();
      });
    },
  };
}
