# Rumbo

Planner de equipo con tablero Kanban (Por hacer / En progreso / Hecho), construido con Claude Code
junto a Giz en el Laboratorio Code de Tidú.

## Qué es

Una herramienta web para que cada persona del equipo lleve sus propias tareas, y para que la líder
vea el avance de todas las personas en un solo tablero.

## Decisiones ya tomadas (no las cambies sin conversarlo con Giz)

- **Sin login real.** Se entra solo escribiendo el nombre, sin contraseña. Fue una decisión
  explícita, no un descuido.
- **Base de datos abierta (RLS "opción A").** Las tablas `people` y `tasks` en Supabase tienen
  políticas de acceso abiertas: cualquiera con la anon key puede leer y escribir. Es consistente
  con no tener login real: sin autenticación no hay forma de verificar identidad a nivel de base
  de datos. Está documentado y fue una decisión informada, no un error de configuración.
- **Presupuesto: gratis.** Se eligió Supabase y hosting con plan gratuito a propósito. Evita
  agregar servicios de pago sin conversarlo antes.
- **Sin pruebas automáticas ni ambiente de prueba separado (camino corto del arnés).** Los cambios
  se prueban a mano antes de darlos por buenos. El respaldo en GitHub es el mecanismo para
  volver atrás si algo se rompe.
- **"Asignado a" mueve la tarea de tablero.** Cuando se le asigna una tarea a otra persona,
  esa tarea aparece en el tablero de esa persona, no en el de quien la creó.

## Estructura del proyecto

- `index.html`: estructura y estilos de la app (una sola página).
- `app.js`: toda la lógica, conectada a Supabase.
- `supabase/schema.sql`: el esquema de las tablas y sus políticas de acceso. Si se cambia el
  esquema de la base de datos, actualizar este archivo también.

## Estilo

- Colores celestes, azules y grises claros. Estilo moderno pero simple.
- Sin frameworks de frontend: HTML, CSS y JavaScript simples, sin paso de compilación (build).
  Mantenerlo así salvo que haya una razón concreta para cambiarlo.
