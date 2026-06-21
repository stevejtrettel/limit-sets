/**
 * ControlPanel — small HUD-style control panel for the demos.
 *
 * Builder API: construct, then add controls one at a time. Each add returns
 * a typed handle whose `.value` reflects current state and whose `.set(v)`
 * updates the DOM (without firing the onChange listener — set is "silent",
 * so reset flows don't double-invoke handlers).
 *
 *   const panel = new ControlPanel({ title: 'Sp(6,Z) — limit sets' });
 *   const sel = panel.select({ label: 'example', options: [...], value: 'A17', onChange: ... });
 *   panel.separator();
 *   const sl  = panel.slider({ label: 'depth N', min: 4, max: 13, step: 1, value: 12, onChange: ... });
 *   panel.button({ label: 'reset', onClick: () => sl.set(12) });
 *   const stats = panel.text({ variant: 'stats' });
 *   stats.text('1234 words');
 *
 * Folders: `panel.folder('Cocycle', { open: true })` returns a `WidgetContainer`
 * exposing the same builder API but appending to a collapsible sub-section.
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
    max-height: calc(100vh - 24px);
    overflow-y: auto;
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
  .${PANEL_CLASS} input[type=number] {
    width: 100%; margin: 2px 0 4px; box-sizing: border-box;
    background: rgba(255,255,255,0.06); color: #e8e8e8;
    border: 1px solid rgba(255,255,255,0.15); border-radius: 3px;
    padding: 3px 4px; font: inherit;
  }
  .${PANEL_CLASS} .mat2 {
    display: grid; grid-template-columns: 1fr 1fr; gap: 3px;
    margin: 2px 0 4px;
  }
  .${PANEL_CLASS} .mat2 input { margin: 0; }
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
  .${PANEL_CLASS} .folder {
    margin: 6px 0; border: 1px solid rgba(255,255,255,0.08);
    border-radius: 4px; overflow: hidden;
  }
  .${PANEL_CLASS} .folder-header {
    padding: 4px 8px; cursor: pointer;
    background: rgba(255,255,255,0.04);
    font-weight: 500; user-select: none;
    display: flex; align-items: center; gap: 5px;
  }
  .${PANEL_CLASS} .folder-header:hover { background: rgba(255,255,255,0.08); }
  .${PANEL_CLASS} .folder-chevron {
    display: inline-block; font-size: 9px; opacity: 0.7;
    transition: transform 0.12s ease;
  }
  .${PANEL_CLASS} .folder.open .folder-chevron { transform: rotate(90deg); }
  .${PANEL_CLASS} .folder-content {
    padding: 4px 8px 6px; display: none;
  }
  .${PANEL_CLASS} .folder.open .folder-content { display: block; }
  /* No top-margin on the first label/element inside a freshly-opened folder. */
  .${PANEL_CLASS} .folder-content > :first-child { margin-top: 2px; }
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

export interface NumberInputControlOptions {
  label?: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  /** `'change'` (default) fires on blur/enter; `'input'` fires on every keystroke. */
  event?: 'input' | 'change';
  onChange: (v: number) => void;
}

export interface NumberInputControl {
  readonly value: number;
  set(value: number): void;
  readonly element: HTMLInputElement;
}

export type Mat2 = readonly [readonly [number, number], readonly [number, number]];

export interface Matrix2InputControlOptions {
  label?: string;
  value: Mat2;
  step?: number;
  event?: 'input' | 'change';
  onChange: (m: Mat2) => void;
}

export interface Matrix2InputControl {
  readonly value: Mat2;
  set(m: Mat2): void;
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

export interface FolderOptions {
  /** Start expanded? Default `false`. */
  open?: boolean;
}

/**
 * Builder host: any sub-section of the panel that can hold widgets.
 * `ControlPanel` is the top-level WidgetContainer; folders are nested
 * sub-containers with the same API.
 */
export class WidgetContainer {
  protected readonly host: HTMLElement;

  constructor(host: HTMLElement) {
    this.host = host;
  }

  separator(): this {
    this.host.appendChild(document.createElement('hr'));
    return this;
  }

