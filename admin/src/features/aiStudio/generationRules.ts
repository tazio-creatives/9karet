import type { AssetType, CustomerCategory, JewelleryType } from '../../api/aiStudio';

// Ring (9karet): four Yellow Gold views, in output order. The hand and
// rose-gold slots are legacy — only older jobs have them.
const RING_ASSET_TYPES: AssetType[] = ['RING_GOLD_HERO', 'RING_GOLD_FRONT', 'RING_GOLD_SIDE', 'RING_GOLD_MACRO'];
const LEGACY_RING_ASSET_TYPES: AssetType[] = ['RING_HAND_1', 'RING_HAND_2', 'RING_ROSE_FRONT', 'RING_ROSE_SIDE'];
const RING_ASSET_TYPE_SET = new Set<AssetType>([...RING_ASSET_TYPES, ...LEGACY_RING_ASSET_TYPES]);

// Best-effort keyword match from a free-text product category name (e.g.
// "Ruby Rings", "Rose Gold Bangle") to the fixed jewellery-type
// vocabulary — categories in this app aren't constrained to that vocabulary,
// so this is advisory only; the admin can always override via "Update
// Product Category" regardless of what this infers.
export function inferJewelleryTypeFromCategory(categoryName: string | null): JewelleryType | null {
  if (!categoryName) return null;
  const normalized = categoryName.toUpperCase();
  const candidates: [JewelleryType, string[]][] = [
    ['MANGALSUTRA', ['MANGALSUTRA']],
    ['NOSE_PIN', ['NOSE PIN', 'NOSEPIN']],
    ['BANGLE', ['BANGLE']],
    ['BRACELET', ['BRACELET']],
    ['NECKLACE', ['NECKLACE']],
    ['EARRINGS', ['EARRING']],
    ['PENDANT', ['PENDANT']],
    ['CHAIN', ['CHAIN']],
    ['ANKLET', ['ANKLET']],
    ['BROOCH', ['BROOCH']],
    ['RING', ['RING']],
  ];
  for (const [type, keywords] of candidates) {
    if (keywords.some((k) => normalized.includes(k))) return type;
  }
  return null;
}

// Mirrors backend/src/services/aiStudioService.js's resolveAssetTypesForJob —
// duplicated intentionally (same pattern as SHOT_LABELS being duplicated
// across GenerateStep/ReviewImportStep) so Step 3's live Generation Summary
// can compute counts reactively without a round-trip to the server. Ring is
// a completely separate, fixed 4-image output structure (Hero, Front, Side,
// Macro — Yellow Gold only) — ignores both toggles, since Rings never use a
// Presenter or rose gold.
// Mirrors backend effectiveGenerateRoseGold — Necklace always gets the full
// Yellow + Rose set regardless of the Rose Gold toggle.
export function isRoseGoldForced(jewelleryType?: JewelleryType | ''): boolean {
  return jewelleryType === 'NECKLACE';
}

// Mirrors backend effectiveGenerateRoseGold — 9karet has no rose gold for Ring.
export function isRoseGoldUnavailable(jewelleryType?: JewelleryType | ''): boolean {
  return jewelleryType === 'RING';
}

export function resolveAssetTypesForJob({
  generateRoseGold,
  hasPresenter,
  jewelleryType,
}: {
  generateRoseGold: boolean;
  hasPresenter: boolean;
  jewelleryType?: JewelleryType | '';
}): AssetType[] {
  if (jewelleryType === 'RING') return [...RING_ASSET_TYPES];
  const types: AssetType[] = ['YELLOW_FRONT', 'YELLOW_HERO_45'];
  if (generateRoseGold) types.push('ROSE_FRONT', 'ROSE_HERO_45');
  if (hasPresenter) {
    types.push('PRESENTER_YELLOW_1');
    types.push(generateRoseGold ? 'PRESENTER_ROSE' : 'PRESENTER_YELLOW_2');
  }
  return types;
}

