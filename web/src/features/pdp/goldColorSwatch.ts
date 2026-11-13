import type { GoldColor } from '../../api/types';

// Decorative material swatches (not brand palette) — approximate real-world
// tones for each gold color option, shared between the swatch cards and the
// PDP's summary chips.
export const COLOR_SWATCH: Record<GoldColor, { label: string; hex: string }> = {
  YELLOW: { label: 'Yellow Gold', hex: '#E8B923' },
  ROSE: { label: 'Rose Gold', hex: '#E3B7A0' },
  WHITE: { label: 'White Gold', hex: '#D9DCDD' },
};
