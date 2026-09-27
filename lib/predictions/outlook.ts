export type OutlookRisk = "low" | "watch" | "high" | "severe";

export function riskFromSignals(
  rain24h: number,
  rain72h: number,
  recent72h: number,
  riverDischarge: number | null,
  pastRiverMaximum: number | null,
): { score: number; risk: OutlookRisk; reasons: string[] } {
  const rainScore = Math.min(65, rain24h * 0.65 + rain72h * 0.22);
  const wetGround = Math.min(15, recent72h * 0.12);
  const riverRatio =
    riverDischarge !== null && pastRiverMaximum !== null && pastRiverMaximum > 0
      ? riverDischarge / pastRiverMaximum
      : null;
  const riverScore =
    riverRatio === null ? 0 : Math.min(30, Math.max(0, (riverRatio - 0.8) * 45));
  const score = Math.round(Math.min(100, rainScore + wetGround + riverScore));
  const risk: OutlookRisk =
    score >= 75 ? "severe" : score >= 50 ? "high" : score >= 25 ? "watch" : "low";
  const reasons = [
    `${rain24h.toFixed(1)} mm forecast rain in 24 hours`,
    `${recent72h.toFixed(1)} mm rain in the preceding 72 hours`,
  ];
  if (riverRatio !== null)
    reasons.push(`River discharge ${riverRatio.toFixed(2)}× the recent maximum`);
  return { score, risk, reasons };
}

export function sumFinite(values: Array<number | null | undefined>): number {
  return values.reduce<number>(
    (total, value) => total + (Number.isFinite(value) ? Number(value) : 0),
    0,
  );
}
