import { useCallback, useEffect, useState } from "react";
import {
  getClients,
  getCoreHealth,
  getHistory,
  getRecentRfqs,
  getRfq,
  getSummary,
  getWorkerHealth,
  submitRfq,
} from "./api";
import type { AuditEvent, DashboardSummary, RfqRecord, RfqStatus, TraceStep } from "./types";

const sampleRfq =
  "We want to buy $50M nominal of Apple 2030 senior unsecured notes, targeting 4.5% yield. What can you do?";

const terminalStatuses = new Set<RfqStatus>(["QUOTED", "REJECTED", "NEEDS_REVIEW", "FAILED"]);

function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    grid: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
    swap: "M4 7h15m0 0-4-4m4 4-4 4M20 17H5m0 0 4 4m-4-4 4-4",
    chart: "M4 19V5m0 14h16M8 15l3-4 3 2 5-7",
    doc: "M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm7 0v5h5M9 13h7M9 17h7",
    search: "m20 20-4.5-4.5M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0z",
    arrow: "M5 12h14m-6-6 6 6-6 6",
    plus: "M12 5v14M5 12h14",
    upload: "M12 16V4m0 0L7 9m5-5 5 5M5 15v4h14v-4",
    refresh: "M20 7v5h-5M4 17v-5h5m10-3a7 7 0 0 0-12-2L4 12m16 0-3 5a7 7 0 0 1-12 0",
    close: "m6 6 12 12M18 6 6 18",
    shield: "M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11zm-3-11 2 2 4-4",
    clock: "M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  };
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name] ?? paths.grid} />
    </svg>
  );
}

function money(value: string | number | undefined): string {
  if (value === undefined) return "—";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function dateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function statusLabel(status: string): string {
  return status.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge status-${status.toLowerCase().replaceAll("_", "-")}`}><i />{statusLabel(status)}</span>;
}

function Header({
  clientId,
  clients,
  onClientChange,
  coreUp,
  workerUp,
  lastUpdated,
  refreshing,
  onRefresh,
}: {
  clientId: string;
  clients: string[];
  onClientChange: (client: string) => void;
  coreUp: boolean;
  workerUp: boolean;
  lastUpdated: Date | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <header className="topbar">
      <div className="breadcrumbs"><span>Markets</span><span className="crumb-slash">/</span><strong>RFQ Workbench</strong></div>
      <div className="topbar-actions">
        <div className="service-health">
          <span className={coreUp ? "health-dot" : "health-dot down"} />
          <span>Core API</span>
          <span className={workerUp ? "health-dot" : "health-dot down"} />
          <span>Agent</span>
        </div>
        <span className="topbar-divider" />
        <label className="client-select-label" htmlFor="client-select">Client book</label>
        <select id="client-select" value={clientId} onChange={(event) => onClientChange(event.target.value)}>
          {clients.map((client) => <option key={client} value={client}>{client}</option>)}
        </select>
        <button className="icon-button refresh-button" onClick={onRefresh} title="Refresh dashboard" aria-label="Refresh dashboard">
          <Icon name="refresh" />
        </button>
        {lastUpdated && <span className="updated-label">{refreshing ? "Refreshing" : `Synced ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}</span>}
      </div>
    </header>
  );
}

