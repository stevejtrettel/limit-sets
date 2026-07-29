/**
 * The appendix figure set — the EIGHT open cases of the degree-5 orthogonal
 * atlas, and nothing else.
 *
 * Seven are the O(3,2) data of Table 2 of Bajpai–Nitsche (labelled T2.1…T2.7
 * there), which this paper proves ARITHMETIC; the eighth is the remaining
 * O(4,1) case, proved THIN. Checked against `./degree5-orthogonal.ts`: these
 * eight are EXACTLY the atlas rows carrying `status: 'open'` — all of them, and
 * nothing else. So this list is the complete unresolved set, not a selection.
 *
 * THE ATLAS IS NOT EDITED. `degree5-orthogonal.ts` continues to report all eight
 * as `open`, and will until this paper is published; `o5-explorer` is unaffected.
 * The arithmetic/thin labels here are this paper's CLAIM, carried in this module
 * only. The demo shows both side by side and says which is which, so a reader
 * never mistakes the claim for the published classification.
 *
 * Kept deliberately separate from `./paperFigures.ts` (the Sp(6) figure set).
 * Those are degree-6 symplectic groups walked on the 4-letter free alphabet
 * {A, A⁻¹, B, B⁻¹}; these are degree-5 orthogonal groups walked on the 3-letter
 * free-product alphabet {T, B, B⁻¹}, in RP⁴ rather than RP⁵. Merging the two
 * would mean making the figure record carry its dimension, alphabet, seed word
 * and palette — a lot of machinery to put two incomparable things in one table.
 * Two small modules cost less and keep each one honest.
 *
 * No (α, β) is duplicated here: every figure names an atlas id and resolves
 * against the catalog.
 *
 * SEEDING. Every figure uses the same pinned word γ = B⁻¹TBT, so the pictures
 * are reproducible from the text alone. It is the SHORTEST word over {T, B, B⁻¹}
 * whose spectral gap |λ₁/λ₂| clears APPENDIX_MIN_GAP on all eight groups
 * (measured: 69.9 at the worst, g77, up to 441 at g52). It also has a structural
 * reading — B⁻¹TBT = (B⁻¹TB)·T is a product of two conjugate reflections, the
 * element type the Zariski-density argument turns on. The auto-search is not
 * used: a pinned word is what makes a figure reproducible.
 */

import {
  CATALOG_EXAMPLES, ORTHOGONAL_DEGREE5_WALK, type OrthogonalExample,
} from './degree5-orthogonal.ts';
import { hypergeometricAction, WALK_LABELS } from './recipe.ts';
import { seedFromWord, wordEigenvalues, type Seed } from '../../core/seed.ts';
import { complexAbs } from '../../core/linalg.ts';
import type { GroupAction } from '../../core/group.ts';

/**
 * What THIS paper proves about a figure.
 *
 * Not to be confused with the atlas's `status`, which stays `open` for all eight
 * until the paper is published — both are shown in the panel, labelled, so the
 * claim is never mistaken for the published classification.
 */
export type AppendixRow = 'arithmetic' | 'thin';

export interface AppendixFigure {
  /** Stable id — keys the saved view preset, so do not rename casually. */
  id: string;
  /** Panel label: the paper's own name for the case. */
  label: string;
  /** What this paper proves. */
  row: AppendixRow;
  /** Atlas id in ./degree5-orthogonal.ts, e.g. 'g52'. */
  from: string;
  /** The cyclotomic factorisation (f_α, g_β), as printed in the paper's table. */
  factors: string;
}

/**
 * γ = B⁻¹TBT in apply-order generator codes over {T, B, B⁻¹} = {0, 1, 2}:
 * apply T, then B, then T, then B⁻¹ — the reversed product is B⁻¹·T·B·T.
 */
export const APPENDIX_SEED_WORD: readonly number[] = [0, 1, 0, 2];
export const APPENDIX_SEED_NAME = 'B⁻¹TBT';

