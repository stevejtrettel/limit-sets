/**
 * The figure list for the Sp(6) thinness paper — the ONLY groups the
 * `sp6-paper` demo knows about.
 *
 * Deliberately small and hand-curated. This is the paper's editorial choice, not
 * a catalog: three known-arithmetic groups, three known-thin groups, and the
 * three cases the paper resolves. The reader is meant to learn the visual
 * signature of "arithmetic" from row 1 and of "thin" from row 2, then classify
 * row 3 by eye.
 *
 * Because row 1 and row 2 teach a signature, the groups WITHIN each row should
 * be as unlike each other as the catalog allows — different α, different β
 * denominators. If a row's three examples shared a parameter, a reader could
 * attribute the shared look to that parameter rather than to the status, and the
 * row would teach nothing.
 *
 * Each figure names a group by its Bajpai–Doña–Nitsche label and resolves it
 * against ./degree6-symplectic.ts, so no (α, β) data is duplicated here. A
 * figure may instead carry explicit tuples (`alpha`/`beta`) for a group outside
 * that catalog; nothing else needs to change if you do.
 *
 * SEEDING. Every figure is seeded from the SAME word, γ = TBT with T = A⁻¹B —
 * the word the paper's §5 names. Pinning it (rather than using the auto-search)
 * is what makes the figures reproducible from the text alone. `seedPaperFigure`
 * reports |λ₁/λ₂| so a group with a weak spectral gap is caught while curating
 * rather than after rendering.
 */

import { symplecticAction, CATALOG_EXAMPLES, type SymplecticExample } from './degree6-symplectic.ts';
import type { CopyMode } from './c32-domain.ts';
import { WALK_LABELS } from './recipe.ts';
import { seedFromWord, wordEigenvalues, type Seed } from '../../core/seed.ts';
import { complexAbs } from '../../core/linalg.ts';
import type { GroupAction } from '../../core/group.ts';

/** Which panel-row a figure belongs to — the paper's three-row comparison. */
export type FigureRow = 'arithmetic' | 'thin' | 'subject' | 'domain';

export interface PaperFigure {
  /** Stable id — keys the saved view preset, so do not rename casually. */
  id: string;
  /** Panel label, e.g. 'Fig 1a'. */
  label: string;
  row: FigureRow;
  /** BDN catalog label to resolve, e.g. 'A-1'. Omit if giving α/β directly. */
  from?: string;
  /** Explicit rotation tuples, for a group outside the BDN catalog. */
  alpha?: readonly string[];
  beta?: readonly string[];
  /** One line for the figure caption / panel readout. */
  caption: string;
  /**
   * Draw this figure with the ping-pong domain ℙ(K) over the limit set.
   *
   * Only C-32 has a domain — it is the certificate its thinness proof rests on,
   * and no other figure has an analogous object. So this is set on the three
   * domain figures and nowhere else; a figure without it draws Λ alone.
   *
   * The domain is a clean convex body only in a chart where the copies are
   * BOUNDED; otherwise they cross the hyperplane at infinity and draw as two
   * truncated halves. Which chart achieves that depends on the FAMILY, so each
   * figure names its own `coord` (a `c32-domain` COORD_SYSTEMS id):
   *
   *     chart       base   rotated   nested
   *     u            1/1     1/6      6/6
   *     rosette      1/1     6/6      6/6
   *     companion    0/1     5/6      5/6
   *
   * Hence `rosette` for the rotations — it is the only system in which all six
   * Sᵏ·K are simultaneously bounded, which is exactly what it was built for —
   * and the u-basis "known-good framing" for the other two.
   */
  domain?: { copies: CopyMode; coord: string };
}

/**
 * γ = TBT, T = A⁻¹B, in apply-order generator codes over {A, A⁻¹, B, B⁻¹}
 * = {0, 1, 2, 3}: TBT = A⁻¹·B·B·A⁻¹·B.
 */
export const PAPER_SEED_WORD: readonly number[] = [1, 2, 2, 1, 2];
export const PAPER_SEED_NAME = 'TBT';

/**
 * The spectral gap |λ₁/λ₂| the paper claims for every figure (§5). Below this
 * the power iteration still converges, just more slowly, so the basepoint is
 * less trustworthy — `seedPaperFigure` flags it rather than failing.
 *
 * Note this is the RATIO of the top two eigenvalue moduli, not |λ_max| (which is
 * what BDN tabulate and what the rest of this codebase reports). The two are
 * different numbers and only the ratio governs convergence.
 */
export const PAPER_MIN_GAP = 10;

/**
 * The figures. EDIT THIS LIST — it is the whole point of the module.
 *
 * Rows 1 and 2 below are a STARTING POINT chosen for parameter spread, not a
 * final selection; they are meant to be swapped as you look at candidates. Row 3
 * is fixed: it is what the paper is about.
 */
