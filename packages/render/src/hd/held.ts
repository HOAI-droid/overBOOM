import { heroParts, type HeroParts } from '../models.ts';

/** Voxelgröße des HD-Helden */
export const HERO_VOXEL_HD = 0.05;

/** HD-Held (wird gefüllt) – bis dahin das kleine Modell doppelt aufgelöst */
export function heroPartsHd(color: string): HeroParts {
  const p = heroParts(color);
  const dbl = (vox: HeroParts['body']) => {
    const out: HeroParts['body'] = [];
    for (const [x, y, z, c, g] of vox) for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) for (let dz = 0; dz < 2; dz++) out.push([x * 2 + dx, y * 2 + dy, z * 2 + dz, c, g]);
    return out;
  };
  const piv = (v: [number, number, number]): [number, number, number] => [v[0] * 2, v[1] * 2, v[2] * 2];
  return {
    body: dbl(p.body), legL: dbl(p.legL), legR: dbl(p.legR), armL: dbl(p.armL), armR: dbl(p.armR),
    pivots: { legL: piv(p.pivots.legL), legR: piv(p.pivots.legR), armL: piv(p.pivots.armL), armR: piv(p.pivots.armR) }
  };
}
