// TODO: VERIFY SDK API against current Azure docs before first run — this is a minimal stand-in declaration.
// This file provides just enough type information so that FoundryAgentProvider.ts compiles
// without the @azure/ai-projects package installed. The actual SDK is loaded at runtime
// via dynamic import inside a try/catch in FoundryAgentProvider.

declare module '@azure/ai-projects' {
  // ---------------------------------------------------------------------------
  // Client creation
  // ---------------------------------------------------------------------------

  export interface AIProjectClientOptions {
    /** Azure credential or API key. */
    credential?: unknown;
  }

  export interface AgentStreamEvent {
    /** Discriminator field for streamed events. */
    event: string;
    data: unknown;
  }

  export interface AgentRunStream extends AsyncIterable<AgentStreamEvent> {
    done(): Promise<void>;
  }

  export interface ToolDefinition {
    type: string;
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }

  export interface CreateAgentOptions {
    name?: string;
    description?: string;
    instructions?: string;
    tools?: ToolDefinition[];
    /** Optional when the model is passed as the first positional arg to createAgent(). */
    model?: string;
  }

  export interface AgentThreadMessage {
    role: string;
    content: string;
  }

  export interface CreateRunOptions {
    additionalInstructions?: string;
    toolChoice?: string | Record<string, unknown>;
  }

  export interface Agent {
    id: string;
    name?: string;
  }

  export interface AgentThread {
    id: string;
  }

  export interface AgentsOperations {
    createAgent(model: string, options?: CreateAgentOptions): Promise<Agent>;
    createThread(): Promise<AgentThread>;
    createMessage(
      threadId: string,
      role: string,
      content: string
    ): Promise<AgentThreadMessage>;
    createRunStream(
      threadId: string,
      agentId: string,
      options?: CreateRunOptions
    ): AgentRunStream;
  }

  // ---------------------------------------------------------------------------
  // Main client class
  // ---------------------------------------------------------------------------

  export class AIProjectClient {
    constructor(connectionString: string, credential: unknown, options?: AIProjectClientOptions);
    readonly agents: AgentsOperations;
  }
}
