---
id: task-17.7
title: 'Phase 3.1: Context Builder for AI'
status: To Do
assignee: []
created_date: '2026-01-10 06:44'
labels:
  - phase-3
  - ai
  - context
dependencies:
  - task-17.3
  - task-17.4
  - task-17.6
parent_task_id: task-17
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the context aggregation layer that prepares data for the AI assistant.

## Purpose

The AI needs rich context but within token limits. This module builds an optimized context package.

## Context Package Structure

```typescript
interface AIContext {
  // Current focus
  currentObjective: {
    id: string;
    name: string;
    description: string;
    createdAt: string;
    priorities: Priority[];
    recentSteps: Step[];          // Last 10 steps
    stats: {
      totalSteps: number;
      completedSteps: number;
      totalTimeMinutes: number;
      avgDeepWorkScore: number;
    };
  };
  
  // Behavioral context
  recentActivity: {
    today: DailySummary;
    thisWeek: WeekSummary;
    patterns: {
      bestHours: string[];          // "9am-11am"
      worstHours: string[];
      topDistractors: string[];
      avgSessionLength: number;
    };
  };
  
  // Historical context
  allObjectives: {
    id: string;
    name: string;
    stepsCount: number;
    lastActivity: string;
  }[];
  
  // User's inbox/ideas
  inbox: InboxItem[];
  
  // Metadata
  meta: {
    timestamp: string;
    tokenEstimate: number;
    dataCompleteness: number;       // 0-100
  };
}
```

## Context Builder Implementation

```typescript
// src/ai/context-builder.ts

export class ContextBuilder {
  private eventIndex: EventIndex;
  private projector: Projector;
  
  constructor(eventIndex: EventIndex, projector: Projector) {
    this.eventIndex = eventIndex;
    this.projector = projector;
  }
  
  /**
   * Build full context for AI
   */
  async buildContext(options: ContextOptions = {}): Promise<AIContext> {
    const state = this.projector.getState();
    const currentObj = state.objectives[state.selectedObjectiveIndex];
    
    const context: AIContext = {
      currentObjective: await this.buildObjectiveContext(currentObj),
      recentActivity: await this.buildActivityContext(),
      allObjectives: this.buildObjectivesSummary(state.objectives),
      inbox: state.inbox || [],
      meta: {
        timestamp: new Date().toISOString(),
        tokenEstimate: 0,
        dataCompleteness: this.calculateCompleteness()
      }
    };
    
    context.meta.tokenEstimate = this.estimateTokens(context);
    
    // Trim if over budget
    if (options.maxTokens && context.meta.tokenEstimate > options.maxTokens) {
      return this.trimContext(context, options.maxTokens);
    }
    
    return context;
  }
  
  /**
   * Build context for specific objective
   */
  private async buildObjectiveContext(obj: Objective): Promise<AIContext['currentObjective']> {
    if (!obj) return null;
    
    const events = await this.eventIndex.queryByObjective(obj.id, 100);
    const stats = await this.eventIndex.getObjectiveStats(obj.id);
    
    return {
      id: obj.id,
      name: obj.name,
      description: obj.description,
      createdAt: obj.createdAt,
      priorities: obj.priorities,
      recentSteps: obj.steps.slice(-10),
      stats: {
        totalSteps: stats.totalSteps,
        completedSteps: stats.completedSteps,
        totalTimeMinutes: Math.floor(stats.totalTime / 60000),
        avgDeepWorkScore: stats.avgDeepWorkScore
      }
    };
  }
  
  /**
   * Build activity context
   */
  private async buildActivityContext(): Promise<AIContext['recentActivity']> {
    const today = new Date().toISOString().split('T')[0];
    const weekStart = this.getWeekStart();
    
    const todaySummary = await this.eventIndex.getDailySummary(today);
    const weekEvents = await this.eventIndex.queryByDateRange(weekStart, today);
    
    return {
      today: todaySummary,
      thisWeek: this.aggregateWeek(weekEvents),
      patterns: await this.detectPatterns()
    };
  }
  
  /**
   * Detect behavioral patterns from history
   */
  private async detectPatterns(): Promise<AIContext['recentActivity']['patterns']> {
    const last30Days = await this.eventIndex.queryByDateRange(
      this.daysAgo(30),
      this.today()
    );
    
    // Analyze hourly productivity
    const hourlyScores = new Map<number, number[]>();
    for (const event of last30Days) {
      if (event.type === 'step.completed') {
        const hour = new Date(event.ts).getHours();
        if (!hourlyScores.has(hour)) hourlyScores.set(hour, []);
        hourlyScores.get(hour)!.push(event.data.deepWorkScore || 50);
      }
    }
    
    const hourlyAvg = [...hourlyScores.entries()]
      .map(([hour, scores]) => ({
        hour,
        avg: scores.reduce((a, b) => a + b, 0) / scores.length
      }))
      .sort((a, b) => b.avg - a.avg);
    
    // Find distractor patterns
    const appEvents = last30Days.filter(e => e.type === 'app.focused');
    const distractorCounts = new Map<string, number>();
    
    for (const event of appEvents) {
      if (DISTRACTOR_APPS.includes(event.data.app)) {
        distractorCounts.set(
          event.data.app,
          (distractorCounts.get(event.data.app) || 0) + 1
        );
      }
    }
    
    return {
      bestHours: hourlyAvg.slice(0, 3).map(h => `${h.hour}:00`),
      worstHours: hourlyAvg.slice(-3).map(h => `${h.hour}:00`),
      topDistractors: [...distractorCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([app]) => app),
      avgSessionLength: this.calculateAvgSession(last30Days)
    };
  }
  
  /**
   * Estimate token count
   */
  private estimateTokens(context: AIContext): number {
    const json = JSON.stringify(context);
    // Rough estimate: 4 chars per token
    return Math.ceil(json.length / 4);
  }
  
  /**
   * Trim context to fit token budget
   */
  private trimContext(context: AIContext, maxTokens: number): AIContext {
    // Priority: current objective > recent activity > history > inbox
    
    // Trim steps first
    if (context.currentObjective?.recentSteps.length > 5) {
      context.currentObjective.recentSteps = 
        context.currentObjective.recentSteps.slice(-5);
    }
    
    // Trim objectives list
    if (context.allObjectives.length > 10) {
      context.allObjectives = context.allObjectives.slice(0, 10);
    }
    
    // Trim inbox
    if (context.inbox.length > 5) {
      context.inbox = context.inbox.slice(0, 5);
    }
    
    context.meta.tokenEstimate = this.estimateTokens(context);
    return context;
  }
}
```

