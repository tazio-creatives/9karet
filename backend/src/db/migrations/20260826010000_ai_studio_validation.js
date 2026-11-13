// AI Image Studio: mandatory category-confirmation audit trail, structured
// per-asset prompt review (recommended vs. customised), and automatic
// post-generation vision validation — plus Brooch/Other as two new,
// fully-supported jewellery types (catalogue + presenter generation both
// work for them, same as every existing type). See the approved plan at
// .claude/plans/sprightly-watching-mccarthy.md for the full design.

const NEW_TEMPLATES = [
  ['BROOCH', 'lapel or garment-focused presenter shot', 'portrait 4:5', 'a velvet jewellery box'],
  ['OTHER', 'natural-placement presenter shot', 'portrait 4:5', 'a neutral jewellery presentation tray'],
];

const FRONT_PROMPT =
  'A clean, straight-on catalogue product photo on a seamless neutral studio background, evenly lit, centred, no props, no people.';
const HERO_45_PROMPT =
  'A premium three-quarter (45 degree) angle product photo on a seamless neutral studio background, showing depth and surface detail, soft directional studio lighting, no props, no people.';

export const up = (pgm) => {
  // Brooch/Other join the selectable jewellery-type vocabulary. ai_studio_jobs
  // never had its own CHECK here (it's FK-constrained against this table's
  // jewellery_type values instead), so adding the two template rows below is
  // what actually unlocks them there too — no separate constraint change
  // needed on ai_studio_jobs.
  pgm.sql(
    `ALTER TABLE ai_studio_category_templates DROP CONSTRAINT ai_studio_category_templates_jewellery_type_check;`,
  );
  pgm.sql(`
    ALTER TABLE ai_studio_category_templates ADD CONSTRAINT ai_studio_category_templates_jewellery_type_check
      CHECK (jewellery_type IN
        ('RING','BRACELET','BANGLE','NECKLACE','EARRINGS','PENDANT','CHAIN','ANKLET','NOSE_PIN','MANGALSUTRA','BROOCH','OTHER'));
  `);

  pgm.sql(`ALTER TABLE presenters DROP CONSTRAINT presenters_supported_jewellery_types_check;`);
  pgm.sql(`
    ALTER TABLE presenters ADD CONSTRAINT presenters_supported_jewellery_types_check
      CHECK (supported_jewellery_types <@ ARRAY[
        'RING','BRACELET','BANGLE','NECKLACE','EARRINGS','PENDANT','CHAIN','ANKLET','NOSE_PIN','MANGALSUTRA','BROOCH','OTHER'
      ]::TEXT[]);
  `);

  // Fixed, code-authored reference data (not user input) — inlined directly
  // since pgm.sql() doesn't support parameter binding, same as the original
  // migration's own template seed.
  for (const [type, placement, crop, lifestyle] of NEW_TEMPLATES) {
    const lifestylePrompt = `A styled lifestyle product photo presenting the jewellery in or on ${lifestyle}, warm premium lighting, shallow depth of field, no people.`;
    pgm.sql(`
      INSERT INTO ai_studio_category_templates
        (jewellery_type, front_prompt, hero_45_prompt, presenter_placement, presenter_crop, lifestyle_prompt)
      VALUES ('${type}', '${FRONT_PROMPT}', '${HERO_45_PROMPT}', '${placement}', '${crop}', '${lifestylePrompt}');
    `);
  }

  // Category-confirmation audit trail (Problem 1).
  pgm.sql(`
    ALTER TABLE ai_studio_jobs
      ADD COLUMN existing_product_category TEXT,
      ADD COLUMN ai_detected_category TEXT,
      ADD COLUMN category_confirmed_at TIMESTAMPTZ,
      ADD COLUMN generation_version INTEGER NOT NULL DEFAULT 1;
  `);

  // Per-asset prompt review (recommended vs. customised) and post-generation
  // validation result (Problems 1 & 2 downstream, plus the new Review
  // Prompts / Review & Import screens).
  pgm.sql(`
    ALTER TABLE ai_studio_assets
      ADD COLUMN prompt_mode TEXT NOT NULL DEFAULT 'recommended' CHECK (prompt_mode IN ('recommended', 'customised')),
      ADD COLUMN custom_creative_instructions JSONB,
      ADD COLUMN assembled_final_prompt TEXT,
      ADD COLUMN validation_status TEXT CHECK (validation_status IN ('passed', 'warning', 'failed')),
      ADD COLUMN validation_result JSONB,
      ADD COLUMN validation_accepted BOOLEAN NOT NULL DEFAULT false;
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    ALTER TABLE ai_studio_assets
      DROP COLUMN prompt_mode,
      DROP COLUMN custom_creative_instructions,
      DROP COLUMN assembled_final_prompt,
      DROP COLUMN validation_status,
      DROP COLUMN validation_result,
      DROP COLUMN validation_accepted;
  `);

  pgm.sql(`
    ALTER TABLE ai_studio_jobs
      DROP COLUMN existing_product_category,
      DROP COLUMN ai_detected_category,
      DROP COLUMN category_confirmed_at,
      DROP COLUMN generation_version;
  `);

  pgm.sql(`DELETE FROM ai_studio_category_templates WHERE jewellery_type IN ('BROOCH', 'OTHER');`);

  pgm.sql(`ALTER TABLE presenters DROP CONSTRAINT presenters_supported_jewellery_types_check;`);
  pgm.sql(`
    ALTER TABLE presenters ADD CONSTRAINT presenters_supported_jewellery_types_check
      CHECK (supported_jewellery_types <@ ARRAY[
        'RING','BRACELET','BANGLE','NECKLACE','EARRINGS','PENDANT','CHAIN','ANKLET','NOSE_PIN','MANGALSUTRA'
      ]::TEXT[]);
  `);

  pgm.sql(
    `ALTER TABLE ai_studio_category_templates DROP CONSTRAINT ai_studio_category_templates_jewellery_type_check;`,
  );
  pgm.sql(`
    ALTER TABLE ai_studio_category_templates ADD CONSTRAINT ai_studio_category_templates_jewellery_type_check
      CHECK (jewellery_type IN
        ('RING','BRACELET','BANGLE','NECKLACE','EARRINGS','PENDANT','CHAIN','ANKLET','NOSE_PIN','MANGALSUTRA'));
  `);
};
