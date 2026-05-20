/**
 * PNG writer: 8-bit RGBA pixel buffer → PNG file on disk.
 *
 * Thin wrapper around pngjs. The `rgba` buffer is exactly width*height*4
 * bytes in row-major order, channels interleaved RGBARGBA...
 */

import { createWriteStream } from 'node:fs';
import { once } from 'node:events';
import { PNG } from 'pngjs';

export async function writePng(
  path: string,
  width: number,
  height: number,
  rgba: Uint8Array,
): Promise<void> {
  const expected = width * height * 4;
  if (rgba.length !== expected) {
    throw new Error(`rgba length ${rgba.length} != width*height*4 = ${expected}`);
  }
  const png = new PNG({ width, height });
  png.data.set(rgba);
  const stream = createWriteStream(path);
  png.pack().pipe(stream);
  await once(stream, 'finish');
}
