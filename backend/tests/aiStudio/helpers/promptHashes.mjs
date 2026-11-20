// Hashes every generation prompt and every validation text the AI Studio can
// build, across category × rose gold × customer category × references ×
// Bangle quantity. Used to prove that a change leaves every prompt outside its
// intended scope byte-for-byte unchanged. Pure — no network, DB or paid calls.
//
// Regenerate the fixture (only from unchanged production code):
//   node tests/aiStudio/helpers/promptHashes.mjs > tests/aiStudio/fixtures/<name>.json
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

process.env.OPENAI_API_KEY ??= 'sk-test';
process.env.OPENAI_VISION_MODEL ??= 'vision-test';
process.env.OPENAI_IMAGE_MODEL ??= 'image-test';

const { JEWELLERY_TYPES, previewPromptsForJob, buildValidationText, REFERENCE_TEXT_NOTE, REFERENCE_TEXT_VALIDATION_NOTE } = await import('../../../src/services/aiStudioService.js');

export const TEMPLATE = {
  front_prompt: 'FRONT_PROMPT_TEXT',
  hero_45_prompt: 'HERO_PROMPT_TEXT',
  presenter_placement: 'wrist-focused presenter shot',
  presenter_crop: 'portrait 4:5',
};
export const PRESENTER = { id: 'p1', prompt_descriptor: 'a friendly presenter', style_label: 'Contemporary' };

const CUSTOMERS = [undefined, 'WOMEN', 'GENTS', 'KIDS', 'UNISEX'];
const REFERENCES = [
  { angle45: false, side: false },
  { angle45: true, side: false },
  { angle45: false, side: true },
  { angle45: true, side: true },
];
const QUANTITIES = [undefined, 'SINGLE_BANGLE', 'TWO_BANGLE_SET'];

const sha = (s) => createHash('sha256').update(s).digest('hex');

// key -> { quantity, type, assetType, kind, prompt: sha, validation: sha }
// stripReferenceTextNote: remove the "ignore printed text on the reference"
// notes (added 2026-11-20 to every prompt and validation text) before
// hashing, to compare everything else against older baselines.
export function computePromptHashes({ stripReferenceTextNote = false } = {}) {
  const strip = (s, note) => (stripReferenceTextNote ? s.split(` ${note}`).join('') : s);
  const out = {};
  for (const type of JEWELLERY_TYPES) {
    for (const rose of [false, true]) {
      for (const cust of CUSTOMERS) {
        for (const [ri, references] of REFERENCES.entries()) {
          for (const quantity of QUANTITIES) {
            let previews;
            try {
              previews = previewPromptsForJob({
                confirmedType: type,
                template: TEMPLATE,
                presenter: PRESENTER,
                generateRoseGold: rose,
                confirmedCustomerCategory: cust,
                references,
                bangleQuantity: quantity,
              });
            } catch (err) {
              out[`${type}|${rose}|${cust}|${ri}|${quantity}|ERROR`] = { quantity: quantity ?? null, type, error: err.message };
              continue;
            }
            for (const p of previews) {
              const validation = buildValidationText({
                confirmedType: type,
                metalColor: p.metalColor,
                assetType: p.assetType,
                confirmedCustomerCategory: cust,
                bangleQuantity: quantity,
              });
              out[`${type}|${rose}|${cust}|${ri}|${quantity}|${p.slotKey}|${p.assetType}`] = {
                quantity: quantity ?? null,
                type,
                assetType: p.assetType,
                kind: p.kind,
                prompt: sha(strip(p.finalPrompt, REFERENCE_TEXT_NOTE)),
                validation: sha(strip(validation, REFERENCE_TEXT_VALIDATION_NOTE)),
              };
            }
          }
        }
      }
    }
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(`${JSON.stringify(computePromptHashes(), null, 0)}\n`);
}
