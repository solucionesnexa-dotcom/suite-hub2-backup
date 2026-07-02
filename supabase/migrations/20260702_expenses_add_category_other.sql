-- Añadir campo category_other y asegurar category_id en expenses
ALTER TABLE IF EXISTS public.expenses
  ADD COLUMN IF NOT EXISTS category_other TEXT;

-- Asegurar que existe category_id con FK (la columna podría existir ya)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE public.expenses ADD COLUMN category_id UUID REFERENCES public.expense_categories(id);
  ELSE
    -- ensure FK exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'expenses' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'category_id'
    ) THEN
      ALTER TABLE public.expenses ADD CONSTRAINT expenses_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.expense_categories(id);
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON public.expenses (category_id);
