-- Seed default expense categories for ContaNexa
INSERT INTO expense_categories (id, name, code, type, created_at)
VALUES
-- 1
  (gen_random_uuid(), 'Alquiler de oficinas y espacios de trabajo', 'ALQUILER', 'gasto', NOW()),
-- 2
  (gen_random_uuid(), 'Suministros (luz, agua, internet, teléfono)', 'SUMINISTROS', 'gasto', NOW()),
-- 3
  (gen_random_uuid(), 'Software, suscripciones y servicios web', 'SOFTWARE', 'gasto', NOW()),
-- 4
  (gen_random_uuid(), 'Servicios profesionales y asesoría', 'SERVICIOS_PROFESIONALES', 'gasto', NOW()),
-- 5
  (gen_random_uuid(), 'Gastos de personal (sueldos y salarios)', 'PERSONAL_SUELDOS', 'gasto', NOW()),
-- 6
  (gen_random_uuid(), 'Seguridad Social y otros costes de personal', 'PERSONAL_SS', 'gasto', NOW()),
-- 7
  (gen_random_uuid(), 'Formación y desarrollo del equipo', 'FORMACION', 'gasto', NOW()),
-- 8
  (gen_random_uuid(), 'Material de oficina y papelería', 'OFICINA', 'gasto', NOW()),
-- 9
  (gen_random_uuid(), 'Equipos y hardware informático', 'HARDWARE', 'gasto', NOW()),
-- 10
  (gen_random_uuid(), 'Viajes, dietas y desplazamientos', 'VIAJES', 'gasto', NOW()),
-- 11
  (gen_random_uuid(), 'Marketing, publicidad y eventos', 'MARKETING', 'gasto', NOW()),
-- 12
  (gen_random_uuid(), 'Gastos de representación y clientes', 'REPRESENTACION', 'gasto', NOW()),
-- 13
  (gen_random_uuid(), 'Seguros', 'SEGUROS', 'gasto', NOW()),
-- 14
  (gen_random_uuid(), 'Gastos bancarios y comisiones', 'GASTOS_BANCARIOS', 'gasto', NOW()),
-- 15
  (gen_random_uuid(), 'Intereses y otros gastos financieros', 'GASTOS_FINANCIEROS', 'gasto', NOW()),
-- 16
  (gen_random_uuid(), 'Impuestos y tasas', 'IMPUESTOS', 'gasto', NOW()),
-- 17
  (gen_random_uuid(), 'Gastos de limpieza, mantenimiento y consumibles', 'MANTENIMIENTO', 'gasto', NOW()),
-- 18
  (gen_random_uuid(), 'Gastos legales y registros', 'GASTOS_LEGALES', 'gasto', NOW()),
-- 19
  (gen_random_uuid(), 'Gastos extraordinarios / imprevistos', 'EXTRAORDINOS', 'gasto', NOW()),
-- 20
  (gen_random_uuid(), 'Otros gastos', 'OTROS_GASTOS', 'gasto', NOW())
ON CONFLICT (code) DO NOTHING;
