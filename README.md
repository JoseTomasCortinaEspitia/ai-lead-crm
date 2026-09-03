# AI Lead CRM

Primer vertical slice del CRM: cliente web, API y persistencia PostgreSQL.

## Requisitos

- Node.js 22+
- Docker con Docker Compose

## Inicio local

```bash
cp .env.example .env
docker compose up -d
npm install
npm run dev
```

El cliente queda en `http://localhost:5173` y la API en `http://localhost:3001`.

## API

`POST /api/leads`

```json
{
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "company": "Analytical Engines",
  "phone": "+57 300 123 4567",
  "source": "website"
}
```

`name` y `email` son obligatorios. La API devuelve `201` con el lead creado, `400` para datos inválidos y `409` si el correo ya existe.

## Comprobaciones

```bash
npm test
npm run typecheck
npm run build
```

