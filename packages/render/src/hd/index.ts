/**
 * Feine Modelle (HD) für hohe Grafikstufen: gleiche Figuren, halbe Voxelgröße (meist 0,05 statt 0,1),
 * dadurch etwa doppelt so viele Voxel pro Achse – Gesichter, Brauen und Kleidung werden ablesbar.
 * Höhe und Breite in Weltmetern bleiben wie beim kleinen Modell (Treffer-/Kronen-Position `top` gilt weiter).
 *
 * Fehlt ein HD-Modell, nimmt das Spiel automatisch das kleine.
 */
import type { Vox } from '../voxel.ts';
import type { HeroParts } from '../models.ts';
import { HD_GEGNER_A } from './gegnerA.ts';
import { HD_GEGNER_B } from './gegnerB.ts';
import { HD_BOSSE } from './bosse.ts';
import { heroPartsHd, HERO_VOXEL_HD } from './held.ts';

export interface HdModell {
  vox: () => Vox[];
  /** Voxelgröße in Metern */
  size: number;
}

/** HD-Modelle aller Gegner und Bosse nach Gegner-ID */
export const HD_GEGNER: Record<string, HdModell> = { ...HD_GEGNER_A, ...HD_GEGNER_B, ...HD_BOSSE };

export { heroPartsHd, HERO_VOXEL_HD };
export type { HeroParts };

/** Detailstufe: true = feine Modelle (ab Grafikstufe „Ultra“) */
export const DETAIL = { hd: false };