export function catalogueCount(types: AssetType[]): number {
  return types.filter(
    (t) =>
      t === 'YELLOW_FRONT' ||
      t === 'YELLOW_HERO_45' ||
      t === 'ROSE_FRONT' ||
      t === 'ROSE_HERO_45' ||
      t === 'RING_GOLD_HERO' ||
      t === 'RING_GOLD_FRONT' ||
      t === 'RING_GOLD_SIDE' ||
      t === 'RING_GOLD_MACRO' ||
      t === 'RING_ROSE_FRONT' ||
      t === 'RING_ROSE_SIDE',
  ).length;
}

export function presenterCount(types: AssetType[]): number {
  return types.filter((t) => t.startsWith('PRESENTER_')).length;
}

export function handShotCount(types: AssetType[]): number {
  return types.filter((t) => t === 'RING_HAND_1' || t === 'RING_HAND_2').length;
}

export const SHOT_LABELS: Record<AssetType, string> = {
  YELLOW_FRONT: 'Yellow Gold — Front Catalogue',
  YELLOW_HERO_45: 'Yellow Gold — 45° Hero Angle',
  ROSE_FRONT: 'Rose Gold — Front Catalogue',
  ROSE_HERO_45: 'Rose Gold — 45° Hero Angle',
  PRESENTER_YELLOW_1: 'Yellow Gold — Presenter',
  PRESENTER_YELLOW_2: 'Yellow Gold — Presenter (Alt Angle)',
  PRESENTER_ROSE: 'Rose Gold — Presenter',
  RING_GOLD_HERO: 'Yellow Gold — Hero Three-Quarter View',
  RING_GOLD_FRONT: 'Yellow Gold — Front/Top View',
  RING_GOLD_SIDE: 'Yellow Gold — Side-Profile View',
  RING_GOLD_MACRO: 'Yellow Gold — Macro Detail View',
  RING_HAND_1: 'Yellow Gold — Hand Pose 1',
  RING_HAND_2: 'Rose Gold — Hand Pose 2',
  RING_ROSE_FRONT: 'Rose Gold — True Front View',
  RING_ROSE_SIDE: 'Rose Gold — Three-Quarter Side View',
};

// RING_HAND_2 (legacy) took its label from the Rose Gold toggle — every other
// Ring label is fixed.
export function ringShotLabel(assetType: AssetType, generateRoseGold: boolean): string {
  if (assetType === 'RING_HAND_2' && !generateRoseGold) return 'Yellow Gold — Hand Pose 2';
  return SHOT_LABELS[assetType];
}

export type AssetGroup = 'Yellow Gold' | 'Rose Gold' | 'Presenter' | 'Ring';

export function groupForAssetType(assetType: AssetType): AssetGroup {
  if (RING_ASSET_TYPE_SET.has(assetType)) return 'Ring';
  if (assetType.startsWith('PRESENTER_')) return 'Presenter';
  return assetType.startsWith('ROSE_') ? 'Rose Gold' : 'Yellow Gold';
}

// RING_HAND_2's metal follows the Rose Gold toggle (Rose when required, Gold
// otherwise) — every other asset type is unambiguous from its name alone, so
// the extra param is a no-op for them. Defaults to true (Rose Gold on) to
// match the previous no-arg call sites' assumption.
export function metalColorForAssetType(assetType: AssetType, generateRoseGold = true): 'YELLOW' | 'ROSE' {
  if (assetType === 'RING_HAND_2') return generateRoseGold ? 'ROSE' : 'YELLOW';
  if (assetType.startsWith('RING_ROSE_')) return 'ROSE';
  if (RING_ASSET_TYPE_SET.has(assetType)) return 'YELLOW';
  return assetType.startsWith('ROSE_') || assetType === 'PRESENTER_ROSE' ? 'ROSE' : 'YELLOW';
}

export function formatCustomerCategory(category: CustomerCategory): string {
  return category.charAt(0) + category.slice(1).toLowerCase();
}

// Short human-readable phrase for the presenter demographic a given customer
// category resolves to — used in the "Generation Summary" line shown after
// category confirmation (e.g. "Gents · Adult Male Presenter · Gold & Rose
// Gold"). WOMEN/UNISEX keep today's ordinary presenter-library styling, so
// there's no fixed phrase to show for them.
export function presenterDemographicSummary(category: CustomerCategory): string | null {
  if (category === 'GENTS') return 'Adult Male Presenter';
  if (category === 'KIDS') return 'Child Model, Age 2–4';
  return null;
}
