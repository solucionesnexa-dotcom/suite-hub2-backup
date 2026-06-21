insert into storage.buckets (id, name, public)
values ('facturas', 'facturas', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('facturas', 'facturas', false)
on conflict (id) do nothing;

create policy "facturas_insert_authenticated"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'facturas');

create policy "facturas_select_authenticated"
on storage.objects
for select
to authenticated
using (bucket_id = 'facturas');