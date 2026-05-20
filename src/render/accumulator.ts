/**
 * Accumulator: a 2D grid of Float32 cells that points are deposited into.
 *
 * The "render to image" pipeline is split into two phases:
 *   1. accumulate — generate points, project to pixel coords, deposit into a
 *      fixed-size grid. The grid size is bounded by the output image, not by
 *      the number of points, so streaming a billion points is fine.
 *   2. render — read the grid, apply tone curve, write PNG.
 *
 * The grid can have any number of channels (K ≥ 1):
 *   - K = 1 → plain hit counter (grayscale).
 *   - K > 1 → per-category counts that the render phase composites with a
 *             palette (one [R,G,B] per category).
 *
 * Channels are interleaved cell-by-cell: data[(y*width + x)*channels + c].
 *
 * On-disk format (`.acc` files):
 *   bytes  0..3   magic "ACC\0"
 *   bytes  4..7   header length N (LE u32)
 *   bytes  8..N+7 JSON header (utf-8)
 *                 { version, width, height, channels, dtype: "float32",
 *                   userMeta: {...arbitrary provenance...} }
 *   bytes  N+8..  raw Float32 data (width*height*channels values, LE)
 */

import {
  closeSync, existsSync, mkdirSync,
  openSync, readSync, renameSync, statSync, unlinkSync, writeSync,
} from 'node:fs';
import { dirname } from 'node:path';

const MAGIC = Buffer.from([0x41, 0x43, 0x43, 0x00]); // "ACC\0"
const FORMAT_VERSION = 2;

// fs writeSync/readSync take a 32-bit signed length. Chunk large I/O.
const IO_CHUNK = 1 << 30;

export interface Accumulator {
  width: number;
  height: number;
  /** 1 (grayscale) or any K ≥ 2 (categorical). */
  channels: number;
  /** Length = width * height * channels. Cell layout: data[(y*W + x)*K + c]. */
  data: Float32Array;
}

/**
 * Allocate a fresh accumulator of the given shape.
 *
 * `channels` is the number of categories (K). K=1 is a plain grayscale
 * hit-counter; K>1 lets a color scheme deposit per-category counts that the
 * render phase composites with a palette.
 */
export function createAccumulator(
  width: number,
  height: number,
  channels = 1,
): Accumulator {
  if (!Number.isInteger(width) || width <= 0) throw new Error(`bad width ${width}`);
  if (!Number.isInteger(height) || height <= 0) throw new Error(`bad height ${height}`);
  if (!Number.isInteger(channels) || channels < 1) {
    throw new Error(`channels must be a positive integer (got ${channels})`);
  }
  const data = new Float32Array(width * height * channels);
  return { width, height, channels, data };
}

/**
 * Integer-pixel deposit: round (px, py) to nearest pixel and increment by
 * weight. Out-of-bounds points are silently dropped. Caller picks `channel`
 * in [0, K).
 *
 * Hot path — kept lean. No allocations.
 */
export function depositInt(
  acc: Accumulator,
  px: number,
  py: number,
  channel = 0,
  weight = 1,
): void {
  const ix = Math.floor(px + 0.5);
  const iy = Math.floor(py + 0.5);
  if (ix < 0 || ix >= acc.width || iy < 0 || iy >= acc.height) return;
  acc.data[(iy * acc.width + ix) * acc.channels + channel] += weight;
}

/**
 * Copy a single channel out of a multi-channel accumulator as a new
 * Float32Array. For K=1 this is a no-op alias (returns the underlying data).
 */
export function channelView(acc: Accumulator, c: number): Float32Array {
  if (c < 0 || c >= acc.channels) throw new Error(`channel ${c} out of range`);
  if (acc.channels === 1) return acc.data;
  const out = new Float32Array(acc.width * acc.height);
  const step = acc.channels;
  for (let i = 0, j = c; i < out.length; i++, j += step) out[i] = acc.data[j];
  return out;
}

