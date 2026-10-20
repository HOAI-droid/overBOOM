/** Feste Simulationskonstanten (eigene Datei, damit es keine Import-Zyklen gibt). */
export const TICK_RATE = 30;
export const DT = 1 / TICK_RATE;

export const PLAYER_RADIUS = 0.3;
export const MOVE_SPEED = 4.4;
export const ACCEL = 38;
export const DASH_SPEED = 15;
export const DASH_TIME = 0.17;
export const DASH_COOLDOWN = 0.75;
export const BARREL_RADIUS = 0.3;

export const PLAYER_COLORS = ['#3de8ff', '#ff3df0', '#ffd23f', '#5dff7a'] as const;
