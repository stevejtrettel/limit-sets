/**
 * InfoPanel — a collapsible read-only "what am I looking at" window.
 *
 * The ControlPanel is for knobs and is deliberately narrow; this is its
 * counterpart for exposition: the actual matrices, the basepoint, and a short
 * account of how they were obtained. It sits top-right, scrolls, and renders
 * numbers in a monospace grid so matrices line up.
 *
 *   const info = new InfoPanel({ title: 'construction' });
 *   info.sections([{ heading: 'generators', html: matrixHtml(A) }]);
 *   panel.button({ label: 'info window', onClick: () => info.toggle() });
 *
 * Content is supplied by the caller as HTML — a family builds its own sections
 * (see e.g. examples/galois-sl3/describe.ts), so this file stays generic and
 * carries no mathematics.
 */

import type { Mat } from '../core/matrix.ts';
import { matDim } from '../core/matrix.ts';

const PANEL_CLASS = 'lset-info';

const PANEL_CSS = `
  .${PANEL_CLASS} {
    position: fixed; top: 12px; right: 12px;
    background: rgba(20,22,26,0.88); color: #e8e8e8;
    padding: 10px 12px; border-radius: 6px;
    font: 12px/1.5 system-ui, sans-serif;
    z-index: 10;
    width: 440px;
    max-width: calc(100vw - 24px);
    max-height: calc(100vh - 24px);
    overflow-y: auto;
    backdrop-filter: blur(6px);
  }
  .${PANEL_CLASS}.closed { display: none; }
  .${PANEL_CLASS} .info-title {
    font-weight: 600; margin-bottom: 6px;
    display: flex; justify-content: space-between; align-items: center;
  }
  .${PANEL_CLASS} .info-close {
    cursor: pointer; opacity: 0.6; font-size: 14px; line-height: 1;
    padding: 0 2px; user-select: none;
  }
  .${PANEL_CLASS} .info-close:hover { opacity: 1; }
  .${PANEL_CLASS} h4 {
    margin: 12px 0 4px; font-size: 11px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.06em; color: #9fb4d0;
  }
  .${PANEL_CLASS} h4:first-child { margin-top: 2px; }
  .${PANEL_CLASS} p { margin: 4px 0; color: #c8c8c8; }
  .${PANEL_CLASS} .dim { color: #8d8d8d; }
  .${PANEL_CLASS} pre {
    margin: 4px 0 6px; font: 10.5px/1.35 ui-monospace, "SF Mono", Menlo, monospace;
    color: #dfe6ef; white-space: pre; overflow-x: auto;
  }
  .${PANEL_CLASS} .matlabel {
    font: 11px/1.4 ui-monospace, Menlo, monospace; color: #9fb4d0; margin-top: 6px;
  }
`;

let cssInjected = false;
function ensureCss(): void {
  if (cssInjected) return;
  const style = document.createElement('style');
  style.textContent = PANEL_CSS;
  document.head.appendChild(style);
  cssInjected = true;
}

export interface InfoSection {
  heading: string;
  html: string;
}

export interface InfoPanelOptions {
  title?: string;
  /** Start visible? Default true. */
  open?: boolean;
  parent?: HTMLElement;
}

export class InfoPanel {
  private readonly root: HTMLDivElement;
  private readonly body: HTMLDivElement;

  constructor(opts: InfoPanelOptions = {}) {
    ensureCss();
    this.root = document.createElement('div');
    this.root.className = PANEL_CLASS + (opts.open === false ? ' closed' : '');

    const title = document.createElement('div');
    title.className = 'info-title';
    const text = document.createElement('span');
    text.textContent = opts.title ?? 'info';
    const close = document.createElement('span');
    close.className = 'info-close';
    close.textContent = '×';
    close.title = 'hide';
    close.addEventListener('click', () => this.setOpen(false));
    title.appendChild(text);
    title.appendChild(close);
    this.root.appendChild(title);

    this.body = document.createElement('div');
    this.root.appendChild(this.body);

    (opts.parent ?? document.body).appendChild(this.root);
  }

  /** Replace the whole body with these sections, in order. */
  sections(list: readonly InfoSection[]): void {
    this.body.innerHTML = list
      .map((s) => `<h4>${s.heading}</h4>${s.html}`)
      .join('');
  }

  get open(): boolean {
    return !this.root.classList.contains('closed');
  }

  setOpen(open: boolean): void {
    this.root.classList.toggle('closed', !open);
  }

  toggle(): void {
    this.setOpen(!this.open);
  }
}

// ─── Number / matrix rendering ───────────────────────────────────────────────

function fmt(x: number, digits: number): string {
  // Render -0 as 0 so a zero column doesn't read as signed.
  const v = Object.is(x, -0) ? 0 : x;
  return v.toFixed(digits);
}

/** Right-align a column of already-formatted numbers to a common width. */
function padCells(cells: string[][]): string[][] {
  let w = 0;
  for (const row of cells) for (const c of row) w = Math.max(w, c.length);
  return cells.map((row) => row.map((c) => c.padStart(w)));
}

export interface MatrixHtmlOptions {
  digits?: number;
  /** Insert a visual gap after this row/column index (e.g. 3 for a 3+3 block
   *  sum), so block structure is legible. */
  blockSplit?: number;
}

/**
 * A flat n×n matrix as bracketed monospace rows. `blockSplit` draws the gap
 * that makes a block-diagonal shape read as one.
 */
export function matrixHtml(M: Mat, opts: MatrixHtmlOptions = {}): string {
  const { digits = 4, blockSplit } = opts;
  const n = matDim(M);
  const cells = padCells(
    Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => fmt(M[i * n + j], digits))),
  );

  const lines: string[] = [];
  for (let i = 0; i < n; i++) {
    const left = i === 0 ? '⎡' : i === n - 1 ? '⎣' : '⎢';
    const right = i === 0 ? '⎤' : i === n - 1 ? '⎦' : '⎥';
    let row = '';
    for (let j = 0; j < n; j++) {
      row += cells[i][j];
      if (j < n - 1) row += blockSplit !== undefined && j + 1 === blockSplit ? '   ' : ' ';
    }
    lines.push(`${left} ${row} ${right}`);
    if (blockSplit !== undefined && i + 1 === blockSplit && i < n - 1) {
      lines.push(`⎢ ${' '.repeat(row.length)} ⎥`);
    }
  }
  return `<pre>${lines.join('\n')}</pre>`;
}

/** A vector as one bracketed monospace row. */
export function vectorHtml(v: ArrayLike<number>, digits = 6): string {
  const cells = padCells([Array.from({ length: v.length }, (_, i) => fmt(v[i], digits))]);
  return `<pre>( ${cells[0].join('  ')} )</pre>`;
}

/**
 * Two vectors stacked with a gap between them — the "these are the pieces, this
 * is the join" shape. Labels are plain text.
 */
export function stackedVectorsHtml(
  rows: readonly { label: string; v: ArrayLike<number> }[],
  digits = 6,
): string {
  const cells = padCells(rows.map((r) =>
    Array.from({ length: r.v.length }, (_, i) => fmt(r.v[i], digits))));
  const w = Math.max(...rows.map((r) => r.label.length));
  const lines = rows.map((r, i) => `${r.label.padEnd(w)}  ( ${cells[i].join('  ')} )`);
  return `<pre>${lines.join('\n')}</pre>`;
}
