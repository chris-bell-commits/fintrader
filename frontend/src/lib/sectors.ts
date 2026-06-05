export type Sector = "TECH" | "HEALTHCARE" | "FINANCE";

export const SECTOR_ORDER: Sector[] = ["TECH", "HEALTHCARE", "FINANCE"];

const SECTOR_MAP: Record<string, Sector> = {
  AAPL: "TECH",
  GOOGL: "TECH",
  MSFT: "TECH",
  AMZN: "TECH",
  TSLA: "TECH",
  NVDA: "TECH",
  META: "TECH",
  NFLX: "TECH",
  SGE: "TECH",
  SCT: "TECH",
  RPI: "TECH",
  RSW: "TECH",
  LLY: "HEALTHCARE",
  JNJ: "HEALTHCARE",
  NVO: "HEALTHCARE",
  AZN: "HEALTHCARE",
  UNH: "HEALTHCARE",
  CVS: "HEALTHCARE",
  JPM: "FINANCE",
  V: "FINANCE",
};

export function sectorFor(ticker: string): Sector {
  return SECTOR_MAP[ticker] ?? "TECH";
}