  folder(label: string, opts: FolderOptions = {}): WidgetContainer {
    const wrap = document.createElement('div');
    wrap.className = 'folder' + (opts.open ? ' open' : '');

    const header = document.createElement('div');
    header.className = 'folder-header';
    const chevron = document.createElement('span');
    chevron.className = 'folder-chevron';
    chevron.textContent = '▶';
    const text = document.createElement('span');
    text.textContent = label;
    header.appendChild(chevron);
    header.appendChild(text);
    wrap.appendChild(header);

    const content = document.createElement('div');
    content.className = 'folder-content';
    wrap.appendChild(content);

    header.addEventListener('click', () => wrap.classList.toggle('open'));

    this.host.appendChild(wrap);
    return new WidgetContainer(content);
  }

  select(opts: SelectControlOptions): SelectControl {
    if (opts.label !== undefined) {
      const label = document.createElement('label');
      label.textContent = opts.label;
      this.host.appendChild(label);
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
    this.host.appendChild(select);

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
    this.host.appendChild(label);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(opts.min);
    input.max = String(opts.max);
    input.step = String(opts.step);
    input.value = String(opts.value);
    this.host.appendChild(input);

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

  numberInput(opts: NumberInputControlOptions): NumberInputControl {
    if (opts.label !== undefined) {
      const label = document.createElement('label');
      label.textContent = opts.label;
      this.host.appendChild(label);
    }
    const input = document.createElement('input');
    input.type = 'number';
    input.value = String(opts.value);
    if (opts.step !== undefined) input.step = String(opts.step);
    if (opts.min  !== undefined) input.min  = String(opts.min);
    if (opts.max  !== undefined) input.max  = String(opts.max);
    this.host.appendChild(input);

    const eventName = opts.event ?? 'change';
    input.addEventListener(eventName, () => {
      const v = parseFloat(input.value);
      if (Number.isFinite(v)) opts.onChange(v);
    });

    return {
      get value() { return parseFloat(input.value); },
      set(v: number) { input.value = String(v); },
      element: input,
    };
  }

  matrix2Input(opts: Matrix2InputControlOptions): Matrix2InputControl {
    if (opts.label !== undefined) {
      const label = document.createElement('label');
      label.textContent = opts.label;
      this.host.appendChild(label);
    }
    const grid = document.createElement('div');
    grid.className = 'mat2';
    this.host.appendChild(grid);

    const inputs: HTMLInputElement[][] = [[], []];
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.value = String(opts.value[i][j]);
        if (opts.step !== undefined) inp.step = String(opts.step);
        grid.appendChild(inp);
        inputs[i].push(inp);
      }
    }

    const eventName = opts.event ?? 'change';
    const fire = () => {
      const m: Mat2 = [
        [parseFloat(inputs[0][0].value), parseFloat(inputs[0][1].value)],
        [parseFloat(inputs[1][0].value), parseFloat(inputs[1][1].value)],
      ];
      // Ignore partially edited (NaN) states.
      for (const row of m) for (const x of row) if (!Number.isFinite(x)) return;
      opts.onChange(m);
    };
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      inputs[i][j].addEventListener(eventName, fire);
    }

    return {
      get value(): Mat2 {
        return [
          [parseFloat(inputs[0][0].value), parseFloat(inputs[0][1].value)],
          [parseFloat(inputs[1][0].value), parseFloat(inputs[1][1].value)],
        ];
      },
      set(m: Mat2) {
        for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
          inputs[i][j].value = String(m[i][j]);
        }
      },
    };
  }

  button(opts: ButtonControlOptions): ButtonControl {
    const btn = document.createElement('button');
    btn.textContent = opts.label;
    btn.addEventListener('click', () => { void opts.onClick(); });
    this.host.appendChild(btn);
    return { element: btn };
  }

  text(opts: TextControlOptions = {}): TextControl {
    const el = document.createElement('div');
    const variant = opts.variant ?? 'plain';
    if (variant !== 'plain') el.classList.add(variant);
    if (opts.initial !== undefined) el.textContent = opts.initial;
    this.host.appendChild(el);

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

export class ControlPanel extends WidgetContainer {
  readonly element: HTMLDivElement;

  constructor(options: ControlPanelOptions = {}) {
    ensureCss();
    const element = document.createElement('div');
    element.className = PANEL_CLASS;
    super(element);
    this.element = element;
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
}
