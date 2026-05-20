/**
 * ControlPanel — small HUD-style control panel for the demos.
 *
 * Builder API: construct, then add controls one at a time. Each add returns
 * a typed handle whose `.value` reflects current state and whose `.set(v)`
 * updates the DOM (without firing the onChange listener — set is "silent",
 * so reset flows don't double-invoke handlers).
 *
 *   const panel = new ControlPanel({ title: 'Sp(6,Z) — limit sets' });
 *   const sel = panel.select({ label: 'example', options: [...], value: 'A15', onChange: ... });
 *   panel.separator();
 *   const sl  = panel.slider({ label: 'depth N', min: 4, max: 13, step: 1, value: 12, onChange: ... });
 *   panel.button({ label: 'reset', onClick: () => sl.set(12) });
 *   const stats = panel.text({ variant: 'stats' });
 *   stats.text('1234 words');
 */

const PANEL_CLASS = 'lset-panel';

const PANEL_CSS = `
  .${PANEL_CLASS} {
    position: fixed; top: 12px; left: 12px;
    background: rgba(20,22,26,0.85); color: #e8e8e8;
    padding: 10px 12px; border-radius: 6px;
    font: 12px/1.4 system-ui, sans-serif;
    user-select: none; z-index: 10;
    width: 260px;
    backdrop-filter: blur(6px);
  }
  .${PANEL_CLASS} .title { font-weight: 600; margin-bottom: 4px; }
  .${PANEL_CLASS} label { display: flex; justify-content: space-between; margin-top: 6px; }
  .${PANEL_CLASS} input[type=range] { width: 100%; margin: 2px 0 4px; }
  .${PANEL_CLASS} select {
    width: 100%; margin: 2px 0 4px;
    background: rgba(255,255,255,0.06); color: #e8e8e8;
    border: 1px solid rgba(255,255,255,0.15); border-radius: 3px;
    padding: 3px 4px; font: inherit;
  }
  .${PANEL_CLASS} button {
    width: 100%; margin-top: 8px;
    background: rgba(255,255,255,0.08); color: #e8e8e8;
    border: none; padding: 6px 8px; border-radius: 4px;
    cursor: pointer; font: inherit;
  }
  .${PANEL_CLASS} button:hover { background: rgba(255,255,255,0.18); }
  .${PANEL_CLASS} hr { border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 8px 0; }
  .${PANEL_CLASS} .stats { color: #aaa; margin-top: 8px; font-size: 11px; }
  .${PANEL_CLASS} .mode  { color: #cce; margin-top: 4px; font-size: 11px; font-style: italic; }
  .${PANEL_CLASS} .meta  { color: #999; margin-top: 4px; font-size: 11px; line-height: 1.45; }
`;

let cssInjected = false;
function ensureCss(): void {
  if (cssInjected) return;
  const style = document.createElement('style');
  style.textContent = PANEL_CSS;
  document.head.appendChild(style);
  cssInjected = true;
}

export interface ControlPanelOptions {
  title?: string;
  /** Parent to append the panel to. Defaults to document.body. */
  parent?: HTMLElement;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectControlOptions {
  label?: string;
  options: SelectOption[];
  value?: string;
  onChange: (value: string) => void;
}

export interface SelectControl {
  /** Current selected value. */
  readonly value: string;
  /** Programmatically set the value. Does not fire onChange. */
  set(value: string): void;
  readonly element: HTMLSelectElement;
}

export interface SliderControlOptions {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  /** Format the readout next to the label. Default: `String(v)`. */
  format?: (v: number) => string;
  /** `'change'` (default) fires on release; `'input'` fires while dragging. */
  event?: 'input' | 'change';
  /** Parsing strategy. Default: `'float'` if step has a fractional part, else `'int'`. */
  parse?: 'int' | 'float';
  onChange: (v: number) => void;
}

export interface SliderControl {
  readonly value: number;
  /** Programmatically set the value. Updates input + readout. Does not fire onChange. */
  set(value: number): void;
  readonly element: HTMLInputElement;
}

export interface ButtonControlOptions {
  label: string;
  onClick: () => void | Promise<void>;
}

export interface ButtonControl {
  readonly element: HTMLButtonElement;
}

export type TextVariant = 'stats' | 'mode' | 'meta' | 'plain';

export interface TextControlOptions {
  /** Styling preset; default `'plain'`. */
  variant?: TextVariant;
  /** Initial text content. */
  initial?: string;
}

export interface TextControl {
  /** Set textContent. */
  text(s: string): void;
  /** Set innerHTML (use when you need <br> etc — caller is responsible for trust). */
  html(s: string): void;
  /** Show a message, optionally colored, then clear after `ms` ms. */
  flash(msg: string, ms?: number, color?: string): void;
  readonly element: HTMLDivElement;
}

export class ControlPanel {
  readonly element: HTMLDivElement;

