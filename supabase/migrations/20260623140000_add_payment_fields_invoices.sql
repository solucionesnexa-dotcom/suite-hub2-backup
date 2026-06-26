ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'transferencia',
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS paid_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS payment_notes text NULL;

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
  ADD CONSTRAINT invoices_payment_status_check
    CHECK (payment_status IN ('pending','paid'));