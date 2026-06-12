/**
 * The single place the app gets its agent from. Swap the implementation here
 * (e.g. VITE_AGENT_PROVIDER=foundry) and nothing in the UI changes.
 *
 * Default: MockAgentProvider (no credentials required).
 * Set VITE_AGENT_PROVIDER=foundry in .env to activate Azure AI Foundry.
 */

import type { AgentProvider } from './AgentProvider';
import { MockAgentProvider } from './MockAgentProvider';
import { FoundryAgentProvider } from './FoundryAgentProvider';

export const agent: AgentProvider =
  import.meta.env.VITE_AGENT_PROVIDER === 'foundry'
    ? new FoundryAgentProvider()
    : new MockAgentProvider();

export * from './AgentProvider';
