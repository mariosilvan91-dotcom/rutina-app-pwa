# Rutina Salud (PWA)

## Requisitos
- Node.js 18+ instalado en Windows
- Proyecto Supabase (URL + ANON KEY)

## Configuración
1) Crea `.env.local` en la raíz:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

2) Instala dependencias:
```
npm install
```

3) Arranca:
```
npm run dev
```

Abre http://localhost:3000

## Deploy en Vercel
- Subir repo a GitHub
- Importar en Vercel
- Añadir variables de entorno en Vercel:
  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_SUPABASE_ANON_KEY
