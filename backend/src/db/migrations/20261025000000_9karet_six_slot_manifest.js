// 9karet six-image AI Studio jobs: every new job stores an explicit
// six-slot output manifest (ai_studio_jobs.output_manifest) and each of its
// assets carries its slot key, with display_order = the slot's position.
//
// Existing jobs and assets are not touched: output_manifest and slot_key
// stay NULL for them, so they keep their original assets and behaviour.
// generate_rose_gold keeps every existing value; only the default for jobs
// created from now on becomes false (the switch starts OFF).

const ASSET_TYPES = [
  'YELLOW_FRONT', 'YELLOW_HERO_45', 'ROSE_FRONT', 'ROSE_HERO_45',
  'PRESENTER_YELLOW_1', 'PRESENTER_YELLOW_2', 'PRESENTER_ROSE',
  'RING_HAND_1', 'RING_HAND_2', 'RING_GOLD_FRONT', 'RING_GOLD_SIDE', 'RING_ROSE_FRONT', 'RING_ROSE_SIDE',
  'RING_GOLD_HERO', 'RING_GOLD_MACRO',
  'GOLD_HERO', 'GOLD_FRONT', 'GOLD_SIDE', 'GOLD_MACRO', 'MODEL_1', 'MODEL_2',
];
const NEW_ASSET_TYPES = ['YELLOW_SIDE', 'YELLOW_MACRO', 'RING_GOLD_PROFILE', 'RING_ROSE_HERO', 'RING_HAND_ROSE'];

const FEATURABLE = [
  'YELLOW_FRONT', 'YELLOW_HERO_45', 'ROSE_FRONT', 'ROSE_HERO_45',
  'RING_GOLD_FRONT', 'RING_GOLD_SIDE', 'RING_ROSE_FRONT', 'RING_ROSE_SIDE',
  'RING_GOLD_HERO', 'RING_GOLD_MACRO', 'GOLD_HERO', 'GOLD_FRONT', 'GOLD_SIDE', 'GOLD_MACRO',
];
const NEW_FEATURABLE = ['YELLOW_SIDE', 'YELLOW_MACRO', 'RING_GOLD_PROFILE', 'RING_ROSE_HERO'];

// The per-type order the existing rows follow (see the restore migration).
const LEGACY_ORDER = {
  YELLOW_FRONT: 0,
  YELLOW_HERO_45: 1,
  ROSE_FRONT: 2,
  ROSE_HERO_45: 3,
  PRESENTER_YELLOW_1: 4,
  PRESENTER_YELLOW_2: 5,
  PRESENTER_ROSE: 6,
  GOLD_HERO: 0,
  GOLD_FRONT: 1,
  GOLD_SIDE: 2,
  GOLD_MACRO: 3,
  MODEL_1: 4,
  MODEL_2: 5,
  RING_GOLD_HERO: 0,
  RING_GOLD_MACRO: 3,
  RING_HAND_1: 0,
  RING_HAND_2: 1,
  RING_GOLD_FRONT: 2,
  RING_GOLD_SIDE: 3,
  RING_ROSE_FRONT: 4,
  RING_ROSE_SIDE: 5,
};

const list = (types) => types.map((t) => `'${t}'`).join(',');
const legacyOrderCheck = Object.entries(LEGACY_ORDER)
  .map(([t, n]) => `(asset_type = '${t}' AND display_order = ${n})`)
  .join(' OR\n  ');

export const up = (pgm) => {
  pgm.sql(`ALTER TABLE ai_studio_jobs ADD COLUMN output_manifest JSONB;`);
  pgm.sql(`ALTER TABLE ai_studio_jobs ALTER COLUMN generate_rose_gold SET DEFAULT false;`);

  pgm.sql(`ALTER TABLE ai_studio_assets ADD COLUMN slot_key TEXT;`);
  pgm.sql(`CREATE UNIQUE INDEX ai_studio_assets_job_slot_key ON ai_studio_assets (job_id, slot_key) WHERE slot_key IS NOT NULL;`);

  pgm.sql(`ALTER TABLE ai_studio_assets DROP CONSTRAINT ai_studio_assets_asset_type_check;`);
  pgm.sql(`ALTER TABLE ai_studio_assets ADD CONSTRAINT ai_studio_assets_asset_type_check CHECK (asset_type IN (${list([...ASSET_TYPES, ...NEW_ASSET_TYPES])}));`);

  // Six-slot assets are ordered by their slot (0-5); older rows keep the
  // per-type order they were created with.
  pgm.sql(`ALTER TABLE ai_studio_assets DROP CONSTRAINT ai_studio_assets_display_order_check;`);
  pgm.sql(`
    ALTER TABLE ai_studio_assets ADD CONSTRAINT ai_studio_assets_display_order_check CHECK (
      (slot_key IS NOT NULL AND display_order BETWEEN 0 AND 5) OR
      (slot_key IS NULL AND (${legacyOrderCheck}))
    );
  `);

  pgm.sql(`ALTER TABLE ai_studio_assets DROP CONSTRAINT ai_studio_assets_is_featured_check;`);
  pgm.sql(`ALTER TABLE ai_studio_assets ADD CONSTRAINT ai_studio_assets_is_featured_check CHECK (NOT is_featured OR asset_type IN (${list([...FEATURABLE, ...NEW_FEATURABLE])}));`);
};

export const down = (pgm) => {
  pgm.sql(`DELETE FROM ai_studio_assets WHERE slot_key IS NOT NULL;`);

  pgm.sql(`ALTER TABLE ai_studio_assets DROP CONSTRAINT ai_studio_assets_is_featured_check;`);
  pgm.sql(`ALTER TABLE ai_studio_assets ADD CONSTRAINT ai_studio_assets_is_featured_check CHECK (NOT is_featured OR asset_type IN (${list(FEATURABLE)}));`);
  pgm.sql(`ALTER TABLE ai_studio_assets DROP CONSTRAINT ai_studio_assets_display_order_check;`);
  pgm.sql(`ALTER TABLE ai_studio_assets ADD CONSTRAINT ai_studio_assets_display_order_check CHECK (${legacyOrderCheck});`);
  pgm.sql(`ALTER TABLE ai_studio_assets DROP CONSTRAINT ai_studio_assets_asset_type_check;`);
  pgm.sql(`ALTER TABLE ai_studio_assets ADD CONSTRAINT ai_studio_assets_asset_type_check CHECK (asset_type IN (${list(ASSET_TYPES)}));`);

  pgm.sql(`DROP INDEX ai_studio_assets_job_slot_key;`);
  pgm.sql(`ALTER TABLE ai_studio_assets DROP COLUMN slot_key;`);
  pgm.sql(`ALTER TABLE ai_studio_jobs ALTER COLUMN generate_rose_gold SET DEFAULT true;`);
  pgm.sql(`ALTER TABLE ai_studio_jobs DROP COLUMN output_manifest;`);
};
