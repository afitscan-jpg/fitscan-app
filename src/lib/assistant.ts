// src/lib/assistant.ts
// The scoped in-app assistant. The backend answers only from the user's own
// logged data and never writes anything itself — when it wants to log, it hands
// back an `action` for the app to CONFIRM first.

import { authFetch } from './api';

export type ChatRole = 'user' | 'assistant';

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export interface LogFoodAction {
  type: 'log_food';
  payload: { text: string };
}

export interface LogExerciseAction {
  type: 'log_exercise';
  payload: {
    name: string;
    sets: number | null;
    reps: number | null;
    weight_kg: number | null;
  };
}

export type AssistantAction = LogFoodAction | LogExerciseAction;

export interface AssistantReply {
  reply: string;
  action: AssistantAction | null;
  source: string;
}

/** Matches the backend's MAX_MESSAGE_CHARS (it 413s above this). */
export const MAX_MESSAGE_CHARS = 500;

/** Matches the backend's MAX_HISTORY_TURNS (it trims server-side too). */
export const MAX_HISTORY_TURNS = 6;

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

// The backend already validates actions; this narrows the untyped JSON safely so
// a surprising payload renders nothing rather than crashing a bubble.
function normalizeAction(raw: unknown): AssistantAction | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as { type?: unknown; payload?: unknown };
  const payload = (a.payload ?? {}) as Record<string, unknown>;

  if (a.type === 'log_food') {
    const text = typeof payload.text === 'string' ? payload.text.trim() : '';
    return text ? { type: 'log_food', payload: { text } } : null;
  }

  if (a.type === 'log_exercise') {
    const name = typeof payload.name === 'string' ? payload.name.trim() : '';
    if (!name) return null;
    return {
      type: 'log_exercise',
      payload: {
        name,
        sets: num(payload.sets),
        reps: num(payload.reps),
        weight_kg: num(payload.weight_kg),
      },
    };
  }

  return null;
}

export async function askAssistant(
  message: string,
  history: ChatTurn[] = [],
): Promise<AssistantReply> {
  const res = await authFetch('/ai/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      history: history.slice(-MAX_HISTORY_TURNS),
    }),
  });
  if (!res.ok) throw new Error(`askAssistant failed: ${res.status}`);

  const json: { reply?: unknown; action?: unknown; source?: unknown } = await res.json();
  return {
    reply: typeof json.reply === 'string' ? json.reply : '',
    action: normalizeAction(json.action),
    source: typeof json.source === 'string' ? json.source : '',
  };
}
