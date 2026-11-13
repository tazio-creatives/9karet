// AI Image Studio: a Ring-only output structure — 6 dedicated asset types
// (2 hand-model shots + 4 metal-matched catalogue shots: Front + Side
// Profile, no 45° Hero) replacing the generic 7-type vocabulary for Ring
// jobs only. Every other jewellery type keeps generating YELLOW_FRONT /
// YELLOW_HERO_45 / ROSE_* / PRESENTER_* exactly as before. Rings never use a
// Presenter (a "Hand Pose" choice replaces it), so the new hand_pose column
// lives on ai_studio_jobs alongside the existing presenter_id (left in place,
// just always null for a Ring job).

const RING_ASSET_TYPES = [
  'RING_HAND_1',
  'RING_HAND_2',
  'RING_GOLD_FRONT',
  'RING_GOLD_SIDE',
  'RING_ROSE_FRONT',
  'RING_ROSE_SIDE',
];

const HAND_POSES = [
  'BACK_OF_HAND_HERO',
  'ELEGANT_DIAGONAL',
  'SIDE_ROTATION',
  'SOFT_RESTING_POSE',
  'FINGER_DETAIL_CLOSEUP',
];

export const up = (pgm) => {
  pgm.sql(`ALTER TABLE ai_studio_assets DROP CONSTRAINT ai_studio_assets_asset_type_check;`);
  pgm.sql(`
    ALTER TABLE ai_studio_assets ADD CONSTRAINT ai_studio_assets_asset_type_check
      CHECK (asset_type IN (
        'YELLOW_FRONT','YELLOW_HERO_45','ROSE_FRONT','ROSE_HERO_45',
        'PRESENTER_YELLOW_1','PRESENTER_YELLOW_2','PRESENTER_ROSE',
        ${RING_ASSET_TYPES.map((t) => `'${t}'`).join(',')}
      ));
  `);

  // Ring's display_order is independent of the generic vocabulary's 0-6 —
  // each asset_type branch is checked on its own, so reusing 0-5 for the
  // Ring types (matching the client's Position 1-6 output table) doesn't
  // collide with YELLOW_FRONT=0 etc. above.
  pgm.sql(`ALTER TABLE ai_studio_assets DROP CONSTRAINT ai_studio_assets_display_order_check;`);
  pgm.sql(`
    ALTER TABLE ai_studio_assets ADD CONSTRAINT ai_studio_assets_display_order_check CHECK (
      (asset_type = 'YELLOW_FRONT'       AND display_order = 0) OR
      (asset_type = 'YELLOW_HERO_45'     AND display_order = 1) OR
      (asset_type = 'ROSE_FRONT'         AND display_order = 2) OR
      (asset_type = 'ROSE_HERO_45'       AND display_order = 3) OR
      (asset_type = 'PRESENTER_YELLOW_1' AND display_order = 4) OR
      (asset_type = 'PRESENTER_YELLOW_2' AND display_order = 5) OR
      (asset_type = 'PRESENTER_ROSE'     AND display_order = 6) OR
      (asset_type = 'RING_HAND_1'        AND display_order = 0) OR
      (asset_type = 'RING_HAND_2'        AND display_order = 1) OR
      (asset_type = 'RING_GOLD_FRONT'    AND display_order = 2) OR
      (asset_type = 'RING_GOLD_SIDE'     AND display_order = 3) OR
      (asset_type = 'RING_ROSE_FRONT'    AND display_order = 4) OR
      (asset_type = 'RING_ROSE_SIDE'     AND display_order = 5)
    );
  `);

  // "Set as Featured" stays limited to pure product shots — the 4 Ring
  // catalogue types (Front/Side, Gold/Rose), never the 2 hand-model shots,
  // mirroring the existing exclusion of PRESENTER_* shots.
  pgm.sql(`ALTER TABLE ai_studio_assets DROP CONSTRAINT ai_studio_assets_is_featured_check;`);
  pgm.sql(`
    ALTER TABLE ai_studio_assets ADD CONSTRAINT ai_studio_assets_is_featured_check
      CHECK (NOT is_featured OR asset_type IN (
        'YELLOW_FRONT','YELLOW_HERO_45','ROSE_FRONT','ROSE_HERO_45',
        'RING_GOLD_FRONT','RING_GOLD_SIDE','RING_ROSE_FRONT','RING_ROSE_SIDE'
      ));
  `);

  pgm.sql(`
    ALTER TABLE ai_studio_jobs ADD COLUMN hand_pose TEXT
      CHECK (hand_pose IN (${HAND_POSES.map((p) => `'${p}'`).join(',')}));
  `);
};

export const down = (pgm) => {
  pgm.sql(`ALTER TABLE ai_studio_jobs DROP COLUMN hand_pose;`);

  pgm.sql(`ALTER TABLE ai_studio_assets DROP CONSTRAINT ai_studio_assets_is_featured_check;`);
  pgm.sql(`
    ALTER TABLE ai_studio_assets ADD CONSTRAINT ai_studio_assets_is_featured_check
      CHECK (NOT is_featured OR asset_type IN ('YELLOW_FRONT','YELLOW_HERO_45','ROSE_FRONT','ROSE_HERO_45'));
  `);

  pgm.sql(`ALTER TABLE ai_studio_assets DROP CONSTRAINT ai_studio_assets_display_order_check;`);
  pgm.sql(`
    ALTER TABLE ai_studio_assets ADD CONSTRAINT ai_studio_assets_display_order_check CHECK (
      (asset_type = 'YELLOW_FRONT'       AND display_order = 0) OR
      (asset_type = 'YELLOW_HERO_45'     AND display_order = 1) OR
      (asset_type = 'ROSE_FRONT'         AND display_order = 2) OR
      (asset_type = 'ROSE_HERO_45'       AND display_order = 3) OR
      (asset_type = 'PRESENTER_YELLOW_1' AND display_order = 4) OR
      (asset_type = 'PRESENTER_YELLOW_2' AND display_order = 5) OR
      (asset_type = 'PRESENTER_ROSE'     AND display_order = 6)
    );
  `);

  pgm.sql(`DELETE FROM ai_studio_assets WHERE asset_type IN (${RING_ASSET_TYPES.map((t) => `'${t}'`).join(',')});`);
  pgm.sql(`ALTER TABLE ai_studio_assets DROP CONSTRAINT ai_studio_assets_asset_type_check;`);
  pgm.sql(`
    ALTER TABLE ai_studio_assets ADD CONSTRAINT ai_studio_assets_asset_type_check
      CHECK (asset_type IN (
        'YELLOW_FRONT','YELLOW_HERO_45','ROSE_FRONT','ROSE_HERO_45',
        'PRESENTER_YELLOW_1','PRESENTER_YELLOW_2','PRESENTER_ROSE'
      ));
  `);
};
