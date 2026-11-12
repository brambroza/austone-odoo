import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { MASCOT_PATH } from './constants';

export { BRAND_COLORS, MASCOT_PATH } from './constants';

/** Mascot as a PNG data URI, for server-side `ImageResponse` renders (app icons, social card). */
export async function mascotDataUri(): Promise<string> {
  const png = await readFile(path.join(process.cwd(), 'public', MASCOT_PATH));
  return `data:image/png;base64,${png.toString('base64')}`;
}
