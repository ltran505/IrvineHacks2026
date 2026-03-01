export function calculateStrainScore(metrics, baseline) {
  let score = 0;

  if (metrics.typingSpeed > baseline.typingSpeed * 1.3) score++;
  if (metrics.errorRate > baseline.errorRate * 1.25) score++;
  if (metrics.mouseJitter > baseline.mouseJitter * 1.3) score++;

  return score; // 0 = normal, 1 = mild, 2+ = elevated
}
