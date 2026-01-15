---
id: task-17.9
title: 'Phase 4: Chat UI Integration'
status: To Do
assignee: []
created_date: '2026-01-10 06:46'
labels:
  - phase-4
  - ui
  - chat
dependencies:
  - task-17.8
parent_task_id: task-17
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the chat interface for the AI assistant within the app.

## UI Layout

```
┌────────────────────────────────────────────────────────────────┐
│  Objectiv                                           [─][□][×]  │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌─────────────┐  ┌──────────────────────────────────────────┐ │
│  │ Objectives  │  │ Current Objective                        │ │
│  │             │  │                                          │ │
│  │ ○ Ship MVP  │  │ Priorities, Steps...                     │ │
│  │ ○ Learn Rust│  │                                          │ │
│  │             │  │                                          │ │
│  └─────────────┘  └──────────────────────────────────────────┘ │
│                                                                │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ 💬 AI Assistant                              [context] [×] ││
│  ├────────────────────────────────────────────────────────────┤│
│  │ You: What should I focus on today?                        ││
│  │                                                            ││
│  │ Grok: Based on your patterns, mornings are your best...   ││
│  │       I suggest starting with "Fix auth bug" on Ship MVP. ││
│  │       [Create Step: "Fix auth bug"]                       ││
│  │                                                            ││
│  ├────────────────────────────────────────────────────────────┤│
│  │ [Ask anything...                               ] [Send]   ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                │
│  [shortcuts]                                                   │
└────────────────────────────────────────────────────────────────┘
```

## Chat Panel Component

```typescript
// src/components/chat-panel.ts

export class ChatPanel {
  private container: HTMLElement;
  private messagesEl: HTMLElement;
  private inputEl: HTMLInputElement;
  private grokClient: GrokClient;
  private contextBuilder: ContextBuilder;
  
  constructor(options: ChatPanelOptions) {
    this.grokClient = options.grokClient;
    this.contextBuilder = options.contextBuilder;
    this.render();
  }
  
  private render(): void {
    this.container = document.createElement('div');
    this.container.className = 'chat-panel';
    this.container.innerHTML = `
      <div class="chat-header">
        <span class="chat-title">💬 AI Assistant</span>
        <button class="chat-context-btn" title="View context">context</button>
        <button class="chat-close-btn">×</button>
      </div>
      <div class="chat-messages"></div>
      <div class="chat-input-row">
        <input type="text" class="chat-input" placeholder="Ask anything..." />
        <button class="chat-send-btn">Send</button>
      </div>
    `;
    
    this.messagesEl = this.container.querySelector('.chat-messages')!;
    this.inputEl = this.container.querySelector('.chat-input')!;
    
    this.setupEventListeners();
  }
  
  private setupEventListeners(): void {
    // Send on Enter
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    
    // Send button
    this.container.querySelector('.chat-send-btn')!
      .addEventListener('click', () => this.sendMessage());
    
    // Context viewer
    this.container.querySelector('.chat-context-btn')!
      .addEventListener('click', () => this.showContext());
    
    // Close
    this.container.querySelector('.chat-close-btn')!
      .addEventListener('click', () => this.toggle(false));
  }
  
  async sendMessage(): Promise<void> {
    const message = this.inputEl.value.trim();
    if (!message) return;
    
    // Add user message
    this.addMessage('user', message);
    this.inputEl.value = '';
    
    // Show typing indicator
    const typingEl = this.addTypingIndicator();
    
    try {
      // Build context
      const context = await this.contextBuilder.buildContext({ maxTokens: 4000 });
      
      // Stream response
      let responseText = '';
      const responseEl = this.addMessage('assistant', '');
      
      for await (const chunk of this.grokClient.streamChat(message, context)) {
        if (chunk.type === 'content') {
          responseText += chunk.content;
          responseEl.innerHTML = this.formatMessage(responseText);
        } else if (chunk.type === 'tool_call') {
          this.handleToolCall(chunk.toolCall, responseEl);
        }
      }
      
      typingEl.remove();
      
    } catch (error) {
      typingEl.remove();
      this.addMessage('error', `Error: ${error.message}`);
    }
  }
  
  private addMessage(role: string, content: string): HTMLElement {
    const el = document.createElement('div');
    el.className = `chat-message chat-message-${role}`;
    el.innerHTML = this.formatMessage(content);
    this.messagesEl.appendChild(el);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    return el;
  }
  
  private formatMessage(content: string): string {
    // Parse markdown, highlight code, render tool actions
    return marked.parse(content);
  }
  
  private handleToolCall(toolCall: ToolCall, responseEl: HTMLElement): void {
    // Show tool execution UI
    const toolEl = document.createElement('div');
    toolEl.className = 'chat-tool-call';
    toolEl.innerHTML = `
      <span class="tool-icon">⚡</span>
      <span class="tool-name">${this.formatToolName(toolCall.function.name)}</span>
      <span class="tool-status">executing...</span>
    `;
    responseEl.appendChild(toolEl);
  }
  
  private async showContext(): Promise<void> {
    const context = await this.contextBuilder.buildContext();
    const formatted = formatContextForPrompt(context);
    
    // Show in modal
    showModal({
      title: 'AI Context',
      content: `<pre>${escapeHtml(formatted)}</pre>
                <div class="context-meta">
                  ~${context.meta.tokenEstimate} tokens
                </div>`,
      className: 'context-modal'
    });
  }
  
  toggle(show?: boolean): void {
    const visible = show ?? !this.container.classList.contains('visible');
    this.container.classList.toggle('visible', visible);
    if (visible) this.inputEl.focus();
  }
}
```

## Keyboard Shortcuts

```typescript
// Cmd+K or Ctrl+K to toggle chat
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    chatPanel.toggle();
  }
});
```

## Quick Actions

When AI suggests actions, show clickable buttons:

```html
<div class="chat-actions">
  <button class="action-btn" data-action="create_step" data-args='{"name":"Fix auth"}'>
    Create Step: "Fix auth"
  </button>
  <button class="action-btn secondary" data-action="dismiss">
    Dismiss
  </button>
</div>
```

## Settings Panel

```html
<div class="ai-settings">
  <h3>AI Assistant</h3>
  <div class="setting-row">
    <label>API Key</label>
    <input type="password" id="grok-api-key" />
    <button id="save-api-key">Save</button>
  </div>
  <div class="setting-row">
    <label>Model</label>
    <select id="grok-model">
      <option value="grok-3">Grok 3 (Best)</option>
      <option value="grok-3-mini">Grok 3 Mini (Fast)</option>
    </select>
  </div>
</div>
```
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Collapsible chat panel in main UI
- [ ] #2 Message history with user/assistant distinction
- [ ] #3 Streaming response display
- [ ] #4 Tool call visualization (executing, completed)
- [ ] #5 Context viewer modal (transparency)
- [ ] #6 Quick action buttons for AI suggestions
- [ ] #7 Keyboard shortcut Cmd+K to toggle
- [ ] #8 Settings for API key and model selection
- [ ] #9 Markdown rendering in responses
- [ ] #10 Error state handling
- [ ] #11 Mobile-responsive design
<!-- AC:END -->
