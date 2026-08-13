ALTER TABLE transactions ADD COLUMN business_class TEXT NOT NULL DEFAULT '';

ALTER TABLE ledger_records ADD COLUMN denomination_asset_class TEXT NOT NULL DEFAULT 'currency';
ALTER TABLE ledger_records ADD COLUMN denomination_unit TEXT NOT NULL DEFAULT 'unit';
ALTER TABLE ledger_records ADD COLUMN denomination_purity REAL NOT NULL DEFAULT 1;
ALTER TABLE ledger_records ADD COLUMN denomination_karat INTEGER;
ALTER TABLE ledger_records ADD COLUMN denomination_millesimal INTEGER;
ALTER TABLE ledger_records ADD COLUMN denomination_label TEXT NOT NULL DEFAULT '';

ALTER TABLE recurring_expense_rules ADD COLUMN recurrence_kind TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE recurring_expense_rules ADD COLUMN recurrence_interval INTEGER NOT NULL DEFAULT 1;
ALTER TABLE recurring_expense_rules ADD COLUMN recurrence_day_of_week INTEGER;
ALTER TABLE recurring_expense_rules ADD COLUMN recurrence_day_of_month INTEGER;
ALTER TABLE recurring_expense_rules ADD COLUMN business_day_rule TEXT NOT NULL DEFAULT 'none';
ALTER TABLE recurring_expense_rules ADD COLUMN auto_create INTEGER NOT NULL DEFAULT 1;

CREATE TABLE financial_goals (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  metric TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'up',
  unit TEXT NOT NULL DEFAULT 'TRY',
  target_value REAL NOT NULL,
  baseline_value REAL NOT NULL DEFAULT 0,
  current_override REAL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  scenario_mode TEXT NOT NULL DEFAULT 'base',
  active INTEGER NOT NULL DEFAULT 1,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX financial_goals_active_idx ON financial_goals(active, end_date);
CREATE INDEX financial_goals_metric_idx ON financial_goals(metric);

CREATE TABLE goal_milestones (
  id TEXT PRIMARY KEY NOT NULL,
  goal_id TEXT NOT NULL REFERENCES financial_goals(id),
  label TEXT NOT NULL,
  target_value REAL NOT NULL,
  target_date TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX goal_milestones_goal_idx ON goal_milestones(goal_id, target_date);

CREATE TABLE valuation_rates (
  id TEXT PRIMARY KEY NOT NULL,
  asset_code TEXT NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  effective_at TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX valuation_rates_asset_idx ON valuation_rates(asset_code, effective_at);

CREATE TABLE installment_schedules (
  id TEXT PRIMARY KEY NOT NULL,
  ledger_record_id TEXT NOT NULL REFERENCES ledger_records(id),
  installment_no INTEGER NOT NULL,
  due_date TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  denomination_quantity REAL,
  status TEXT NOT NULL DEFAULT 'planned',
  payment_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX installment_schedules_record_idx ON installment_schedules(ledger_record_id, installment_no);
CREATE INDEX installment_schedules_due_idx ON installment_schedules(due_date, status);
