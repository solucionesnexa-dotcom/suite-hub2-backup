ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'transferencia';

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending';

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS paid_at timestamptz NULL;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS payment_notes text NULL;

ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_payment_method_check;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_payment_method_check
  CHECK (
    payment_method IN (
      'transferencia',
      'efectivo',
      'bizum',
      'tarjeta',
      'paypal',
      'cheque',
      'domiciliacion',
      'otro'
    )
  );

ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_payment_status_check;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_payment_status_check
  CHECK (
    payment_status IN ('pending', 'paid')
  );