## Context Formatting for Grok

```typescript
// src/ai/context-formatter.ts

export function formatContextForPrompt(context: AIContext): string {
  let prompt = '';
  
  // Current objective section
  if (context.currentObjective) {
    prompt += `## Current Objective\n`;
    prompt += `**${context.currentObjective.name}**\n`;
    if (context.currentObjective.description) {
      prompt += `${context.currentObjective.description}\n`;
    }
    prompt += `\n### Priorities\n`;
    for (const p of context.currentObjective.priorities) {
      prompt += `- ${p.name}\n`;
    }
    prompt += `\n### Recent Steps\n`;
    for (const s of context.currentObjective.recentSteps) {
      const status = s.completedAt ? '✓' : '○';
      prompt += `${status} ${s.name}\n`;
    }
    prompt += `\n### Stats\n`;
    prompt += `- Total steps: ${context.currentObjective.stats.totalSteps}\n`;
    prompt += `- Completed: ${context.currentObjective.stats.completedSteps}\n`;
    prompt += `- Time invested: ${context.currentObjective.stats.totalTimeMinutes}min\n`;
    prompt += `- Avg deep work: ${context.currentObjective.stats.avgDeepWorkScore}/100\n`;
  }
  
  // Activity section
  prompt += `\n## Recent Activity\n`;
  prompt += `Today: ${context.recentActivity.today.totalMinutes}min, `;
  prompt += `${context.recentActivity.today.stepsCompleted} steps\n`;
  prompt += `This week: ${context.recentActivity.thisWeek.totalMinutes}min\n`;
  
  // Patterns section
  prompt += `\n## Behavioral Patterns\n`;
  prompt += `Best hours: ${context.recentActivity.patterns.bestHours.join(', ')}\n`;
  prompt += `Top distractors: ${context.recentActivity.patterns.topDistractors.join(', ') || 'none'}\n`;
  
  return prompt;
}
```
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Context package includes current objective with full detail
- [ ] #2 Recent activity summary (today, this week)
- [ ] #3 Behavioral patterns detected (best hours, distractors)
- [ ] #4 All objectives listed with summary stats
- [ ] #5 Token estimation for context size
- [ ] #6 Context trimming when over budget
- [ ] #7 Formatted output for prompt injection
- [ ] #8 Context builds in < 200ms
<!-- AC:END -->
