// Shared CSS-gradient placeholders standing in for product photography —
// no image assets exist yet (upload lands in Phase 9/15). Used by both
// BentoCard (homepage) and ProductCard (PLP/PDP) so cards look consistent.
const GRADIENTS = [
  'linear-gradient(135deg, #0c0c0c, #6d1b2f)',
  'linear-gradient(135deg, #d9ad42, #4a1220)',
  'linear-gradient(135deg, #4a1220, #0c0c0c)',
  'linear-gradient(135deg, #17140f, #b08d57)',
];

export function placeholderGradient(index: number): string {
  return GRADIENTS[index % GRADIENTS.length];
}
