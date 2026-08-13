ALTER TABLE ledger_records ADD COLUMN denomination_code TEXT NOT NULL DEFAULT 'TRY';
ALTER TABLE ledger_records ADD COLUMN denomination_quantity REAL NOT NULL DEFAULT 0;
ALTER TABLE ledger_records ADD COLUMN denomination_open_unit_price_cents INTEGER NOT NULL DEFAULT 100;
ALTER TABLE ledger_records ADD COLUMN denomination_rate_source TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE ledger_payments ADD COLUMN denomination_code TEXT;
ALTER TABLE ledger_payments ADD COLUMN denomination_quantity REAL;
ALTER TABLE ledger_payments ADD COLUMN denomination_unit_price_cents INTEGER;
