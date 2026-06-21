ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS pdf_path TEXT;
