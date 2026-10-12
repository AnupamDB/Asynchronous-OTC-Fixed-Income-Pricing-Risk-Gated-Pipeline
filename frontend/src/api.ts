import type { AuditEvent, DashboardSummary, RfqRecord } from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed with HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function getClients(): Promise<string[]> {
  return request("/api/dashboard/clients");
}

export function getSummary(clientId: string): Promise<DashboardSummary> {
  return request(`/api/dashboard/summary?clientId=${encodeURIComponent(clientId)}`);
}

export function getRecentRfqs(): Promise<RfqRecord[]> {
  return request("/api/rfqs?limit=10");
}

export function getRfq(id: string): Promise<RfqRecord> {
  return request(`/api/rfqs/${encodeURIComponent(id)}`);
}

export function getHistory(id: string): Promise<AuditEvent[]> {
  return request(`/api/rfqs/${encodeURIComponent(id)}/history`);
}

export async function submitRfq(clientId: string, rawText: string, file: File | null): Promise<RfqRecord> {
  const headers = { "Idempotency-Key": crypto.randomUUID() };
  if (file) {
    const form = new FormData();
    form.append("file", file);
    form.append("clientId", clientId);
    return request("/api/rfqs/documents", { method: "POST", headers, body: form });
  }
  return request("/api/rfqs", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, rawText }),
  });
}

export async function getWorkerHealth(): Promise<{ status: string; consumer_running: boolean }> {
  const response = await fetch("/worker/health");
  if (!response.ok) throw new Error(`Worker health returned HTTP ${response.status}`);
  return response.json();
}

export async function getCoreHealth(): Promise<{ status: string }> {
  const response = await fetch("/core/health");
  if (!response.ok) throw new Error(`Core health returned HTTP ${response.status}`);
  return response.json();
}
