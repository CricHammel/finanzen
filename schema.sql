CREATE TABLE accounts (
  id INTEGER PRIMARY KEY,
  iban TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  bank TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type = 'Girokonto'),
  currency TEXT NOT NULL
) STRICT;

CREATE TABLE imports (
  id INTEGER PRIMARY KEY,
  accountId INTEGER REFERENCES accounts(id) NOT NULL,
  fileName TEXT NOT NULL,
  importedAt TEXT NOT NULL,
  periodFrom TEXT NOT NULL,
  periodTo TEXT NOT NULL,
  linesTotal INTEGER NOT NULL,
  linesImported INTEGER NOT NULL
) STRICT;

CREATE TABLE categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  parentId INTEGER REFERENCES categories(id)
) STRICT;

CREATE TABLE rules (
  id INTEGER PRIMARY KEY,
  matchField TEXT NOT NULL,
  matchValue TEXT NOT NULL,
  categoryId INTEGER REFERENCES categories(id) NOT NULL,
  sortOrder INTEGER NOT NULL,
  isActive INTEGER NOT NULL CHECK (isActive IN (0, 1))
) STRICT;

CREATE TABLE transactions (
  id INTEGER PRIMARY KEY,
  accountId INTEGER REFERENCES accounts(id) NOT NULL,
  importId INTEGER REFERENCES imports(id) NOT NULL,
  bookedOn TEXT NOT NULL,
  valuedOn TEXT NOT NULL,
  counterparty TEXT NOT NULL,
  bookingText TEXT NOT NULL,
  purpose TEXT NOT NULL,
  amountCents INTEGER NOT NULL,
  balanceCents INTEGER NOT NULL,
  dedupHash TEXT NOT NULL,
  rawLine TEXT NOT NULL,
  categoryId INTEGER REFERENCES categories(id),
  categorySource TEXT CHECK (categorySource IN ('rule', 'manual')),
  appliedRuleId INTEGER REFERENCES rules(id),
  isInternal INTEGER NOT NULL CHECK (isInternal IN (0, 1)),
  CHECK ((categoryId IS NULL) = (categorySource IS NULL)),
  CHECK (appliedRuleId IS NULL OR categorySource IS 'rule')
) STRICT;

CREATE UNIQUE INDEX idx_transactions_account_dedupHash ON transactions(accountId, dedupHash);

CREATE TABLE transfers (
  id INTEGER PRIMARY KEY,
  outTransactionId INTEGER REFERENCES transactions(id) NOT NULL UNIQUE,
  inTransactionId INTEGER REFERENCES transactions(id) NOT NULL UNIQUE
) STRICT;

