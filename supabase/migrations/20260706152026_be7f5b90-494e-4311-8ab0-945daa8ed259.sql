
-- 1. search_path
ALTER FUNCTION public.ensure_current_user_setup() SET search_path = public;
ALTER FUNCTION public.sync_paid_invoice_to_contanexa() SET search_path = public;

-- 2. Lock down SECURITY DEFINER function execution
REVOKE EXECUTE ON FUNCTION public.current_user_can_write() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ensure_credit_account_for_workspace() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_current_user_setup() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_global_role(global_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_workspace_role(uuid, uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.current_user_can_write() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_current_user_setup() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_global_role(global_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_workspace_role(uuid, uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated;

-- 3. Drop broken/debug policies
DROP POLICY IF EXISTS debug_allow_all_clients_web ON public.clients;
DROP POLICY IF EXISTS allow_expenses_for_authenticated_users ON public.expenses;
DROP POLICY IF EXISTS contanexa_allow_expenses_for_authenticated_users ON public.expenses;
DROP POLICY IF EXISTS allow_all_invoices_for_authenticated_users ON public.invoices;
DROP POLICY IF EXISTS contanexa_allow_invoices_for_authenticated_users ON public.invoices;
DROP POLICY IF EXISTS simple_workspace_see_invoices ON public.invoices;
DROP POLICY IF EXISTS allow_all_remittance_invoices_for_authenticated_users ON public.remittance_invoices;
DROP POLICY IF EXISTS debug_allow_all_remittances ON public.remittances;
DROP POLICY IF EXISTS debug_allow_all_sepa_mandates ON public.sepa_mandates;
DROP POLICY IF EXISTS allow_all_sepa_mandates_for_authenticated_users ON public.sepa_mandates;
DROP POLICY IF EXISTS "Acceso autenticado" ON public.tax_periods;
DROP POLICY IF EXISTS contanexa_allow_tax_periods_for_authenticated_users ON public.tax_periods;

-- 4. Workspace-scoped SELECT for invoices (replaces the removed ones)
CREATE POLICY workspace_members_see_invoices ON public.invoices
  FOR SELECT TO authenticated
  USING ((workspace_id)::uuid IN (
    SELECT (wm.workspace_id)::uuid FROM public.workspace_members wm
    WHERE (wm.user_id)::uuid = auth.uid()
  ));

-- 5. Workspace-scoped SELECT for remittances / sepa_mandates / remittance_invoices
CREATE POLICY workspace_members_see_remittances ON public.remittances
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id::uuid));

CREATE POLICY workspace_members_see_sepa_mandates ON public.sepa_mandates
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id::uuid));

CREATE POLICY workspace_members_see_remittance_invoices ON public.remittance_invoices
  FOR SELECT TO authenticated
  USING (remittance_id IN (
    SELECT r.id FROM public.remittances r
    WHERE public.is_workspace_member(auth.uid(), r.workspace_id::uuid)
  ));

-- 6. conta_categories is shared reference data — allow signed-in users to read
CREATE POLICY conta_categories_read_authenticated ON public.conta_categories
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.conta_categories TO authenticated;
