---
id: task-17.8
title: 'Phase 3.2: Grok API Integration with Tool Calling'
status: To Do
assignee: []
created_date: '2026-01-10 06:45'
labels:
  - phase-3
  - ai
  - grok
  - api
dependencies:
  - task-17.7
parent_task_id: task-17
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Integrate xAI's Grok API with tool calling for the AI assistant.

## xAI Grok API
```
Endpoint: https://api.x.ai/v1/chat/completions
Model: grok-3 (compound), grok-3-mini (fast)
```

## GrokClient Class

```typescript
// src/ai/grok-client.ts
export class GrokClient {
  private config: GrokConfig;
  private history: Message[] = [];
  
  async chat(message: string, context: AIContext): Promise<ChatResponse>;
  async *streamChat(message: string, context: AIContext): AsyncGenerator<Chunk>;
  private buildSystemPrompt(context: AIContext): string;
  private getToolDefinitions(): ToolDefinition[];
  private executeToolCalls(calls: ToolCall[]): Promise<ToolResult[]>;
  clearHistory(): void;
}
```

## Tool Definitions

```typescript
const tools = [
  { name: 'create_step', params: { name, objectiveId? } },
  { name: 'edit_objective', params: { objectiveId, name?, description? } },
  { name: 'edit_priority', params: { priorityId, objectiveId, name?, description? } },
  { name: 'complete_step', params: { stepId, objectiveId } },
  { name: 'query_events', params: { query, dateRange?, eventTypes? } },
  { name: 'get_deep_work_analysis', params: { period, objectiveId? } }
];
```

## Tool Handlers

Each tool handler:
1. Validates arguments
2. Creates appropriate event(s)
3. Appends to EventStore
4. Applies to Projector
5. Returns result for AI to interpret

## System Prompt Structure

```
You are an AI assistant in Objectiv.go...

## Current Context
[Injected from ContextBuilder]

## Capabilities
- Answer questions about objectives and progress
- Create/edit/complete objectives, priorities, steps
- Analyze behavioral patterns
- Query event history

## Guidelines
- Be concise and actionable
- Reference specific data
- Use tools for modifications
- Be transparent about data
```

## API Key Security

Store in Electron's safeStorage (encrypted keychain).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 GrokClient with chat() and streamChat() methods
- [ ] #2 System prompt includes full context
- [ ] #3 6 tool definitions (create_step, edit_objective, edit_priority, complete_step, query_events, get_deep_work_analysis)
- [ ] #4 Tool execution emits proper events
- [ ] #5 Streaming for real-time UI
- [ ] #6 Conversation history management
- [ ] #7 API key in Electron safeStorage
- [ ] #8 Error handling with retry
- [ ] #9 Rate limiting
- [ ] #10 Model selection (grok-3 vs grok-3-mini)
<!-- AC:END -->
