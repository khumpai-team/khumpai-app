// tests/notifAchievement.test.ts
import { describe, it, expect } from 'vitest';
import { occasionalAchievementReminder } from '@/lib/notifications/achievement';
import { SEED_STATE } from '@/data/seed';
import type { AppState, Achievement } from '@/types';

const NOW = new Date('2026-06-12T18:00:00');

function ach(): Achievement {
  // Minimal shape; spread over a seed achievement if the type needs more fields.
  return { ...SEED_STATE.achievements[0] } as Achievement;
}

function state(achievements: Achievement[]): AppState {
  return { ...SEED_STATE, achievements, currentPersonId: 'carlos' };
}

describe('occasionalAchievementReminder', () => {
  it('nudges at most once per day when there are achievements', () => {
    const out = occasionalAchievementReminder(state([ach()]), NOW);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('achievement');
    expect(out[0].severity).toBe('info');
    expect(out[0].dedupeKey).toBe('achievement:2026-06-12');
  });

  it('stays silent when there are no achievements', () => {
    expect(occasionalAchievementReminder(state([]), NOW)).toHaveLength(0);
  });
});