  constructor(options: ControlPanelOptions = {}) {
    ensureCss();
    this.element = document.createElement('div');
    this.element.className = PANEL_CLASS;
    if (options.title) this.title(options.title);
    (options.parent ?? document.body).appendChild(this.element);
  }

  title(text: string): this {
    const el = document.createElement('div');
    el.className = 'title';
    el.textContent = text;
    this.element.appendChild(el);
    return this;
  }

  separator(): this {
    this.element.appendChild(document.createElement('hr'));
    return this;
  }

  select(opts: SelectControlOptions): SelectControl {
    if (opts.label !== undefined) {
      const label = document.createElement('label');
      label.textContent = opts.label;
      this.element.appendChild(label);
    }

    const select = document.createElement('select');
    for (const o of opts.options) {
      const optEl = document.createElement('option');
      optEl.value = o.value;
      optEl.textContent = o.label;
      select.appendChild(optEl);
    }
    const initial = opts.value ?? opts.options[0]?.value ?? '';
    select.value = initial;
    this.element.appendChild(select);

    select.addEventListener('change', () => opts.onChange(select.value));

    return {
      get value() { return select.value; },
      set(v: string) { select.value = v; },
      element: select,
    };
  }

  slider(opts: SliderControlOptions): SliderControl {
    const format = opts.format ?? ((v: number) => String(v));
    const isInt = opts.parse ?? (Number.isInteger(opts.step) ? 'int' : 'float');
    const parse = isInt === 'int'
      ? (s: string) => parseInt(s, 10)
      : (s: string) => parseFloat(s);
    const eventName = opts.event ?? 'change';

    const label = document.createElement('label');
    const labelText = document.createElement('span');
    labelText.textContent = opts.label;
    const readout = document.createElement('span');
    readout.textContent = format(opts.value);
    label.appendChild(labelText);
    label.appendChild(readout);
    this.element.appendChild(label);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(opts.min);
    input.max = String(opts.max);
    input.step = String(opts.step);
    input.value = String(opts.value);
    this.element.appendChild(input);

    // Always update the readout live, even when the change handler fires
    // only on release — feels more responsive while dragging.
    input.addEventListener('input', () => {
      readout.textContent = format(parse(input.value));
    });
    input.addEventListener(eventName, () => {
      opts.onChange(parse(input.value));
    });

    return {
      get value() { return parse(input.value); },
      set(v: number) {
        input.value = String(v);
        readout.textContent = format(v);
      },
      element: input,
    };
  }

  button(opts: ButtonControlOptions): ButtonControl {
    const btn = document.createElement('button');
    btn.textContent = opts.label;
    btn.addEventListener('click', () => { void opts.onClick(); });
    this.element.appendChild(btn);
    return { element: btn };
  }

  text(opts: TextControlOptions = {}): TextControl {
    const el = document.createElement('div');
    const variant = opts.variant ?? 'plain';
    if (variant !== 'plain') el.classList.add(variant);
    if (opts.initial !== undefined) el.textContent = opts.initial;
    this.element.appendChild(el);

    let flashTimer: number | undefined;
    return {
      text(s: string) { el.textContent = s; },
      html(s: string) { el.innerHTML = s; },
      flash(msg: string, ms = 2500, color?: string) {
        if (color !== undefined) el.style.color = color;
        el.textContent = msg;
        if (flashTimer !== undefined) clearTimeout(flashTimer);
        flashTimer = window.setTimeout(() => { el.textContent = ''; }, ms);
      },
      element: el,
    };
  }
}
