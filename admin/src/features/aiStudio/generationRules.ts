import type { AssetType, CustomerCategory, JewelleryType, ManifestSlot } from '../../api/aiStudio';

const RING_ASSET_TYPES: AssetType[] = [
  'RING_HAND_1',
  'RING_HAND_2',
  'RING_GOLD_FRONT',
  'RING_GOLD_SIDE',
  'RING_ROSE_FRONT',
  'RING_ROSE_SIDE',
  'RING_GOLD_HERO',
  'RING_GOLD_PROFILE',
  'RING_GOLD_MACRO',
  'RING_ROSE_HERO',
  'RING_HAND_ROSE',
];
const RING_ASSET_TYPE_SET = new Set<AssetType>(RING_ASSET_TYPES);

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
// a completely separate, fixed 4/6-image output structure (Hand Pose 1/2 +
// Front/Side, no 45° Hero) — ignores hasPresenter entirely, since Rings
// never use a Presenter.
// 9karet: every job is exactly six images — 4 catalogue + 2 presenter — and
// the Rose Gold switch (default OFF) only changes the metal split. No
// category forces rose gold any more. Mirrors backend buildOutputManifest.
const MANIFEST_PLANS: Record<'RING' | 'STANDARD', Record<'off' | 'on', [string, AssetType][]>> = {
  RING: {
    off: [
      ['yellow_catalogue_1', 'RING_GOLD_HERO'],
      ['yellow_catalogue_2', 'RING_GOLD_FRONT'],
      ['yellow_catalogue_3', 'RING_GOLD_PROFILE'],
      ['yellow_catalogue_4', 'RING_GOLD_MACRO'],
      ['yellow_presenter_1', 'RING_HAND_1'],
      ['yellow_presenter_2', 'RING_HAND_2'],
    ],
    on: [
      ['yellow_catalogue_1', 'RING_GOLD_HERO'],
      ['yellow_catalogue_2', 'RING_GOLD_FRONT'],
      ['rose_catalogue_1', 'RING_ROSE_HERO'],
      ['rose_catalogue_2', 'RING_ROSE_FRONT'],
      ['yellow_presenter_1', 'RING_HAND_1'],
      ['rose_presenter_1', 'RING_HAND_ROSE'],
    ],
  },
  STANDARD: {
    off: [
      ['yellow_catalogue_1', 'YELLOW_FRONT'],
      ['yellow_catalogue_2', 'YELLOW_HERO_45'],
      ['yellow_catalogue_3', 'YELLOW_SIDE'],
      ['yellow_catalogue_4', 'YELLOW_MACRO'],
      ['yellow_presenter_1', 'PRESENTER_YELLOW_1'],
      ['yellow_presenter_2', 'PRESENTER_YELLOW_2'],
    ],
    on: [
      ['yellow_catalogue_1', 'YELLOW_FRONT'],
      ['yellow_catalogue_2', 'YELLOW_HERO_45'],
      ['rose_catalogue_1', 'ROSE_FRONT'],
      ['rose_catalogue_2', 'ROSE_HERO_45'],
      ['yellow_presenter_1', 'PRESENTER_YELLOW_1'],
      ['rose_presenter_1', 'PRESENTER_ROSE'],
    ],
  },
};

export function buildOutputManifest(jewelleryType: JewelleryType | '' | null | undefined, generateRoseGold: boolean): ManifestSlot[] {
  const plan = MANIFEST_PLANS[jewelleryType === 'RING' ? 'RING' : 'STANDARD'][generateRoseGold ? 'on' : 'off'];
  return plan.map(([slotKey, assetType], index) => ({
    slotKey,
    assetType,
    index,
    metal: slotKey.startsWith('rose_') ? 'ROSE' : 'YELLOW',
    kind: slotKey.includes('_catalogue_') ? 'catalogue' : 'presenter',
  }));
}

// Same checks the backend runs before generating: six unique slots, 4
// catalogue + 2 presenter, and zero (OFF) or three (ON) rose-gold slots.
export function isValidManifest(manifest: ManifestSlot[], generateRoseGold: boolean): boolean {
  const rose = manifest.filter((m) => m.metal === 'ROSE').length;
  return (
    manifest.length === 6 &&
    new Set(manifest.map((m) => m.slotKey)).size === 6 &&
    manifest.filter((m) => m.kind === 'catalogue').length === 4 &&
    manifest.filter((m) => m.kind === 'presenter').length === 2 &&
    rose === (generateRoseGold ? 3 : 0)
  );
}

// The ✓ / ✕ lines of the pre-generation summary.
export function manifestSummary(generateRoseGold: boolean): { label: string; included: boolean }[] {
  return generateRoseGold
    ? [
        { label: '2 Yellow Gold catalogue images', included: true },
        { label: '2 Rose Gold catalogue images', included: true },
        { label: '1 Yellow Gold presenter image', included: true },
        { label: '1 Rose Gold presenter image', included: true },
      ]
    : [
        { label: '4 Yellow Gold catalogue images', included: true },
        { label: '2 Yellow Gold presenter images', included: true },
        { label: 'Rose Gold images', included: false },
      ];
}

// Women/Unisex presenter images are composited onto a chosen presenter's
// photos, so one must be picked; Gents/Kids models are described in text.
export function presenterRequired(jewelleryType: JewelleryType | '', customerCategory: CustomerCategory | ''): boolean {
  return jewelleryType !== 'RING' && customerCategory !== 'GENTS' && customerCategory !== 'KIDS';
}

