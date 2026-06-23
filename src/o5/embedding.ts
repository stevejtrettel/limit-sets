/**
 * o5: rebuild a saved ViewPreset's projection (R⁵ → R³ chart) into a
 * ChartEmbedding. The chart math is dimension-agnostic (@/core/chart); the
 * round-trip is the shared makeEmbeddingFactory.
 */
import { makeEmbeddingFactory } from '../core/viewPreset.ts';

export const O5_STATE_DIM = 5;
export const embeddingFromPreset = makeEmbeddingFactory(O5_STATE_DIM);
