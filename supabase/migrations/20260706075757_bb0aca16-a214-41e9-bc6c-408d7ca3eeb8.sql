
CREATE OR REPLACE FUNCTION public.sync_invoice_to_expense()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric;
  v_base numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.expenses WHERE invoice_id = OLD.id;
    RETURN OLD;
  END IF;

  v_total := COALESCE(NEW.amount, 0);
  v_base := ROUND((v_total / 1.21)::numeric, 2);

  INSERT INTO public.expenses (
    workspace_id, entry_type, description, invoice_number, invoice_date,
    base_amount, vat_rate, payment_method, is_deductible, invoice_id, notes
  ) VALUES (
    NEW.workspace_id, 'ingreso',
    COALESCE(NULLIF(NEW.concept, ''), 'Factura ' || COALESCE(NEW.invoice_number, '')),
    NEW.invoice_number, NEW.issue_date,
    v_base, 21, COALESCE(NEW.payment_method, 'transferencia'),
    false, NEW.id, 'Generado automáticamente desde FactuNexa'
  )
  ON CONFLICT (invoice_id) DO UPDATE SET
    workspace_id = EXCLUDED.workspace_id,
    description = EXCLUDED.description,
    invoice_number = EXCLUDED.invoice_number,
    invoice_date = EXCLUDED.invoice_date,
    base_amount = EXCLUDED.base_amount,
    vat_rate = EXCLUDED.vat_rate,
    payment_method = EXCLUDED.payment_method,
    updated_at = now();

  RETURN NEW;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS expenses_invoice_id_key
  ON public.expenses (invoice_id) WHERE invoice_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_sync_invoice_to_expense ON public.invoices;
CREATE TRIGGER trg_sync_invoice_to_expense
AFTER INSERT OR UPDATE OR DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_to_expense();

INSERT INTO public.expenses (
  workspace_id, entry_type, description, invoice_number, invoice_date,
  base_amount, vat_rate, payment_method, is_deductible, invoice_id, notes
)
SELECT
  i.workspace_id, 'ingreso',
  COALESCE(NULLIF(i.concept, ''), 'Factura ' || COALESCE(i.invoice_number, '')),
  i.invoice_number, i.issue_date,
  ROUND((COALESCE(i.amount,0) / 1.21)::numeric, 2),
  21,
  COALESCE(i.payment_method, 'transferencia'),
  false, i.id, 'Generado automáticamente desde FactuNexa'
FROM public.invoices i
WHERE NOT EXISTS (SELECT 1 FROM public.expenses e WHERE e.invoice_id = i.id);
