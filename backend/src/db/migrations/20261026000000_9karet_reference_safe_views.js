// 9karet: reference-safe catalogue views. Jobs that have no 45° reference
// use a slight 15–25° alternate view, and jobs with no side reference use a
// reference-faithful elevated detail view, instead of asking the model to
// invent an angle it has never seen. These are new image types; this only
// widens the allowed-type and featurable-type lists. No rows or columns
// change.

const NEW_TYPES = [
  'YELLOW_SLIGHT_ANGLE',
  'ROSE_SLIGHT_ANGLE',
  'YELLOW_ELEVATED_DETAIL',
  'RING_GOLD_SLIGHT_ANGLE',
  'RING_ROSE_SLIGHT_ANGLE',
  'RING_GOLD_ELEVATED_DETAIL',
];

const EXISTING_TYPES = [
  'YELLOW_FRONT', 'YELLOW_HERO_45', 'ROSE_FRONT', 'ROSE_HERO_45',
  'PRESENTER_YELLOW_1', 'PRESENTER_YELLOW_2', 'PRESENTER_ROSE',
  'RING_HAND_1', 'RING_HAND_2', 'RING_GOLD_FRONT', 'RING_GOLD_SIDE', 'RING_ROSE_FRONT', 'RING_ROSE_SIDE',
  'RING_GOLD_HERO', 'RING_GOLD_MACRO',
  'GOLD_HERO', 'GOLD_FRONT', 'GOLD_SIDE', 'GOLD_MACRO', 'MODEL_1', 'MODEL_2',
  'YELLOW_SIDE', 'YELLOW_MACRO', 'RING_GOLD_PROFILE', 'RING_ROSE_HERO', 'RING_HAND_ROSE',
];

const EXISTING_FEATURABLE = [
  'YELLOW_FRONT', 'YELLOW_HERO_45', 'ROSE_FRONT', 'ROSE_HERO_45',
  'RING_GOLD_FRONT', 'RING_GOLD_SIDE', 'RING_ROSE_FRONT', 'RING_ROSE_SIDE',
  'RING_GOLD_HERO', 'RING_GOLD_MACRO', 'GOLD_HERO', 'GOLD_FRONT', 'GOLD_SIDE', 'GOLD_MACRO',
  'YELLOW_SIDE', 'YELLOW_MACRO', 'RING_GOLD_PROFILE', 'RING_ROSE_HERO',
];

const list = (types) => types.map((t) => `'${t}'`).join(',');

const setLists = (pgm, types, featurable) => {
  pgm.sql(`ALTER TABLE ai_studio_assets DROP CONSTRAINT ai_studio_assets_asset_type_check;`);
  pgm.sql(`ALTER TABLE ai_studio_assets ADD CONSTRAINT ai_studio_assets_asset_type_check CHECK (asset_type IN (${list(types)}));`);
  pgm.sql(`ALTER TABLE ai_studio_assets DROP CONSTRAINT ai_studio_assets_is_featured_check;`);
  pgm.sql(`ALTER TABLE ai_studio_assets ADD CONSTRAINT ai_studio_assets_is_featured_check CHECK (NOT is_featured OR asset_type IN (${list(featurable)}));`);
};

export const up = (pgm) => {
  setLists(pgm, [...EXISTING_TYPES, ...NEW_TYPES], [...EXISTING_FEATURABLE, ...NEW_TYPES]);
};

// Only reversible while no job uses the new types; refuses rather than
// deleting generated images.
export const down = (pgm) => {
  pgm.sql(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM ai_studio_assets WHERE asset_type IN (${list(NEW_TYPES)})) THEN
        RAISE EXCEPTION 'Jobs already use the reference-safe view types; not rolling back';
      END IF;
    END $$;
  `);
  setLists(pgm, EXISTING_TYPES, EXISTING_FEATURABLE);
};
