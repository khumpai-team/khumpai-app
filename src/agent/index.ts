/**
 * The single place the app gets its agent from. Swap the implementation here
 * (e.g. `new FoundryAgentProvider(...)`) and nothing in the UI changes.
 */

import type { AgentProvider } from './AgentProvider';
import { MockAgentProvider } from './MockAgentProvider';

export const agent: AgentProvider = new MockAgentProvider();

export * from './AgentProvider';