// ─── File I/O ───────────────────────────────────────────────────────────────

function readBytes(fd: number, dest: Buffer, totalBytes: number, path: string): void {
  let off = 0;
  while (off < totalBytes) {
    const n = Math.min(IO_CHUNK, totalBytes - off);
    const got = readSync(fd, dest, off, n, null);
    if (got <= 0) throw new Error(`unexpected EOF reading ${path} at byte ${off}`);
    off += got;
  }
}

function writeBytes(fd: number, src: Buffer, totalBytes: number): void {
  let off = 0;
  while (off < totalBytes) {
    const n = Math.min(IO_CHUNK, totalBytes - off);
    writeSync(fd, src, off, n, null);
    off += n;
  }
}

/**
 * Write the accumulator to disk. `userMeta` is any JSON-serializable object
 * (typically a cache key + provenance: example id, depth, view hash, etc.)
 * that the caller wants to recover on read.
 */
export function writeAccumulatorFile(
  path: string,
  acc: Accumulator,
  userMeta: Record<string, unknown> = {},
): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const headerObj = {
    version: FORMAT_VERSION,
    width: acc.width,
    height: acc.height,
    channels: acc.channels,
    dtype: 'float32',
    userMeta,
  };
  const headerBytes = Buffer.from(JSON.stringify(headerObj), 'utf8');

  const prelude = Buffer.alloc(8);
  MAGIC.copy(prelude, 0);
  prelude.writeUInt32LE(headerBytes.length, 4);

  const dataBytes = Buffer.from(acc.data.buffer, acc.data.byteOffset, acc.data.byteLength);

  const tmpPath = `${path}.tmp`;
  const fd = openSync(tmpPath, 'w');
  try {
    writeBytes(fd, prelude, prelude.length);
    writeBytes(fd, headerBytes, headerBytes.length);
    writeBytes(fd, dataBytes, dataBytes.length);
  } catch (err) {
    closeSync(fd);
    try { unlinkSync(tmpPath); } catch { /* best effort */ }
    throw err;
  }
  closeSync(fd);
  renameSync(tmpPath, path);
}

export interface AccumulatorFile {
  acc: Accumulator;
  userMeta: Record<string, unknown>;
}

export function readAccumulatorFile(path: string): AccumulatorFile {
  const stat = statSync(path);
  if (stat.size < 8) throw new Error(`accumulator file ${path} too small`);

  const fd = openSync(path, 'r');
  try {
    const prelude = Buffer.alloc(8);
    readBytes(fd, prelude, 8, path);
    if (!prelude.subarray(0, 4).equals(MAGIC)) {
      throw new Error(`accumulator file ${path} has wrong magic`);
    }
    const headerLen = prelude.readUInt32LE(4);
    if (headerLen > 1 << 20) throw new Error(`accumulator header suspiciously large (${headerLen})`);

    const headerBytes = Buffer.alloc(headerLen);
    readBytes(fd, headerBytes, headerLen, path);
    const header = JSON.parse(headerBytes.toString('utf8'));
    if (header.version !== FORMAT_VERSION) {
      throw new Error(`accumulator file ${path} version ${header.version}, expected ${FORMAT_VERSION}`);
    }
    if (header.dtype !== 'float32') {
      throw new Error(`accumulator dtype ${header.dtype} not supported`);
    }
    const { width, height, channels } = header;
    const expectedSize = 8 + headerLen + width * height * channels * 4;
    if (stat.size !== expectedSize) {
      throw new Error(`accumulator file ${path} has size ${stat.size}, expected ${expectedSize}`);
    }

    const data = new Float32Array(width * height * channels);
    readBytes(fd, Buffer.from(data.buffer, data.byteOffset, data.byteLength), data.byteLength, path);

    return {
      acc: { width, height, channels, data },
      userMeta: header.userMeta ?? {},
    };
  } finally {
    closeSync(fd);
  }
}
