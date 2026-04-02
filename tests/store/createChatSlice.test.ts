import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createChatSlice, ChatSlice } from '../../store/slices/createChatSlice';

/**
 * **Feature: chatvip-upgrade, Property 2: Web Search State Toggle**
 * 
 * *For any* initial state of isWebSearchEnabled, calling toggleWebSearch 
 * SHALL result in the opposite boolean value.
 * 
 * **Validates: Requirements 2.2**
 */
describe('ChatSlice - toggleWebSearch Property Tests', () => {
  it('Property 2: toggleWebSearch should always toggle isWebSearchEnabled to opposite value', () => {
    fc.assert(
      fc.property(fc.boolean(), (initialState) => {
        // Create a mock state object
        let state: Pick<ChatSlice, 'isWebSearchEnabled'> = {
          isWebSearchEnabled: initialState,
        };

        // Create a mock set function that captures state updates
        const mockSet = (updater: (s: typeof state) => Partial<typeof state>) => {
          const updates = updater(state);
          state = { ...state, ...updates };
        };

        // Create the slice with our mock set
        const slice = createChatSlice(
          mockSet as any,
          () => state as any,
          {} as any
        );

        // Override the initial state
        state.isWebSearchEnabled = initialState;

        // Call toggleWebSearch
        slice.toggleWebSearch();

        // Property: result should be the opposite of initial state
        return state.isWebSearchEnabled === !initialState;
      }),
      { numRuns: 100 }
    );
  });

  it('Property 2: toggleWebSearch twice should return to original state', () => {
    fc.assert(
      fc.property(fc.boolean(), (initialState) => {
        let state: Pick<ChatSlice, 'isWebSearchEnabled'> = {
          isWebSearchEnabled: initialState,
        };

        const mockSet = (updater: (s: typeof state) => Partial<typeof state>) => {
          const updates = updater(state);
          state = { ...state, ...updates };
        };

        const slice = createChatSlice(
          mockSet as any,
          () => state as any,
          {} as any
        );

        state.isWebSearchEnabled = initialState;

        // Toggle twice
        slice.toggleWebSearch();
        slice.toggleWebSearch();

        // Property: double toggle should return to original state (idempotence of double application)
        return state.isWebSearchEnabled === initialState;
      }),
      { numRuns: 100 }
    );
  });
});