function MetricCard({ label, value, note, accent, icon }: { label: string; value: string; note: string; accent: string; icon: string }) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${accent}`}><Icon name={icon} /></div>
      <div className="metric-copy">
        <div className="metric-label">{label}</div>
        <div className="metric-value">{value}</div>
        <div className="metric-note">{note}</div>
      </div>
      <div className={`metric-accent ${accent}`} />
    </article>
  );
}

function InventoryTable({ summary }: { summary: DashboardSummary | null }) {
  const inventory = summary?.inventory ?? [];
  return (
    <section className="panel inventory-panel">
      <div className="panel-heading">
        <div><div className="eyebrow">Desk inventory</div><h2>Bond capacity</h2></div>
        <span className="live-indicator"><i /> Live snapshot</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Security</th><th>Available</th><th>Hedge</th><th>Reserved</th><th>Quoteable</th><th>Mid yield</th><th>Market</th></tr></thead>
          <tbody>
            {inventory.map((bond) => (
              <tr key={bond.isin}>
                <td><div className="security-name">{bond.issuer} {bond.maturityYear}</div><div className="security-id">{bond.isin}</div></td>
                <td>{money(bond.availableNotional)}</td>
                <td>{money(bond.hedgeCapacity)}</td>
                <td>{money(bond.activeReservations)}</td>
                <td className="emphasis-cell">{money(bond.remainingCapacity)}</td>
                <td>{bond.marketMidYield}%</td>
                <td><span className={`market-state ${bond.fresh ? "" : "stale"}`}><i />{bond.fresh ? "Fresh" : "Stale"}</span></td>
              </tr>
            ))}
            {!inventory.length && <tr><td className="empty-cell" colSpan={7}>{summary ? "No inventory snapshots configured for this desk." : "Loading inventory..."}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="panel-footnote">Active reservations expire after 15 seconds. Quoteable capacity reflects current reservations.</div>
    </section>
  );
}

function RfqComposer({
  clientId,
  onSubmit,
  submitting,
  error,
}: {
  clientId: string;
  onSubmit: (text: string, file: File | null) => void;
  submitting: boolean;
  error: string;
}) {
  const [text, setText] = useState(sampleRfq);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  const selectFile = (candidate?: File) => {
    if (!candidate) return;
    const validExtension = /\.(pdf|eml|txt)$/i.test(candidate.name);
    if (!validExtension) {
      setFile(null);
      return;
    }
    if (candidate.size > 10 * 1024 * 1024) {
      setFile(null);
      return;
    }
    setFile(candidate);
  };

  return (
    <section className="panel composer-panel">
      <div className="panel-heading">
        <div><div className="eyebrow">New workflow</div><h2>Capture client interest</h2></div>
        <span className="step-pill">01 <span>/</span> 03</span>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); onSubmit(text, file); }}>
        <label className="field-label" htmlFor="rfq-text">Client request <span>Required</span></label>
        <textarea id="rfq-text" value={text} onChange={(event) => setText(event.target.value)} rows={4} maxLength={20000} disabled={submitting} />
        <div className="input-meta"><span>Free-text · up to 20,000 characters</span><span>{text.length.toLocaleString()} / 20,000</span></div>
        <div
          className={`upload-zone ${dragging ? "dragging" : ""} ${file ? "has-file" : ""}`}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => { event.preventDefault(); setDragging(false); selectFile(event.dataTransfer.files[0]); }}
        >
          <input id="rfq-file" type="file" accept=".pdf,.eml,.txt" onChange={(event) => selectFile(event.target.files?.[0])} />
          <div className="upload-icon"><Icon name="upload" /></div>
          <div className="upload-copy">
            {file ? <><strong>{file.name}</strong><span>{(file.size / 1024).toFixed(0)} KB · will be processed instead of typed text</span></> : <><strong>Drop a client document here</strong><span>PDF, email or text transcript · max 10 MB</span></>}
          </div>
          {file ? <button type="button" className="remove-file" onClick={() => setFile(null)} aria-label="Remove attachment"><Icon name="close" /></button> : <label className="browse-button" htmlFor="rfq-file">Browse</label>}
        </div>
        {error && <div className="inline-error" role="alert">{error}</div>}
        <div className="composer-footer">
          <div className="secure-caption"><Icon name="shield" /><span>Finance gate enforced · no order routing</span></div>
          <button type="submit" className="primary-button" disabled={submitting || (!file && !text.trim()) || !clientId}>
            {submitting ? <><span className="spinner" /> Submitting</> : <>Submit RFQ <Icon name="arrow" /></>}
          </button>
        </div>
      </form>
    </section>
  );
}

function RecentRfqs({ rows, loading, selectedId, onSelect }: { rows: RfqRecord[]; loading: boolean; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <section className="panel blotter-panel">
      <div className="panel-heading">
        <div><div className="eyebrow">Activity</div><h2>Recent RFQs</h2></div>
        <span className="panel-subtitle">Auto-refreshes every 4 sec</span>
      </div>
      <div className="rfq-list">
        {rows.map((rfq) => (
          <button key={rfq.id} className={`rfq-row ${selectedId === rfq.id ? "selected" : ""}`} onClick={() => onSelect(rfq.id)}>
            <span className="rfq-symbol">FI</span>
            <span className="rfq-row-main"><strong>{rfq.rawText?.slice(0, 58) || `RFQ ${rfq.id.slice(0, 8)}`}{(rfq.rawText?.length ?? 0) > 58 ? "…" : ""}</strong><small>{rfq.clientId} <span>·</span> {dateTime(rfq.createdAt)}</small></span>
            <StatusBadge status={rfq.status} />
            <span className="row-chevron"><Icon name="arrow" /></span>
          </button>
        ))}
        {!rows.length && <div className="empty-list">{loading ? "Loading RFQ activity..." : "No requests yet. Submit an RFQ to begin."}</div>}
      </div>
    </section>
  );
}

function RfqDetail({ record, history, onClose }: { record: RfqRecord; history: AuditEvent[]; onClose: () => void }) {
  const result = record.result ?? {};
  const quote = result.quote;
  const steps: TraceStep[] = result.steps ?? [];
  const statusCopy: Record<string, string> = {
    QUOTED: "Finance gate approved · indicative quote generated",
    NEEDS_REVIEW: "Manual review required · the request could not be fully validated",
    REJECTED: "Finance gate rejected · no quote generated",
    FAILED: "Agent workflow failed after retries",
    RECEIVED: "Request accepted · workflow is starting",
    PROCESSING: "Agent workflow is processing this request",
  };
  return (
    <section className="panel detail-panel">
      <div className="panel-heading detail-heading">
        <div><div className="eyebrow">Workflow record</div><h2>RFQ {record.id.slice(0, 8)}</h2></div>
        <button className="icon-button" onClick={onClose} aria-label="Close RFQ detail"><Icon name="close" /></button>
      </div>
      <div className={`detail-callout ${record.status.toLowerCase()}`}><StatusBadge status={record.status} /><span>{statusCopy[record.status] ?? "Workflow update received"}</span></div>
      {quote && (
        <div className="quote-summary">
          <div className="quote-header"><div><div className="eyebrow">Indicative pricing proposal</div><strong>{quote.issuer} {quote.maturity_year}</strong></div><span className="indicative-tag">INDICATIVE</span></div>
          <div className="quote-grid">
            <div><span>Notional</span><strong>{money(quote.notional)}</strong></div>
            <div><span>Client yield</span><strong>{quote.quote_yield_pct}%</strong></div>
            <div><span>Clean price</span><strong>{quote.clean_price}</strong></div>
            <div><span>Spread</span><strong>{quote.spread_bps} bps</strong></div>
          </div>
          <div className="quote-expiry"><Icon name="clock" /> Expires in {quote.expires_in_seconds}s · {quote.side} · Mid-yield {quote.market_mid_yield_pct}%</div>
        </div>
      )}
      <div className="detail-section">
        <div className="detail-section-title"><span>Decision trace</span><span>{steps.length} checks</span></div>
        <div className="trace-list">
          {steps.map((step, index) => (
            <details className="trace-step" key={`${step.agent}-${index}`} open={["REJECTED", "NEEDS_REVIEW"].includes(step.status)}>
              <summary><span className={`trace-marker ${step.status.toLowerCase()}`}><span>{String(index + 1).padStart(2, "0")}</span></span><span className="trace-agent">{step.agent}</span><StatusBadge status={step.status} /></summary>
              <div className="trace-content"><p>{step.summary}</p>{step.details && <pre>{JSON.stringify(step.details, null, 2)}</pre>}</div>
            </details>
          ))}
          {!steps.length && !terminalStatuses.has(record.status) && <div className="processing-note"><span className="spinner dark" /> Workflow running asynchronously. This panel refreshes automatically.</div>}
          {!steps.length && terminalStatuses.has(record.status) && <p className="muted-copy">No agent trace was returned.</p>}
        </div>
      </div>
      <div className="detail-section">
        <div className="detail-section-title"><span>Audit trail</span><span>Append-only</span></div>
        <div className="audit-list">
          {history.map((event, index) => (
            <div className="audit-event" key={`${event.occurredAt}-${index}`}>
              <span className="audit-dot" />
              <div><strong>{statusLabel(event.eventType)}</strong><small>{event.previousStatus ? `${statusLabel(event.previousStatus)} → ` : ""}{statusLabel(event.newStatus)}</small></div>
              <time>{dateTime(event.occurredAt)}</time>
            </div>
          ))}
          {!history.length && <p className="muted-copy">Audit history is loading or unavailable.</p>}
        </div>
      </div>
      <div className="detail-request"><span>Original request</span><p>{record.rawText}</p><small>{record.clientId} · Submitted {dateTime(record.createdAt)}</small></div>
    </section>
  );
}

function App() {
  const [clients, setClients] = useState<string[]>([]);
  const [clientId, setClientId] = useState("DEMO-001");
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [rfqs, setRfqs] = useState<RfqRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedRfq, setSelectedRfq] = useState<RfqRecord | null>(null);
  const [history, setHistory] = useState<AuditEvent[]>([]);
  const [coreUp, setCoreUp] = useState(false);
  const [workerUp, setWorkerUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = useCallback(async (isInitial = false) => {
    setRefreshing(true);
    try {
      const [clientList, recentRows, coreHealth, workerHealth] = await Promise.all([
        getClients(),
        getRecentRfqs(),
        getCoreHealth().then(() => true).catch(() => false),
        getWorkerHealth().then((health) => health.status === "ok" && health.consumer_running).catch(() => false),
      ]);
      setClients(clientList);
      setCoreUp(coreHealth);
      setWorkerUp(workerHealth);
      const selectedClient = clientList.includes(clientId) ? clientId : clientList[0] ?? "DEMO-001";
      if (selectedClient !== clientId) setClientId(selectedClient);
      setRfqs(recentRows);
      setSummary(await getSummary(selectedClient));
      setLoadError("");
      setLastUpdated(new Date());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load dashboard data.");
      if (isInitial) setCoreUp(false);
    } finally {
      setRefreshing(false);
    }
  }, [clientId]);

  useEffect(() => {
    void fetchDashboard(true);
    const timer = window.setInterval(() => void fetchDashboard(), 4000);
    return () => window.clearInterval(timer);
  }, [fetchDashboard]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedRfq(null);
      setHistory([]);
      return;
    }
    let cancelled = false;
    const loadRecord = async () => {
      try {
        const [record, audit] = await Promise.all([getRfq(selectedId), getHistory(selectedId)]);
        if (cancelled) return;
        setSelectedRfq(record);
        setHistory(audit);
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Could not load RFQ detail.");
      }
    };
    void loadRecord();
    const timer = window.setInterval(() => void loadRecord(), 1500);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [selectedId]);

  const doRefresh = () => void fetchDashboard();

  const handleSubmit = async (text: string, file: File | null) => {
    setSubmitting(true);
    setSubmitError("");
    try {
      const accepted = await submitRfq(clientId, text, file);
      setSelectedId(accepted.id);
      setSelectedRfq(accepted);
      setHistory([]);
      await fetchDashboard();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "RFQ submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Northstar home">
          <span className="brand-mark"><span>N</span></span>
          <span className="brand-copy"><strong>NORTHSTAR</strong><small>MARKETS</small></span>
        </a>
        <div className="desk-label">TRADING DESK</div>
        <nav className="side-nav" aria-label="Main navigation">
          <a className="nav-item active" href="#workbench"><Icon name="grid" /><span>RFQ Workbench</span><i /></a>
          <a className="nav-item" href="#activity"><Icon name="swap" /><span>RFQ Activity</span></a>
          <a className="nav-item" href="#inventory"><Icon name="chart" /><span>Inventory & Markets</span></a>
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-disclaimer"><Icon name="shield" /><div><strong>Decision support only</strong><span>Synthetic demo environment. No order routing.</span></div></div>
        <div className="sidebar-user"><div className="user-avatar">FI</div><div><strong>Fixed Income Desk</strong><span>Corporate Credit</span></div><span className="user-menu">···</span></div>
      </aside>

      <main className="workspace" id="workbench">
        <Header
          clientId={clientId}
          clients={clients}
          onClientChange={setClientId}
          coreUp={coreUp}
          workerUp={workerUp}
          lastUpdated={lastUpdated}
          refreshing={refreshing}
          onRefresh={doRefresh}
        />
        <div className="page-content">
          <section className="page-heading">
            <div><div className="eyebrow">FIXED INCOME <span className="heading-dot">/</span> CORPORATE CREDIT</div><h1>RFQ Workbench</h1><p>Turn client interest into controlled, indicative bond quotes.</p></div>
            <div className="environment-chip"><span /> SYNTHETIC DEMO ENVIRONMENT</div>
          </section>

          {loadError && <div className="load-error" role="alert"><span>{loadError}</span><button onClick={doRefresh}>Retry</button></div>}

          <section className="metric-grid" aria-label="Client credit summary">
            <MetricCard label="Credit limit" value={money(summary?.creditLimit)} note={`${clientId} · approved capacity`} accent="blue" icon="shield" />
            <MetricCard label="Current exposure" value={money(summary?.currentExposure)} note="Settled client exposure" accent="purple" icon="chart" />
            <MetricCard label="Active reservations" value={money(summary?.activeReservations)} note="Indicative quotes · 15 sec expiry" accent="amber" icon="clock" />
            <MetricCard label="Available credit" value={money(summary?.availableCredit)} note="After exposure & active reservations" accent="green" icon="swap" />
          </section>

          <div className="primary-grid">
            <div className="left-column">
              <RfqComposer clientId={clientId} onSubmit={handleSubmit} submitting={submitting} error={submitError} />
              <div id="activity"><RecentRfqs rows={rfqs} loading={refreshing} selectedId={selectedId} onSelect={setSelectedId} /></div>
            </div>
            <div className="right-column">
              <section className="panel desk-panel">
                <div className="panel-heading">
                  <div><div className="eyebrow">Client capacity</div><h2>Exposure overview</h2></div>
                  <span className="asof-label">{summary ? `As of ${dateTime(summary.asOf)}` : "Loading"}</span>
                </div>
                <div className="exposure-bar">
                  <div className="exposure-labels"><span>Credit utilization</span><strong>{summary ? `${Math.min(100, Math.round((Number(summary.currentExposure) / Math.max(1, Number(summary.creditLimit))) * 100))}%` : "—"}</strong></div>
                  <div className="progress-track"><span style={{ width: `${summary ? Math.min(100, Math.max(0, (Number(summary.currentExposure) / Math.max(1, Number(summary.creditLimit))) * 100)) : 0}%` }} /></div>
                  <div className="exposure-foot"><span>{money(summary?.currentExposure)} used</span><span>{money(summary?.creditLimit)} limit</span></div>
                </div>
                <div className="capacity-breakdown">
                  <div><span className="capacity-key"><i className="key-green" /> Available credit</span><strong>{money(summary?.availableCredit)}</strong></div>
                  <div><span className="capacity-key"><i className="key-amber" /> Active quote reservations</span><strong>{money(summary?.activeReservations)}</strong></div>
                </div>
                <div className="system-strip">
                  <div><span className={coreUp ? "health-dot" : "health-dot down"} />Core API <b>{coreUp ? "Operational" : "Unavailable"}</b></div>
                  <div><span className={workerUp ? "health-dot" : "health-dot down"} />Agent worker <b>{workerUp ? "Connected" : "Unavailable"}</b></div>
                </div>
              </section>
              <div id="inventory"><InventoryTable summary={summary} /></div>
            </div>
          </div>
          {selectedRfq && <RfqDetail record={selectedRfq} history={history} onClose={() => setSelectedId("")} />}
          <footer className="page-footer"><span><Icon name="shield" /> Indicative decision support · no execution or settlement</span><span>Dashboard syncs from PostgreSQL-backed API every 4 seconds</span></footer>
        </div>
      </main>
    </div>
  );
}

export default App;
