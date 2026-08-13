"use client";

import { FormEvent, useMemo, useState } from "react";

import {
  evaluateGoal,
  forecastFinance,
  goalActualValue,
  healthyGrowthScore,
} from "@/lib/growth-planner.mjs";

type TransactionLike = {
  id: string;
  date: string;
  kind: string;
  amount: number;
  status?: string;
  postingMode?: string;
};

type RecordLike = {
  type: "receivable" | "payable";
  dueDate: string;
  originalAmount: number;
  denominationCode?: string;
  denominationQuantity?: number;
  denominationOpenUnitPrice?: number;
  payments: Array<{ amount: number; denominationQuantity?: number; denominationUnitPrice?: number; status?: "cancelled" }>;
};

export type FinancialGoal = {
  id: string;
  name: string;
  metric: string;
  direction: "up" | "down";
  unit: string;
  targetValue: number;
  baselineValue: number;
  currentOverride?: number;
  startDate: string;
  endDate: string;
  scenarioMode: "base" | "optimistic" | "pessimistic";
  active: boolean;
  note: string;
};

export type GoalMilestone = {
  id: string;
  goalId: string;
  label: string;
  targetValue: number;
  targetDate: string;
  completedAt?: string;
};

const TRY = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

const PERCENT = new Intl.NumberFormat("tr-TR", {
  style: "percent",
  maximumFractionDigits: 1,
});

const metricLabels: Record<string, string> = {
  revenue: "Ciro / gelir",
  net_profit: "Net kâr",
  expense: "Gider sınırı",
  cash_reserve: "Nakit rezervi",
  debt_reduction: "Borç azaltma",
  receivable_reduction: "Alacak tahsilatı",
  investment_budget: "Yatırım bütçesi",
  growth_capacity: "Büyüme kapasitesi",
};

const statusLabels: Record<string, string> = {
  achieved: "Tamamlandı",
  ahead: "Hedefin önünde",
  on_track: "Hedef temposunda",
  behind: "Geride",
  missed: "Süre aşıldı",
};

function money(value: number) {
  return TRY.format(Number(value || 0));
}

function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("tr-TR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function rateLabel(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value) ? "—" : PERCENT.format(value);
}

