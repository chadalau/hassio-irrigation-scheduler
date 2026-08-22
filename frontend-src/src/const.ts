export const DOMAIN = "irrigation_scheduler";

/**
 * Build marker, logged once when the bundle loads.
 *
 * Tracking down "the graph does not render" cost a long session in which the
 * prime suspect was a stale card.js still being served to the browser, with no
 * way to tell from the dashboard which build was actually running. One console
 * line settles that question immediately. Bump it with any visible card change.
 */
export const CARD_BUILD = "0.14.0";

export const DEFAULT_SHOW_NEXT_RUN = true;
export const DEFAULT_SHOW_WATER_NOW = true;
export const DEFAULT_COMPACT = false;

// Schedule day range (0 = Monday ... 6 = Sunday), mirrors the backend.
export const DAY_MIN = 0;
export const DAY_MAX = 6;
