-- Esquema de base de datos para Rumbo
-- Ejecutar completo en el SQL Editor de Supabase

-- Tabla de personas registradas
create table people (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  is_leader boolean not null default false,
  created_at timestamptz not null default now()
);

-- Tabla de tareas
create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  assigned_to text not null references people(name) on update cascade,
  created_by text not null,
  start_date date,
  end_date date,
  priority text not null default 'media' check (priority in ('alta','media','baja')),
  status text not null default 'todo' check (status in ('todo','in_progress','done')),
  created_at timestamptz not null default now()
);

-- Activamos RLS (Supabase lo exige para exponer las tablas a la app)
alter table people enable row level security;
alter table tasks enable row level security;

-- Políticas abiertas: cualquiera con la app puede leer y escribir,
-- tal como se decidió (opción A: sin login real, equipo de confianza).
create policy "Cualquiera puede leer personas" on people for select using (true);
create policy "Cualquiera puede crear personas" on people for insert with check (true);
create policy "Cualquiera puede actualizar personas" on people for update using (true);

create policy "Cualquiera puede leer tareas" on tasks for select using (true);
create policy "Cualquiera puede crear tareas" on tasks for insert with check (true);
create policy "Cualquiera puede actualizar tareas" on tasks for update using (true);
create policy "Cualquiera puede eliminar tareas" on tasks for delete using (true);
