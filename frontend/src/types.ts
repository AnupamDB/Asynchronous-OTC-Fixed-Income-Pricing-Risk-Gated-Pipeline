export type RfqStatus = "RECEIVED" | "PROCESSING" | "QUOTED" | "REJECTED" | "NEEDS_REVIEW" | "FAILED";

export interface InventoryRow {
  isin: string;
  issuer: string;
  maturityYear: number;
  availableNotional: string;
  hedgeCapacity: string;
  activeReservations: string;
  remainingCapacity: string;
  marketMidYield: string;
  updatedAt: string;
  fresh: boolean;
}

export interface DashboardSummary {
  clientId: string;
  creditLimit: string;
  currentExposure: string;
  activeReservations: string;
  availableCredit: string;
  creditUpdatedAt: string;
  asOf: string;
  inventory: InventoryRow[];
}

export interface TraceStep {
  agent: string;
  status: string;
  summary: string;
  details?: Record<string, unknown>;
}

export interface Quote {
  issuer: string;
  maturity_year: number;
  side: string;
  notional: string;
  quote_yield_pct: string;
  clean_price: string;
  spread_bps: number;
  market_mid_yield_pct: string;
  expires_in_seconds: number;
}

export interface RfqResult {
  quote?: Quote | null;
  steps?: TraceStep[];
  [key: string]: unknown;
}

export interface RfqRecord {
  id: string;
  clientId: string;
  rawText: string;
  status: RfqStatus;
  result?: RfqResult | null;
  createdAt: string;
}

export interface AuditEvent {
  occurredAt: string;
  eventType: string;
  previousStatus?: string | null;
  newStatus: string;
}
