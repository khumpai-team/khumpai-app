import { Router } from 'express';
import { AzureOpenAI } from 'openai';
import { eq, desc } from 'drizzle-orm';
import { env } from '../env.js';
// Shared tool schemas (pure data, no front-end runtime deps).
import { FOUNDRY_TOOL_DEFINITIONS } from '../../../src/agent/foundryConfig';
import { db, schema } from '../db/client.js';
import { buildAgentMessages } from './buildMessages.js';

export const agentRoute = Router();

const DEMO_PERSON = 'carlos';

/** Compact Spanish patient-context block from the DB (recent state). Best-effort. */
async function buildPatientContext(): Promise<string> {
  const [person] = await db.select().from(schema.persons).where(eq(schema.persons.id, DEMO_PERSON));
  const recentGlucose = await db
    .select()
    .from(schema.logs)
    .where(eq(schema.logs.type, 'glucose'))
    .orderBy(desc(schema.logs.timestamp))
    .limit(2);
  const [med] = await db.select().from(schema.medications).where(eq(schema.medications.personId, DEMO_PERSON));
  const lines: string[] = [`Paciente: ${person?.name ?? 'el paciente'}.`];
  if (recentGlucose.length) {
    const g = recentGlucose
      .map((r) => {
        const p = r.payload as { value?: number; moment?: string };
        return `${p.value} (${p.moment})`;
      })
      .join(', ');
    lines.push(`Últimas lecturas de azúcar: ${g}.`);
  }
  if (med) lines.push(`Medicamento: ${med.name} ${med.dose}, horario ${(med.schedule as string[]).join(' y ')}.`);
  return lines.join('\n');
}

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

  const history = ((req.body?.messages ?? []) as Array<{ role: string; content: string | null }>).filter(
    (m) => m.role !== 'system',
  );
  let patientContext = '';
  try {
    patientContext = await buildPatientContext();
  } catch {
    /* context is best-effort; proceed without it */
  }
  const messages = buildAgentMessages({ history, patientContext, nowIso: new Date().toISOString() });

  try {
    const client = new AzureOpenAI({
      endpoint: env.AZURE_OPENAI_ENDPOINT,
      apiKey: env.AZURE_OPENAI_API_KEY,
      apiVersion: env.AZURE_OPENAI_API_VERSION,
      deployment: env.AZURE_OPENAI_DEPLOYMENT,
    });
    const createStream = (strict: boolean) => {
      // Spec 2 scope: the model only drives the diary builder, so expose ONLY
      // registerEntry. Exposing the other tools let the model call them and the
      // client tool-router error on the unscoped calls.
      const diaryTools = FOUNDRY_TOOL_DEFINITIONS.filter(
        (t) => t.function.name === 'registerEntry',
      );
      const tools = strict
        ? diaryTools
        : // eslint-disable-next-line @typescript-eslint/no-explicit-any -- strip strict for fallback
          diaryTools.map((t: any) => ({ ...t, function: { ...t.function, strict: false } }));
      return client.chat.completions.create({
        model: env.AZURE_OPENAI_DEPLOYMENT,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- looser shapes than SDK unions
        messages: messages as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON-schema tool literals
        tools: tools as any,
        stream: true,
      });
    };
    // Strict structured-output / anyOf may not be supported on every model+API
    // version — fall back to non-strict on a 400 (client Zod still validates).
    let stream: Awaited<ReturnType<typeof createStream>>;
    try {
      stream = await createStream(true);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- inspect HTTP status
      if ((err as any)?.status === 400) stream = await createStream(false);
      else throw err;
    }

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
