/**
 * Resolve where a render script writes its PNG: outputs/<sub>/<file> at the repo
 * root, creating the directory if needed. Keeps rendered images (gitignored)
 * out of the source root, foldered by family so one family's output is easy to
 * browse or wipe.
 */

import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function outputPath(sub: string, file: string): string {
  const dir = fileURLToPath(new URL(`../../outputs/${sub}/`, import.meta.url));
  mkdirSync(dir, { recursive: true });
  return dir + file;
}
