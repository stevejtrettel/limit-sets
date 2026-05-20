/**
 * Progress reporting for long-running streaming phases.
 *
 * Usage:
 *   const prog = createProgress({ total, label: 'DFS' });
 *   for (...) {
 *     prog.tick();          // call every iteration (cheap)
 *   }
 *   prog.done();            // emit final line + newline
 *
 * The reporter rate-limits its own output to once per REPORT_INTERVAL_MS,
 * and only calls Date.now() every CHECK_EVERY ticks so the hot path stays
 * cheap (one increment + one branch per iteration).
 *
 * When stderr is a TTY, lines are overwritten with carriage return. When
 * stderr is piped, each report is on its own line.
 */

const REPORT_INTERVAL_MS = 1000;
const CHECK_EVERY = 1 << 20; // 2^20 ≈ 1M iterations between Date.now() calls

const isTty = !!process.stderr.isTTY;

export interface ProgressOptions {
  /** Known total iteration count (enables % and ETA). */
  total?: number;
  /** Short prefix tag, e.g. 'DFS'. */
  label?: string;
  /** Called each report to append a custom suffix (e.g. drawn count). */
  extra?: () => string;
}

export interface Progress {
  /** Call once per iteration. Hot path — must stay cheap. */
  tick(): void;
  /** Force a report right now (useful for sub-phase boundaries). */
  flush(): void;
  /** Emit a final report and terminate the progress line. */
  done(): void;
  /** Total ticks so far. */
  readonly count: number;
  /** Wall-clock seconds since createProgress was called. */
  readonly elapsed: number;
}

export function createProgress(opts: ProgressOptions = {}): Progress {
  const total = opts.total;
  const label = opts.label ?? 'progress';
  const extra = opts.extra;

  const tStart = Date.now();
  let lastReport = tStart;
  let count = 0;
  let checkCounter = 0;

  function report(force = false): void {
    const now = Date.now();
    if (!force && now - lastReport < REPORT_INTERVAL_MS) return;
    lastReport = now;
    const elapsed = (now - tStart) / 1000;
    const rate = count / Math.max(elapsed, 1e-6);
    let line = `[${label}] ${formatCount(count)}`;
    if (total !== undefined) {
      const pct = Math.min(100, (count / total) * 100);
      line += `/${formatCount(total)} (${pct.toFixed(1)}%)`;
    }
    line += `  ${formatCount(rate)}/s  elapsed ${formatDuration(elapsed)}`;
    if (total !== undefined && count > 0) {
      const eta = (total - count) / Math.max(rate, 1);
      if (eta > 0) line += `  eta ${formatDuration(eta)}`;
    }
    if (extra) line += `  ${extra()}`;
    write(line);
  }

  return {
    tick() {
      count++;
      if (++checkCounter === CHECK_EVERY) {
        checkCounter = 0;
        report(false);
      }
    },
    flush() { report(true); },
    done() {
      report(true);
      if (isTty) process.stderr.write('\n');
    },
    get count() { return count; },
    get elapsed() { return (Date.now() - tStart) / 1000; },
  };
}

function write(line: string): void {
  if (isTty) {
    process.stderr.write('\r\x1b[2K' + line);
  } else {
    process.stderr.write(line + '\n');
  }
}

export function formatCount(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  if (abs >= 1)   return `${n.toFixed(0)}`;
  return n.toFixed(2);
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return String(seconds);
  if (seconds < 1)  return `${(seconds * 1000).toFixed(0)}ms`;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return `${m}m${s.toString().padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h${mm.toString().padStart(2, '0')}m${s.toString().padStart(2, '0')}s`;
}
