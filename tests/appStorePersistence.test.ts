import './helpers/polyfillStorage';
import { describe, it, expect } from 'vitest';

/**
 * Regression: persisting the whole store serialises `actions` too, and
 * JSON.stringify drops the functions inside it — so sessionStorage holds
 * `actions: {}`. On the next load the default persist merge overwrites the
 * live actions with that empty object, making `actions.addLog` (and every
 * other action) undefined. Confirming a card then throws
 * "actions.addLog is not a function" and the validation gets stuck.
 */
describe('appStore — actions survive rehydration', () => {
  it('keeps actions callable when persisted state has a stripped actions object', async () => {
    // What sessionStorage looks like after a prior session persisted the store:
    // every function inside `actions` is gone, leaving an empty object.
    sessionStorage.setItem(
      'khumpai-app',
      JSON.stringify({ state: { logs: [], actions: {} }, version: 0 }),
    );

    const { useAppStore } = await import('@/store/appStore');
    await useAppStore.persist?.rehydrate?.();

    const { actions } = useAppStore.getState();
    expect(typeof actions.addLog).toBe('function');
    expect(typeof actions.upsertMedication).toBe('function');

    // And it must actually work — the confirm path calls addLog.
    expect(() =>
      actions.addLog({
        id: 'log_test',
        personId: 'p1',
        timestamp: '2026-06-12T08:00:00.000Z',
        createdAt: '2026-06-12T08:00:00.000Z',
        source: 'conversation',
        confirmed: true,
        isOfflineCapture: false,
        type: 'glucose',
        payload: { value: 110, moment: 'ayunas' },
      }),
    ).not.toThrow();
  });
});
