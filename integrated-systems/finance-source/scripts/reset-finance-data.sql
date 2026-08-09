-- ELÇİ FİNANS: CANLI VERİYİ SIFIRLAMA KOMUTU
-- YALNIZCA D1 finans veritabanında, doğrulanmış yedek alındıktan sonra çalıştırılır.
-- Ana site, blog, randevu ve Netlify verilerine erişmez/değiştirmez.
PRAGMA foreign_keys = ON;

DELETE FROM finance_audit_events;
DELETE FROM transaction_audit_events;
DELETE FROM monthly_close_events;
DELETE FROM monthly_closings;
DELETE FROM recurring_expense_occurrences;
DELETE FROM ledger_payments;
DELETE FROM ledger_line_items;
DELETE FROM stock_movements;
DELETE FROM transactions;
DELETE FROM recurring_expense_rules;
DELETE FROM ledger_records;
DELETE FROM inventory_items;
DELETE FROM settings;

-- Doğrulama: aşağıdaki sorguların tamamı 0 dönmelidir.
SELECT 'transactions' AS table_name, COUNT(*) AS remaining FROM transactions
UNION ALL SELECT 'ledger_records', COUNT(*) FROM ledger_records
UNION ALL SELECT 'recurring_rules', COUNT(*) FROM recurring_expense_rules
UNION ALL SELECT 'inventory_items', COUNT(*) FROM inventory_items
UNION ALL SELECT 'stock_movements', COUNT(*) FROM stock_movements;
