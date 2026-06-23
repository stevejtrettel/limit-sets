/**
 * sp6: rebuild a saved ViewPreset's projection (R⁶ → R³ chart) into a
 * ChartEmbedding. The chart math is dimension-agnostic (@/core/chart); the
 * round-trip is the shared makeEmbeddingFactory.
 */
import { makeEmbeddingFactory } from '../core/viewPreset.ts';

export const SP6_STATE_DIM = 6;
export const embeddingFromPreset = makeEmbeddingFactory(SP6_STATE_DIM);
