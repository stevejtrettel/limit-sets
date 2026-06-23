/**
 * sl4r: rebuild a saved ViewPreset's projection (R⁴ → R³ chart) into a
 * ChartEmbedding for offline rendering. The chart math is dimension-agnostic
 * (@/core/chart); the round-trip is the shared makeEmbeddingFactory.
 */
import { makeEmbeddingFactory } from '../core/viewPreset.ts';

export const SL4R_STATE_DIM = 4;
export const embeddingFromPreset = makeEmbeddingFactory(SL4R_STATE_DIM);
