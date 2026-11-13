// AI Image Studio (see plan: upload -> analyse & confirm -> choose presenter
// -> generate 4 images -> review & import). Deliberately separate from
// ai_image_jobs/ai_generated_images (the simpler, stub-only pipeline that
// auto-triggers on every manual photo upload) — that state machine only
// models "regenerate N interchangeable candidates," while this one needs a
// materially different shape: analysis results, an admin-confirmed category,
// a chosen presenter style, and 4 semantically distinct, independently
// generated/retryable output roles.

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE ai_studio_category_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      jewellery_type TEXT NOT NULL UNIQUE CHECK (jewellery_type IN
        ('RING','BRACELET','BANGLE','NECKLACE','EARRINGS','PENDANT','CHAIN','ANKLET','NOSE_PIN','MANGALSUTRA')),
      front_prompt TEXT NOT NULL,
      hero_45_prompt TEXT NOT NULL,
      presenter_placement TEXT NOT NULL,
      presenter_crop TEXT NOT NULL,
      lifestyle_prompt TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // 'UNKNOWN' is a valid analysis result but deliberately has no template row
  // here — it always forces a manual category pick (one of the 10 real
  // types) before generation can proceed.

  pgm.sql(`
    CREATE TABLE ai_studio_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'uploading' CHECK (status IN
        ('draft','uploading','analysing','awaiting_confirmation','generating',
         'review_ready','importing','completed','failed','partially_failed','cancelled')),
      reference_image_urls JSONB NOT NULL DEFAULT '[]',
      analysis JSONB,
      analysis_confidence NUMERIC(4,3),
      jewellery_type TEXT REFERENCES ai_studio_category_templates(jewellery_type),
      category_id UUID REFERENCES categories(id),
      metal_color TEXT CHECK (metal_color IN ('YELLOW','ROSE','WHITE')),
      presenter_style TEXT CHECK (presenter_style IN ('CONTEMPORARY','TRADITIONAL')),
      prompt_version TEXT NOT NULL,
      template_version TEXT NOT NULL,
      analysis_model TEXT,
      image_model TEXT,
      confirmed_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql('CREATE INDEX ai_studio_jobs_product_id_idx ON ai_studio_jobs(product_id);');
  // Only one job may be "in flight" per product at a time (plan §8).
  pgm.sql(`
    CREATE UNIQUE INDEX ai_studio_jobs_one_active_per_product
      ON ai_studio_jobs(product_id)
      WHERE status IN ('draft','uploading','analysing','awaiting_confirmation','generating','importing');
  `);

  pgm.sql(`
    CREATE TABLE ai_studio_assets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id UUID NOT NULL REFERENCES ai_studio_jobs(id) ON DELETE CASCADE,
      shot_type TEXT NOT NULL CHECK (shot_type IN ('FRONT','HERO_45','PRESENTER','LIFESTYLE')),
      display_order INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','GENERATING','READY','FAILED')),
      image_key TEXT,
      quality_assessment JSONB,
      generation_metadata JSONB,
      selected BOOLEAN NOT NULL DEFAULT true,
      is_featured BOOLEAN NOT NULL DEFAULT false,
      imported BOOLEAN NOT NULL DEFAULT false,
      retry_count INTEGER NOT NULL DEFAULT 0,
      generation_started_at TIMESTAMPTZ,
      generation_completed_at TIMESTAMPTZ,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (job_id, shot_type),
      CHECK (NOT is_featured OR shot_type = 'FRONT'),
      CHECK (
        (shot_type = 'FRONT'     AND display_order = 0) OR
        (shot_type = 'HERO_45'   AND display_order = 1) OR
        (shot_type = 'PRESENTER' AND display_order = 2) OR
        (shot_type = 'LIFESTYLE' AND display_order = 3)
      )
    );
  `);
  pgm.sql('CREATE INDEX ai_studio_assets_job_id_idx ON ai_studio_assets(job_id);');

  // Fixed, code-authored reference data (not user input) — inlined directly
  // since pgm.sql() doesn't support parameter binding. Front/hero-45 prompts
  // share a category-agnostic framing instruction; only presenter placement,
  // crop and lifestyle display genuinely vary by category (plan §9).
  const templates = [
    ['RING', 'hand-focused presenter shot', 'portrait 4:5', 'an open ring box on a soft neutral surface'],
    ['BRACELET', 'wrist-focused presenter shot', 'portrait 4:5', 'a bracelet box or silk cushion'],
    ['BANGLE', 'wrist-focused presenter shot', 'portrait 4:5', 'a bangle stand or box'],
    ['NECKLACE', 'neck and upper chest presenter shot', 'portrait 4:5', 'a necklace bust or presentation box'],
    ['EARRINGS', 'ear and face close-up presenter shot', 'portrait 4:5', 'an earring box or display card'],
    ['PENDANT', 'neck close-up presenter shot', 'portrait 4:5', 'a pendant box or velvet tray'],
    ['CHAIN', 'neck and shoulder presenter shot', 'portrait 4:5', 'a velvet tray'],
    ['ANKLET', 'ankle-focused presenter shot', 'portrait 4:5', 'a silk cushion or jewellery box'],
    ['NOSE_PIN', 'facial-profile close-up presenter shot', 'portrait 4:5', 'a small jewellery box'],
    ['MANGALSUTRA', 'traditional neck portrait presenter shot', 'portrait 4:5', 'a velvet necklace box'],
  ];
  const frontPrompt =
    'A clean, straight-on catalogue product photo on a seamless neutral studio background, evenly lit, centred, no props, no people.';
  const hero45Prompt =
    'A premium three-quarter (45 degree) angle product photo on a seamless neutral studio background, showing depth and surface detail, soft directional studio lighting, no props, no people.';

  for (const [type, placement, crop, lifestyle] of templates) {
    const lifestylePrompt = `A styled lifestyle product photo presenting the jewellery in or on ${lifestyle}, warm premium lighting, shallow depth of field, no people.`;
    pgm.sql(`
      INSERT INTO ai_studio_category_templates
        (jewellery_type, front_prompt, hero_45_prompt, presenter_placement, presenter_crop, lifestyle_prompt)
      VALUES ('${type}', '${frontPrompt}', '${hero45Prompt}', '${placement}', '${crop}', '${lifestylePrompt}');
    `);
  }
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS ai_studio_assets;');
  pgm.sql('DROP TABLE IF EXISTS ai_studio_jobs;');
  pgm.sql('DROP TABLE IF EXISTS ai_studio_category_templates;');
};