function buildPolyline(values: number[], width: number, height: number, min: number, max: number) {
  if (!values.length) return "";
  const span = Math.max(1, max - min);
  return values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = height - ((value - min) / span) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function TrendChart({ rows, forecastStart }: { rows: Array<{ month: string; income: number; expense: number }>; forecastStart: number }) {
  const width = 760;
  const height = 210;
  const all = rows.flatMap((row) => [row.income, row.expense]);
  const min = 0;
  const max = Math.max(1, ...all) * 1.08;
  const income = buildPolyline(rows.map((row) => row.income), width, height, min, max);
  const expense = buildPolyline(rows.map((row) => row.expense), width, height, min, max);
  const forecastX = rows.length <= 1 ? 0 : ((forecastStart - 0.5) / (rows.length - 1)) * width;
  return (
    <div className="v10-chart-wrap" aria-label="Gelir ve gider trend grafiği">
      <svg className="v10-trend-chart" viewBox={`0 0 ${width} ${height + 34}`} role="img">
        {[0.25, 0.5, 0.75].map((ratio) => <line className="v10-chart-grid" key={ratio} x1="0" x2={width} y1={height * ratio} y2={height * ratio} />)}
        {forecastStart > 0 ? <line className="v10-chart-forecast-line" x1={forecastX} x2={forecastX} y1="0" y2={height} /> : null}
        <polyline className="v10-chart-income" fill="none" points={income} />
        <polyline className="v10-chart-expense" fill="none" points={expense} />
        {rows.map((row, index) => {
          const x = rows.length === 1 ? width / 2 : (index / (rows.length - 1)) * width;
          return <text className="v10-chart-label" key={row.month} textAnchor="middle" x={x} y={height + 25}>{monthLabel(row.month)}</text>;
        })}
      </svg>
      <div className="v10-chart-legend"><span className="income">Gelir</span><span className="expense">Gider</span><small>Kesikli çizgiden sonrası tahmindir.</small></div>
    </div>
  );
}

function goalValueLabel(goal: FinancialGoal, value: number) {
  if (goal.unit === "percent") return `${Number(value || 0).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}%`;
  if (goal.unit === "count") return Number(value || 0).toLocaleString("tr-TR", { maximumFractionDigits: 1 });
  return money(value);
}

function defaultGoal(today: string): FinancialGoal {
  const year = Number(today.slice(0, 4));
  return {
    id: `goal-${Date.now()}`,
    name: `${year + 1} ciro hedefi`,
    metric: "revenue",
    direction: "up",
    unit: "TRY",
    targetValue: 0,
    baselineValue: 0,
    startDate: `${year + 1}-01-01`,
    endDate: `${year + 1}-12-31`,
    scenarioMode: "base",
    active: true,
    note: "",
  };
}

export function GoalsView({
  today,
  transactions,
  records,
  goals,
  milestones,
  marketRates,
  cashReserveValue,
  onSaveGoal,
}: {
  today: string;
  transactions: TransactionLike[];
  records: RecordLike[];
  goals: FinancialGoal[];
  milestones: GoalMilestone[];
  marketRates: Record<string, number | null>;
  cashReserveValue?: number | null;
  onSaveGoal: (goal: FinancialGoal) => Promise<boolean>;
}) {
  const [scenario, setScenario] = useState<"base" | "optimistic" | "pessimistic">("base");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FinancialGoal>(() => defaultGoal(today));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const forecast = useMemo(() => forecastFinance(transactions, today, { historyMonths: 6, monthsAhead: 6 }), [transactions, today]);
  const health = useMemo(() => healthyGrowthScore({ transactions, records, today, marketRates }), [transactions, records, today, marketRates]);
  const scenarioRows = forecast.scenarios[scenario];
  const chartRows = [...forecast.history, ...scenarioRows];
  const activeGoals = goals.filter((goal) => goal.active);

  function openNewGoal() {
    setForm(defaultGoal(today));
    setError("");
    setDialogOpen(true);
  }

  function openEditGoal(goal: FinancialGoal) {
    setForm({ ...goal });
    setError("");
    setDialogOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || !form.startDate || !form.endDate || !Number.isFinite(Number(form.targetValue)) || Number(form.targetValue) < 0) {
      setError("Hedef adı, tarih aralığı ve hedef değeri zorunludur.");
      return;
    }
    if (form.startDate > form.endDate) {
      setError("Başlangıç tarihi bitiş tarihinden sonra olamaz.");
      return;
    }
    setSaving(true);
    const ok = await onSaveGoal({ ...form, targetValue: Number(form.targetValue), baselineValue: Number(form.baselineValue || 0), currentOverride: form.currentOverride === undefined ? undefined : Number(form.currentOverride) });
    setSaving(false);
    if (!ok) {
      setError("Hedef kaydedilemedi.");
      return;
    }
    setDialogOpen(false);
  }

  return (
    <section className="v10-goals-stack">
      <section className="panel v10-growth-head">
        <div>
          <span className="eyebrow">V10 · Hedef → plan → gerçekleşme → tahmin</span>
          <h2>Büyüme ve gelecek görünümü</h2>
          <p>Gerçekleşen finans verisi ile hedefi karşılaştırır; gelecek çizgisi kesin sonuç değil, görünür varsayımlara dayalı senaryodur.</p>
        </div>
        <button className="primary-button" onClick={openNewGoal} type="button"><span>+</span> Hedef ekle</button>
      </section>

      <section className="v10-growth-kpis">
        <article><span>Sağlıklı büyüme</span><strong>{health.score}/100</strong><small>{health.flags[0]}</small></article>
        <article><span>Gelir eğilimi</span><strong>{rateLabel(health.revenueGrowth)}</strong><small>Son 3 ay / önceki 3 ay</small></article>
        <article><span>Gider eğilimi</span><strong>{rateLabel(health.expenseGrowth)}</strong><small>Gelirden hızlıysa uyarı</small></article>
        <article><span>Faaliyet marjı</span><strong>{rateLabel(health.margin)}</strong><small>Gelir − gider / gelir</small></article>
      </section>

      <section className="panel v10-forecast-panel">
        <div className="panel-head">
          <div><span className="eyebrow">6 ay gerçekleşen + 6 ay tahmin</span><h2>Gelir ve gider yönü</h2></div>
          <div className="v10-scenario-tabs">
            <button className={scenario === "pessimistic" ? "active" : ""} onClick={() => setScenario("pessimistic")} type="button">Kötümser</button>
            <button className={scenario === "base" ? "active" : ""} onClick={() => setScenario("base")} type="button">Baz</button>
            <button className={scenario === "optimistic" ? "active" : ""} onClick={() => setScenario("optimistic")} type="button">İyimser</button>
          </div>
        </div>
        <TrendChart forecastStart={forecast.history.length} rows={chartRows} />
        <div className="v10-assumptions">
          <span>Gelir aylık varsayım: <strong>{rateLabel(forecast.assumptions.income[scenario])}</strong></span>
          <span>Gider aylık varsayım: <strong>{rateLabel(forecast.assumptions.expense[scenario])}</strong></span>
          <span>Güven: <strong>{forecast.confidence === "medium" ? "Orta" : "Düşük / daha çok veri gerekli"}</strong></span>
        </div>
        <div className="v10-forecast-table-wrap">
          <table className="v10-forecast-table">
            <thead><tr><th>Ay</th><th>Gelir</th><th>Gider</th><th>Net</th><th>Tür</th></tr></thead>
            <tbody>
              {chartRows.map((row, index) => <tr key={`${row.month}-${index}`}><td>{monthLabel(row.month)}</td><td>{money(row.income)}</td><td>{money(row.expense)}</td><td className={row.net >= 0 ? "positive" : "negative"}>{money(row.net)}</td><td>{index < forecast.history.length ? "Gerçekleşen" : `${scenario === "base" ? "Baz" : scenario === "optimistic" ? "İyimser" : "Kötümser"} tahmin`}</td></tr>)}
            </tbody>
          </table>
        </div>
      </section>

      <section className="v10-goal-grid">
        {activeGoals.map((goal) => {
          const goalForActual = goal.metric === "cash_reserve" && cashReserveValue !== null && cashReserveValue !== undefined
            ? { ...goal, currentOverride: cashReserveValue }
            : goal;
          const actual = goalActualValue(goalForActual, transactions, records as any, today, marketRates);
          const result = evaluateGoal(goal, actual, today);
          const goalMilestones = milestones.filter((item) => item.goalId === goal.id);
          return (
            <article className={`panel v10-goal-card ${result.status}`} key={goal.id}>
              <div className="v10-goal-card-head"><div><span>{metricLabels[goal.metric] || goal.metric}</span><h3>{goal.name}</h3></div><button onClick={() => openEditGoal(goal)} type="button">Düzenle</button></div>
              <div className="v10-goal-value"><strong>{goalValueLabel(goal, result.actual)}</strong><span>/ {goalValueLabel(goal, result.target)}</span></div>
              <div className="v10-progress"><i style={{ width: `${result.progressPercent}%` }} /><b style={{ left: `${Math.min(100, result.timeProgressPercent)}%` }} title="Bugün olması gereken tempo" /></div>
              <div className="v10-goal-meta"><span>%{result.progressPercent.toLocaleString("tr-TR")} tamamlandı</span><strong>{statusLabels[result.status]}</strong><span>Zaman %{result.timeProgressPercent.toLocaleString("tr-TR")}</span></div>
              <dl className="v10-goal-details">
                <div><dt>Kalan</dt><dd>{goalValueLabel(goal, result.remaining)}</dd></div>
                <div><dt>Kalan süre</dt><dd>{result.remainingMonths} ay</dd></div>
                <div><dt>Gerekli aylık büyüme</dt><dd>{rateLabel(result.requiredMonthlyGrowth)}</dd></div>
              </dl>
              {goalMilestones.length ? <div className="v10-milestones">{goalMilestones.map((item) => <span key={item.id}>{item.completedAt ? "✓" : "○"} {item.label} · {item.targetDate}</span>)}</div> : null}
            </article>
          );
        })}
        {!activeGoals.length ? <article className="panel v10-goal-empty"><strong>Henüz büyüme hedefi yok.</strong><p>Ciro, net kâr, nakit rezervi veya borç azaltma hedefini tanımlayın; sistem gerçekleşen veriyi otomatik takip etsin.</p><button onClick={openNewGoal} type="button">İlk hedefi ekle</button></article> : null}
      </section>

      {dialogOpen ? (
        <div className="modal-backdrop" onMouseDown={() => setDialogOpen(false)} role="presentation">
          <form className="modal-card v10-goal-dialog" onMouseDown={(event) => event.stopPropagation()} onSubmit={submit}>
            <div className="drawer-head"><div><span className="eyebrow">Gelecek planı</span><h2>Finansal hedef</h2></div><button onClick={() => setDialogOpen(false)} type="button">×</button></div>
            <div className="form-grid">
              <label className="span-2">Hedef adı *<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
              <label>Ölçüt<select value={form.metric} onChange={(event) => {
                const metric = event.target.value;
                const down = metric === "expense";
                setForm({ ...form, metric, direction: down ? "down" : "up" });
              }}>{Object.entries(metricLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>Hedef değeri *<input min="0" step="0.01" type="number" value={form.targetValue || ""} onChange={(event) => setForm({ ...form, targetValue: Number(event.target.value) })} /></label>
              <label>Başlangıç değeri<input min="0" step="0.01" type="number" value={form.baselineValue || ""} onChange={(event) => setForm({ ...form, baselineValue: Number(event.target.value) })} /></label>
              <label>Birim<select value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}><option value="TRY">TL</option><option value="percent">Yüzde</option><option value="count">Adet</option></select></label>
              <label>Başlangıç<input required type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></label>
              <label>Bitiş<input required type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></label>
              <label>Tahmin senaryosu<select value={form.scenarioMode} onChange={(event) => setForm({ ...form, scenarioMode: event.target.value as FinancialGoal["scenarioMode"] })}><option value="base">Baz</option><option value="pessimistic">Kötümser</option><option value="optimistic">İyimser</option></select></label>
              <label className="span-2">Not<textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Örn. İkinci şube öncesi minimum nakit rezervi" /></label>
            </div>
            <p className="modal-note">Tahmin ile gerçekleşen veri ayrı tutulur. Hedef temposu zaman geçtikçe otomatik değişir; tarihleri elle ilerletmeniz gerekmez.</p>
            {error ? <p className="form-error">{error}</p> : null}
            <div className="modal-actions"><button className="secondary-button" onClick={() => setDialogOpen(false)} type="button">Vazgeç</button><button className="primary-button" disabled={saving} type="submit">{saving ? "Kaydediliyor…" : "Hedefi kaydet"}</button></div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