/** The spectral gap |λ₁/λ₂| every figure is expected to clear. Same standard
 *  the Sp(6) figure set uses, so the two are held to one bar. */
export const APPENDIX_MIN_GAP = 10;

export const FIGURES: readonly AppendixFigure[] = [
  // The seven O(3,2) data of Bajpai–Nitsche Table 2 — arithmetic.
  { id: 't2-1', label: 'T2.1', row: 'arithmetic', from: 'g52', factors: '((x−1)⁵, Φ₂Φ₃²)' },
  { id: 't2-2', label: 'T2.2', row: 'arithmetic', from: 'g53', factors: '((x−1)⁵, Φ₂Φ₃Φ₄)' },
  { id: 't2-3', label: 'T2.3', row: 'arithmetic', from: 'g55', factors: '((x−1)⁵, Φ₂Φ₄Φ₆)' },
  { id: 't2-4', label: 'T2.4', row: 'arithmetic', from: 'g61', factors: '((x−1)³Φ₄, Φ₂Φ₃²)' },
  { id: 't2-5', label: 'T2.5', row: 'arithmetic', from: 'g63', factors: '((x−1)³Φ₆, Φ₂Φ₃²)' },
  { id: 't2-6', label: 'T2.6', row: 'arithmetic', from: 'g64', factors: '((x−1)³Φ₆, Φ₂Φ₃Φ₄)' },
  { id: 't2-7', label: 'T2.7', row: 'arithmetic', from: 'g66', factors: '((x−1)Φ₁₀, Φ₂Φ₃²)' },

  // The O(4,1) case — thin.
  { id: 'o41', label: 'O(4,1)', row: 'thin', from: 'g77', factors: '((x−1)Φ₁₀, Φ₂Φ₅)' },
];

/** Dropdown group headers — the paper's claim only. The ambient group and atlas
 *  number go on each option, which has to stand alone when the select is closed. */
export const ROW_TITLES: Record<AppendixRow, string> = {
  arithmetic: 'arithmetic',
  thin:       'thin',
};

// ─── Resolution ─────────────────────────────────────────────────────────────

/** The atlas row behind a figure. */
export function figureExample(fig: AppendixFigure): OrthogonalExample {
  const ex = CATALOG_EXAMPLES.find((e) => e.id === fig.from);
  if (!ex) throw new Error(`appendix figure ${fig.id}: no atlas group with id ${fig.from}`);
  return ex;
}

export function figureAction(fig: AppendixFigure): GroupAction {
  const ex = figureExample(fig);
  return hypergeometricAction(ex.alpha, ex.beta, ORTHOGONAL_DEGREE5_WALK);
}

export interface AppendixSeed extends Seed {
  /** |λ₁/λ₂| for γ — the quantity APPENDIX_MIN_GAP is measured against. */
  gap: number;
  /** True if `gap` cleared APPENDIX_MIN_GAP. */
  meetsGap: boolean;
}

/**
 * Seed a figure from the pinned γ = B⁻¹TBT, computing the true spectral gap
 * |λ₁/λ₂| from its full spectrum — so a slow-converging basepoint is caught
 * while curating rather than after rendering.
 */
export function seedAppendixFigure(action: GroupAction): AppendixSeed {
  const s = seedFromWord(action, APPENDIX_SEED_WORD, {
    name: APPENDIX_SEED_NAME,
    labels: WALK_LABELS[ORTHOGONAL_DEGREE5_WALK],
  });
  const mods = wordEigenvalues(action, APPENDIX_SEED_WORD).map(complexAbs);
  const gap = mods.length > 1 && mods[1] > 0 ? mods[0] / mods[1] : Infinity;
  return { ...s, gap, meetsGap: gap >= APPENDIX_MIN_GAP };
}

export function figureById(id: string): AppendixFigure {
  const fig = FIGURES.find((f) => f.id === id);
  if (!fig) throw new Error(`unknown appendix figure id: ${id}`);
  return fig;
}
