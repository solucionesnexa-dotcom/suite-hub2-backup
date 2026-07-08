create or replace view v_conta_ingresos as
select
  i.id,
  i.workspace_id,
  'ingreso'::text as entry_type,
  i.concept as description,
  null::text as category_id,
  c.name as supplier_name,
  i.invoice_number,
  i.issue_date as invoice_date,
  round((i.amount / 1.21)::numeric, 2) as base_amount,
  21::numeric as vat_rate,
  round((i.amount - i.amount / 1.21)::numeric, 2) as vat_amount,
  i.amount as total_amount,
  i.payment_method,
  true as is_deductible,
  i.payment_notes as notes,
  'factura'::text as source
from invoices i
left join clients c on c.id = i.client_id
where i.status <> 'cancelada';

grant select on v_conta_ingresos to authenticated;