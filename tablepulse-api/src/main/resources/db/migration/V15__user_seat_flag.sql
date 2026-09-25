-- Manager seat flag: marks logins born as shared restaurant seats, independent
-- of email domain (owner-typed real emails replace generated .local ones).
-- Backfill: every legacy generated seat address becomes a seat.
ALTER TABLE users ADD COLUMN is_seat BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE users SET is_seat = TRUE WHERE email LIKE '%@outlets.tablepulse.local';
