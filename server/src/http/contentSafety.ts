import 'dotenv/config';
import ContentSafetyClient from '@azure-rest/ai-content-safety';
import { AzureKeyCredential } from '@azure/core-auth';
import { isUnexpected } from '@azure-rest/ai-content-safety';

/**
 * Defense-in-depth: server-side input moderation via Azure AI Content Safety.
 *
 * DORMANT when CONTENT_SAFETY_ENDPOINT / CONTENT_SAFETY_KEY are unset — returns
 * { blocked: false } so the deterministic client-side guardrails and the Azure
 * OpenAI built-in content filter remain the active layers.
 *
 * FAIL-OPEN: any network / API error also returns { blocked: false } and logs a
 * warning so chat is never broken by a monitoring outage.
 */
export async function screenInput(
  text: string,
): Promise<{ blocked: boolean; reason?: string }> {
  const endpoint = process.env.CONTENT_SAFETY_ENDPOINT;
  const key = process.env.CONTENT_SAFETY_KEY;

  // No-op: credentials not configured — rely on deterministic + model filters.
  if (!endpoint || !key) {
    return { blocked: false };
  }

  try {
    const client = ContentSafetyClient(endpoint, new AzureKeyCredential(key));

    const response = await client.path('/text:analyze').post({
      body: {
        text,
        categories: ['Hate', 'SelfHarm', 'Sexual', 'Violence'],
        outputType: 'FourSeverityLevels',
      },
    });

    if (isUnexpected(response)) {
      console.warn('[contentSafety] Unexpected API response:', response.status, response.body);
      return { blocked: false };
    }

    const blocked = response.body.categoriesAnalysis.some(
      (cat) => (cat.severity ?? 0) >= 4,
    );

    return blocked ? { blocked: true, reason: 'safety' } : { blocked: false };
  } catch (err) {
    console.warn('[contentSafety] Error calling Azure AI Content Safety — failing open:', err);
    return { blocked: false };
  }
}
