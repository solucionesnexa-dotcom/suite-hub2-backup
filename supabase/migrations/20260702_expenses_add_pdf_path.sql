-- Añade campo pdf_path a expenses para enlazar PDFs subidos a bucket `facturas`
ALTER TABLE IF EXISTS public.expenses
  ADD COLUMN IF NOT EXISTS pdf_path TEXT;

-- Asegurar RLS si aplicable (las políticas de expenses ya fueron ajustadas en migraciones previas)