export const FIGURES: readonly PaperFigure[] = [
  // Row 1 — known arithmetic. Spread across α and β denominators.
  { id: 'arith-1', label: 'Fig 1a', row: 'arithmetic', from: 'A-15', caption: 'arithmetic · β = (1/3,1/3,1/3,2/3,2/3,2/3)' },
  { id: 'arith-2', label: 'Fig 1b', row: 'arithmetic', from: 'A-25', caption: 'arithmetic · β from 4th roots' },
  // Copied from BDSS Table B #129 (arXiv:2003.10191). Not in the BDN catalog,
  // so the tuples are given directly. Chosen because its α has no zeros at all —
  // the other two panels in this row are maximally-unipotent (α = 0), so this
  // one keeps the row from being explainable by a shared α.
  { id: 'arith-3', label: 'Fig 1c', row: 'arithmetic',
    alpha: ['1/3', '1/3', '1/3', '2/3', '2/3', '2/3'],
    beta:  ['1/6', '5/6', '1/10', '3/10', '7/10', '9/10'],
    caption: 'arithmetic · BDSS Table B #129 · α ≠ 0' },

  // Row 2 — known thin. Spread across α (one α = 0, two α ≠ 0).
  { id: 'thin-1', label: 'Fig 2a', row: 'thin', from: 'A-1',  caption: 'thin · α = 0, β = (1/2)⁶' },
  { id: 'thin-2', label: 'Fig 2b', row: 'thin', from: 'C-2',  caption: 'thin · α from 3rd roots' },
  { id: 'thin-3', label: 'Fig 2c', row: 'thin', from: 'C-34', caption: 'thin · β from 9th roots' },

  // Row 3 — the three cases this paper resolves.
  { id: 'c47', label: 'Fig 3a', row: 'subject', from: 'C-47', caption: 'C-47 — arithmetic (Theorem 1)' },
  { id: 'c55', label: 'Fig 3b', row: 'subject', from: 'C-55', caption: 'C-55 — arithmetic (Theorem 1)' },
  { id: 'c32', label: 'Fig 3c', row: 'subject', from: 'C-32', caption: 'C-32 — thin, virtually free' },

  // Row 4 — the ping-pong domain ℙ(K) over C-32's limit set. Same group as Fig
  // 3c; what changes is which family of translates g·K is drawn.
  { id: 'dom-base', label: 'Fig 4a', row: 'domain', from: 'C-32',
    domain: { copies: 'base', coord: 'u' },
    caption: 'ℙ(K) — the domain itself' },
  { id: 'dom-rotated', label: 'Fig 4b', row: 'domain', from: 'C-32',
    domain: { copies: 'rotated', coord: 'rosette' },
    caption: 'the six rotations Sᵏ·K, k = 0…5' },
  { id: 'dom-nested', label: 'Fig 4c', row: 'domain', from: 'C-32',
    domain: { copies: 'nested', coord: 'u' },
    caption: 'their images T⁻¹Sᵏ·K — the ping-pong step' },
];

export const ROW_TITLES: Record<FigureRow, string> = {
  arithmetic: 'known arithmetic',
  thin:       'known thin',
  subject:    'resolved here',
  domain:     'C-32 ping-pong domain',
};

// ─── Resolution ─────────────────────────────────────────────────────────────

/** The (α, β) behind a figure: either the named catalog group or its own tuples. */
export function figureExample(fig: PaperFigure): SymplecticExample {
  if (fig.from) {
    const ex = CATALOG_EXAMPLES.find((e) => e.label === fig.from);
    if (!ex) throw new Error(`figure ${fig.id}: no catalog group labelled ${fig.from}`);
    return { ...ex, id: fig.id, caption: fig.caption };
  }
  if (!fig.alpha || !fig.beta) throw new Error(`figure ${fig.id}: needs either 'from' or both 'alpha' and 'beta'`);
  return { id: fig.id, label: fig.label, status: 'open', alpha: fig.alpha, beta: fig.beta, caption: fig.caption };
}

export function figureAction(fig: PaperFigure): GroupAction {
  return symplecticAction(figureExample(fig));
}

export interface PaperSeed extends Seed {
  /** |λ₁/λ₂| for γ = TBT — the quantity §5 claims is ≥ PAPER_MIN_GAP. */
  gap: number;
  /** True if `gap` cleared PAPER_MIN_GAP, i.e. the figure is at paper grade. */
  meetsGap: boolean;
}

/**
 * Seed a figure from the pinned γ = TBT — NOT the auto-search, so every figure
 * uses the word the paper names. Computes the true spectral gap |λ₁/λ₂| from
 * TBT's full spectrum, so a slow-converging basepoint is caught while curating
 * rather than after rendering.
 */
export function seedPaperFigure(action: GroupAction): PaperSeed {
  const s = seedFromWord(action, PAPER_SEED_WORD, {
    name: PAPER_SEED_NAME,
    labels: WALK_LABELS.free,
  });
  // wordEigenvalues returns moduli in descending order.
  const mods = wordEigenvalues(action, PAPER_SEED_WORD).map(complexAbs);
  const gap = mods.length > 1 && mods[1] > 0 ? mods[0] / mods[1] : Infinity;
  return { ...s, gap, meetsGap: gap >= PAPER_MIN_GAP };
}

export function figureById(id: string): PaperFigure {
  const fig = FIGURES.find((f) => f.id === id);
  if (!fig) throw new Error(`unknown paper figure id: ${id}`);
  return fig;
}
