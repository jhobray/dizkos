# Dizkos — Plataforma de Análisis Biomecánico de Running

Dizkos es una app web de análisis biomecánico para corredores. Combina visión computacional, IA conversacional (GPT-4o) y datos de wearables (Garmin) para ofrecer diagnósticos personalizados.

## Stack

- **Next.js 14** (App Router, Server Components)
- **Supabase** (Auth, Postgres, Storage)
- **OpenAI GPT-4o** (chat de coaching)
- **MediaPipe** (análisis de pose en video)
- **Tailwind CSS** + **lucide-react**

## Variables de entorno

Crea un archivo `.env.local` con:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
```

> ⚠️ **OPENAI_API_KEY** es requerida para que el chat de coaching funcione.

## Setup local

1. Instalar dependencias
   ```bash
   npm install
   ```

2. Crear las variables de entorno (ver arriba)

3. Crear buckets en Supabase
   - `dizkos-videos`
   - `dizkos-overlays`

4. Ejecutar la migración SQL
   Abre Supabase → SQL Editor y pega el contenido de:
   `supabase/migrations/001_init.sql`

5. Correr en local
   ```bash
   npm run dev
   ```

## Estructura del proyecto

```
app/
  DizkosApp.tsx        # Componente principal de la app
  api/dizkos/
    analysis/route.ts  # GET historial / POST guardar análisis
    chat/route.ts      # POST chat con GPT-4o
    upload/route.ts    # POST subida de video
components/dizkos/
  DizkosCoachChat.tsx  # Componente de chat standalone
  VisionPanel.tsx      # Panel de análisis visual
lib/dizkos/
  biomechanics.ts      # Motor biomecánico v2.0
  types.ts             # Tipos centrales
  athletes.ts          # Tipos y datos de atletas
lib/supabase/
  admin.ts             # Cliente Supabase con service role
  server.ts            # Cliente Supabase para Server Components
```

## Deploy en Vercel

1. Login con GitHub
2. New Project → selecciona el repo
3. Añade las variables de entorno (las 4 del .env.example)
4. Deploy
