export interface UsageRingPercentages {
  total: number | null;
  download: number;
  upload: number;
  mode: "limit" | "traffic-share";
}

const safeNonNegative = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, value) : 0;

const percentage = (value: number, denominator: number): number => {
  if (denominator <= 0) return 0;
  return Math.min((safeNonNegative(value) / denominator) * 100, 100);
};

/**
 * Capped plans measure every ring against the package limit, so download plus
 * upload visually explains the total. Uncapped plans have no limit; their two
 * rings therefore show each direction's share of measured traffic.
 */
export function calculateUsageRingPercentages(
  downloadGb: number,
  uploadGb: number,
  totalGb: number,
  limitGb: number | null | undefined,
  isUnlimited: boolean,
): UsageRingPercentages {
  const download = safeNonNegative(downloadGb);
  const upload = safeNonNegative(uploadGb);

  if (isUnlimited) {
    const measuredTraffic = download + upload;
    return {
      total: null,
      download: percentage(download, measuredTraffic),
      upload: percentage(upload, measuredTraffic),
      mode: "traffic-share",
    };
  }

  const limit = safeNonNegative(limitGb ?? 0);
  return {
    total: limit > 0 ? percentage(totalGb, limit) : null,
    download: percentage(download, limit),
    upload: percentage(upload, limit),
    mode: "limit",
  };
}
