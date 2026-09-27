import { z } from '$lib/validation';

export const DEFAULT_SEARCH_SETTINGS = {
  maxRandomAttempts: 1000,
  randomTimeLimitMs: 400,
} as const;

export const searchSettingsSchema = z.object({
  maxRandomAttempts: z.int().min(0).max(100_000),
  randomTimeLimitMs: z.int().min(0).max(60_000),
});

export type SearchSettings = z.infer<typeof searchSettingsSchema>;

export type SearchProgress = {
  boardsChecked: number;
  elapsedMs: number;
  minesPlaced: number;
  phase: 'random' | 'iterative';
};
