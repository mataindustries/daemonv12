// Portrait geometry for 1080×1920. Platform chrome (TikTok, Reels, Shorts) covers roughly the
// top 250 px, the bottom 440 px and a right-hand action rail from x ≈ 930. Key copy stays in the
// centre 70 % of the width and between the top and bottom overlays; machinery may bleed to the
// frame edges, where being covered costs nothing.

/** Box for every line of copy (checked on rendered frames by scripts/verify-vertical.ts). */
export const SAFE = {left: 162, right: 918, top: 300, bottom: 1460} as const;

export const SAFE_WIDTH = SAFE.right - SAFE.left;
export const SAFE_CX = (SAFE.left + SAFE.right) / 2;
