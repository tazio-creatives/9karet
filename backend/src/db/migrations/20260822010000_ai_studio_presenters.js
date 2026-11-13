// AI Image Studio redesign: a real, image-backed Presenter Library replaces
// the old 2-value presenter_style text enum; Rose Gold becomes an additive
// per-job toggle instead of a single metal_color choice (White Gold and
// metal-color correction are dropped from this flow entirely); shot_type
// becomes asset_type with a new 7-value vocabulary that encodes metal color
// directly (e.g. ROSE_FRONT) so a job can generate a variable-count set of
// assets (2/4/4/6) instead of always exactly 4. See the approved plan at
// .claude/plans/sprightly-watching-mccarthy.md for the full design.

export const up = (pgm) => {
  // Old in-flight/completed AI Studio jobs used the FRONT/HERO_45/PRESENTER/
  // LIFESTYLE vocabulary, which has no clean 1:1 mapping onto the new
  // metal-color-aware asset types below (and LIFESTYLE is dropped outright).
  // These are dev-only test jobs, not real imported product data (imported
  // images already live independently in product_images) — safe to clear.
  pgm.sql(`DELETE FROM ai_studio_jobs;`);

  pgm.sql(`
    CREATE TABLE presenters (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      display_name TEXT NOT NULL,
      style_label TEXT NOT NULL,
      main_preview_image_url TEXT NOT NULL,
      front_portrait_url TEXT NOT NULL,
      face_45_url TEXT NOT NULL,
      side_profile_url TEXT NOT NULL,
      jewellery_placement_url TEXT NOT NULL,
      prompt_descriptor TEXT,
      supported_jewellery_types TEXT[] NOT NULL DEFAULT '{}'
        CHECK (supported_jewellery_types <@ ARRAY[
          'RING','BRACELET','BANGLE','NECKLACE','EARRINGS','PENDANT','CHAIN','ANKLET','NOSE_PIN','MANGALSUTRA'
        ]::TEXT[]),
      is_active BOOLEAN NOT NULL DEFAULT true,
      is_default BOOLEAN NOT NULL DEFAULT false,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql(`CREATE UNIQUE INDEX presenters_one_default ON presenters(is_default) WHERE is_default = true;`);

  pgm.sql(`ALTER TABLE ai_studio_jobs ADD COLUMN presenter_id UUID REFERENCES presenters(id);`);
  pgm.sql(`ALTER TABLE ai_studio_jobs ADD COLUMN generate_rose_gold BOOLEAN NOT NULL DEFAULT true;`);
  pgm.sql(`ALTER TABLE ai_studio_jobs DROP CONSTRAINT ai_studio_jobs_presenter_style_check;`);
  pgm.sql(`ALTER TABLE ai_studio_jobs DROP COLUMN presenter_style;`);
  pgm.sql(`ALTER TABLE ai_studio_jobs DROP CONSTRAINT ai_studio_jobs_metal_color_check;`);
  pgm.sql(`ALTER TABLE ai_studio_jobs DROP COLUMN metal_color;`);

  pgm.sql(`ALTER TABLE ai_studio_assets RENAME COLUMN shot_type TO asset_type;`);

  pgm.sql(`ALTER TABLE ai_studio_assets DROP CONSTRAINT ai_studio_assets_shot_type_check;`);
  pgm.sql(`
    ALTER TABLE ai_studio_assets ADD CONSTRAINT ai_studio_assets_asset_type_check
      CHECK (asset_type IN (
        'YELLOW_FRONT','YELLOW_HERO_45','ROSE_FRONT','ROSE_HERO_45',
        'PRESENTER_YELLOW_1','PRESENTER_YELLOW_2','PRESENTER_ROSE'
      ));
  `);

  pgm.sql(`ALTER TABLE ai_studio_assets DROP CONSTRAINT ai_studio_assets_check1;`);
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

  // Relaxed from "only FRONT" to any catalogue-type shot — Step 5 of the new
  // wizard lets the admin choose which generated catalogue image (yellow or
  // rose, front or hero) becomes the product's featured/primary image.
  pgm.sql(`ALTER TABLE ai_studio_assets DROP CONSTRAINT ai_studio_assets_check;`);
  pgm.sql(`
    ALTER TABLE ai_studio_assets ADD CONSTRAINT ai_studio_assets_is_featured_check
      CHECK (NOT is_featured OR asset_type IN ('YELLOW_FRONT','YELLOW_HERO_45','ROSE_FRONT','ROSE_HERO_45'));
  `);

  pgm.sql(`ALTER TABLE ai_studio_assets RENAME CONSTRAINT ai_studio_assets_job_id_shot_type_key TO ai_studio_assets_job_id_asset_type_key;`);
};

export const down = (pgm) => {
  pgm.sql(`ALTER TABLE ai_studio_assets RENAME CONSTRAINT ai_studio_assets_job_id_asset_type_key TO ai_studio_assets_job_id_shot_type_key;`);

  pgm.sql(`ALTER TABLE ai_studio_assets DROP CONSTRAINT ai_studio_assets_is_featured_check;`);
  pgm.sql(`ALTER TABLE ai_studio_assets ADD CONSTRAINT ai_studio_assets_check CHECK (NOT is_featured OR asset_type = 'FRONT');`);

  pgm.sql(`ALTER TABLE ai_studio_assets DROP CONSTRAINT ai_studio_assets_display_order_check;`);
  pgm.sql(`
    ALTER TABLE ai_studio_assets ADD CONSTRAINT ai_studio_assets_check1 CHECK (
      (asset_type = 'FRONT' AND display_order = 0) OR
      (asset_type = 'HERO_45' AND display_order = 1) OR
      (asset_type = 'PRESENTER' AND display_order = 2) OR
      (asset_type = 'LIFESTYLE' AND display_order = 3)
    );
  `);

  pgm.sql(`ALTER TABLE ai_studio_assets DROP CONSTRAINT ai_studio_assets_asset_type_check;`);
  pgm.sql(`
    ALTER TABLE ai_studio_assets ADD CONSTRAINT ai_studio_assets_shot_type_check
      CHECK (asset_type IN ('FRONT','HERO_45','PRESENTER','LIFESTYLE'));
  `);

  pgm.sql(`ALTER TABLE ai_studio_assets RENAME COLUMN asset_type TO shot_type;`);

  pgm.sql(`ALTER TABLE ai_studio_jobs ADD COLUMN metal_color TEXT CHECK (metal_color IN ('YELLOW','ROSE','WHITE'));`);
  pgm.sql(`ALTER TABLE ai_studio_jobs ADD COLUMN presenter_style TEXT CHECK (presenter_style IN ('CONTEMPORARY','TRADITIONAL'));`);
  pgm.sql(`ALTER TABLE ai_studio_jobs DROP COLUMN generate_rose_gold;`);
  pgm.sql(`ALTER TABLE ai_studio_jobs DROP COLUMN presenter_id;`);

  pgm.sql(`DROP TABLE presenters;`);
};