export function resolveAssetTypesForJob({
  generateRoseGold,
  jewelleryType,
}: {
  generateRoseGold: boolean;
  hasPresenter?: boolean;
  jewelleryType?: JewelleryType | '';
}): AssetType[] {
  return buildOutputManifest(jewelleryType, generateRoseGold).map((m) => m.assetType);
}

export function catalogueCount(types: AssetType[]): number {
  return types.filter(
    (t) =>
      t === 'YELLOW_FRONT' ||
      t === 'YELLOW_HERO_45' ||
      t === 'ROSE_FRONT' ||
      t === 'ROSE_HERO_45' ||
      t === 'YELLOW_SIDE' ||
      t === 'YELLOW_MACRO' ||
      t === 'RING_GOLD_HERO' ||
      t === 'RING_GOLD_PROFILE' ||
      t === 'RING_GOLD_MACRO' ||
      t === 'RING_ROSE_HERO' ||
      t === 'GOLD_HERO' ||
      t === 'GOLD_FRONT' ||
      t === 'GOLD_SIDE' ||
      t === 'GOLD_MACRO' ||
      t === 'RING_GOLD_FRONT' ||
      t === 'RING_GOLD_SIDE' ||
      t === 'RING_ROSE_FRONT' ||
      t === 'RING_ROSE_SIDE',
  ).length;
}

export function presenterCount(types: AssetType[]): number {
  return types.filter((t) => t.startsWith('PRESENTER_') || t.startsWith('MODEL_')).length;
}

export function handShotCount(types: AssetType[]): number {
  return types.filter((t) => t === 'RING_HAND_1' || t === 'RING_HAND_2' || t === 'RING_HAND_ROSE').length;
}

export const SHOT_LABELS: Record<AssetType, string> = {
  YELLOW_FRONT: 'Yellow Gold — Front Catalogue',
  YELLOW_HERO_45: 'Yellow Gold — 45° Hero Angle',
  ROSE_FRONT: 'Rose Gold — Front Catalogue',
  ROSE_HERO_45: 'Rose Gold — 45° Hero Angle',
  PRESENTER_YELLOW_1: 'Yellow Gold — Presenter',
  PRESENTER_YELLOW_2: 'Yellow Gold — Presenter (Alt Angle)',
  PRESENTER_ROSE: 'Rose Gold — Presenter',
  RING_HAND_1: 'Yellow Gold — Hand Pose 1',
  RING_HAND_2: 'Rose Gold — Hand Pose 2',
  RING_GOLD_FRONT: 'Yellow Gold — True Front View',
  RING_GOLD_SIDE: 'Yellow Gold — Three-Quarter Side View',
  RING_ROSE_FRONT: 'Rose Gold — True Front View',
  RING_ROSE_SIDE: 'Rose Gold — Three-Quarter Side View',
  YELLOW_SIDE: 'Yellow Gold — Side-Profile View',
  YELLOW_MACRO: 'Yellow Gold — Macro Detail View',
  RING_GOLD_HERO: 'Yellow Gold — Hero Three-Quarter View',
  RING_GOLD_PROFILE: 'Yellow Gold — Side-Profile View',
  RING_GOLD_MACRO: 'Yellow Gold — Macro Detail View',
  RING_ROSE_HERO: 'Rose Gold — Hero Three-Quarter View',
  RING_HAND_ROSE: 'Rose Gold — Hand Pose',
  GOLD_HERO: 'Yellow Gold — Hero Three-Quarter View',
  GOLD_FRONT: 'Yellow Gold — Front View',
  GOLD_SIDE: 'Yellow Gold — Side-Profile View',
  GOLD_MACRO: 'Yellow Gold — Macro Detail View',
  MODEL_1: 'Yellow Gold — Model 1',
  MODEL_2: 'Yellow Gold — Model 2',
};

// RING_HAND_2's label depends on the Rose Gold toggle (its static SHOT_LABELS
// entry above assumes Rose Gold is on, the common case) — every other Ring
// label is fixed regardless of the toggle.
export function ringShotLabel(assetType: AssetType, generateRoseGold: boolean): string {
  if (assetType === 'RING_HAND_2' && !generateRoseGold) return 'Yellow Gold — Hand Pose 2';
  return SHOT_LABELS[assetType];
}

export type AssetGroup = 'Yellow Gold' | 'Rose Gold' | 'Presenter' | 'Ring';

export function groupForAssetType(assetType: AssetType): AssetGroup {
  if (RING_ASSET_TYPE_SET.has(assetType)) return 'Ring';
  if (assetType.startsWith('PRESENTER_') || assetType.startsWith('MODEL_')) return 'Presenter';
  return assetType.startsWith('ROSE_') ? 'Rose Gold' : 'Yellow Gold';
}

// RING_HAND_2's metal follows the Rose Gold toggle (Rose when required, Gold
// otherwise) — every other asset type is unambiguous from its name alone, so
// the extra param is a no-op for them. Defaults to true (Rose Gold on) to
// match the previous no-arg call sites' assumption.
export function metalColorForAssetType(assetType: AssetType, generateRoseGold = true): 'YELLOW' | 'ROSE' {
  if (assetType === 'RING_HAND_2') return generateRoseGold ? 'ROSE' : 'YELLOW';
  if (assetType === 'RING_HAND_ROSE') return 'ROSE';
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
