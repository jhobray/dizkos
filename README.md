# Dizkos

Proyecto base listo para subir a GitHub y desplegar en Vercel.

## 1. Instalar dependencias
```bash
npm install
```

## 2. Crear variables de entorno
Crea un archivo `.env.local` con:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## 3. Crear buckets en Supabase
- dizkos-videos
- dizkos-overlays

## 4. Ejecutar la migración SQL
Abre Supabase > SQL Editor y pega el archivo:
`supabase/migrations/001_init.sql`

## 5. Correr local
```bash
npm run dev
```

## 6. Subir a GitHub
Puedes usar GitHub Desktop.

## 7. Subir a Vercel
- Login con GitHub
- New Project
- Selecciona repo
- Añade las variables de entorno
- Deploy