# AI Lead CRM

**AI-ready Lead CRM with a provider-based architecture for conversation analysis. The public demo uses a mock AI provider to avoid external API costs; OpenAI can be enabled through environment configuration.**

CRM de portafolio para gestionar oportunidades comerciales con persistencia en PostgreSQL y análisis de conversaciones desde una API. El modo predeterminado funciona sin credenciales ni llamadas a servicios de IA externos.

## Vista del producto

![Dashboard de AI Lead CRM](docs/images/ia-lead-crm1.jpg)

Captura de referencia del dashboard. Los datos visibles dependen de los contactos guardados localmente.

## Funcionalidades

- Crear, listar, consultar y eliminar leads; actualizar su estado comercial desde el detalle.
- Buscar por nombre, empresa o correo y combinar filtros por estado y fecha de creación.
- Seleccionar desde/hasta con días inclusivos en la zona horaria del navegador. Un extremo vacío deja ese límite abierto; limpiar fechas conserva los demás filtros. El filtrado se realiza en React sobre la lista cargada.
- Dashboard con totales, distribución por estado, leads recientes y conversión (cerrados / total).
- Analizar conversaciones desde el detalle o el simulador mediante `POST /api/ai/analyze`, con estados de carga, error y reintento.
- Mostrar score, intención, resumen, temas, siguiente acción y proveedor utilizado.

Los leads y sus estados se guardan en PostgreSQL. Las conversaciones del detalle son ejemplos compartidos, sin vínculo con el contacto; el simulador responde con textos programados. Los análisis se calculan bajo demanda y no se persisten. Conversaciones, Analítica y Ajustes en la navegación son secciones pendientes. No se incluye integración real de WhatsApp, autenticación, multiempresa, pagos ni WebSocket.

## Arquitectura y tecnologías

```text
React 19 + TypeScript + Vite
  ├─ /api/leads ─────── Express 5 + Zod ── LeadStore ── PostgreSQL 17
  └─ /api/ai/analyze ── Express 5 + Zod ── AiProvider
                                           ├─ MockAiProvider (predeterminado)
                                           └─ OpenAiProvider (opcional)
```

- `client/src/App.tsx`: interfaz, filtros y consumo de la API.
- `server/src/app.ts`: rutas HTTP y validación de entradas.
- `server/src/lead-store.ts`: consultas SQL parametrizadas.
- `server/src/ai.ts`: contrato de proveedores, mock por reglas y adaptador OpenAI.
- `server/db/migrations/`: esquema y migraciones SQL.
- `server/test/`: pruebas HTTP con Node Test Runner y Supertest.

Vite redirige `/api` al backend durante el desarrollo. Para desplegar, sirve `client/dist` y configura el proxy `/api` al proceso de Express. El backend compilado queda en `server/dist`.

## Ejecutar localmente

Requisitos: Node.js 22+, npm y Docker Compose.

```powershell
Copy-Item .env.example .env
docker compose up -d
npm install
npm run dev
```

En macOS/Linux, sustituye la primera línea por `cp .env.example .env`.

- Interfaz: http://localhost:5173
- API: http://localhost:3001
- Health check: http://localhost:3001/health
- PostgreSQL: `localhost:5433` (Docker publica `5433:5432`).

La configuración compartida se carga desde `.env` en la raíz; las variables ya exportadas en el entorno tienen prioridad. Un archivo antiguo `server/.env` solo aporta valores que falten. Usa «Nuevo lead» para crear contactos; una base nueva empieza vacía.

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | Conexión PostgreSQL; el ejemplo usa el puerto 5433 |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Inicialización del contenedor local |
| `PORT` | Puerto de Express, predeterminado 3001 |
| `AI_PROVIDER` | `mock` (predeterminado) u `openai` |
| `OPENAI_API_KEY` | Credencial del backend, solo para OpenAI |
| `OPENAI_MODEL` | Modelo compatible con Structured Outputs, solo para OpenAI |

`Ctrl+C` detiene el desarrollo. `docker compose down` detiene PostgreSQL y conserva el volumen; añadir `-v` elimina también todos los datos.

Las bases nuevas ejecutan las migraciones al inicializar el volumen. En una base anterior que todavía no admite `closed`, ejecuta:

```powershell
Get-Content server/db/migrations/002_add_closed_status.sql | docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U postgres -d ai_lead_crm
```

Ajusta usuario/base si cambiaste los valores de ejemplo.

## Proveedores de análisis

### Mock: demo sin costos externos

```dotenv
AI_PROVIDER=mock
```

El backend detecta palabras clave y devuelve resultados deterministas. Es una simulación por reglas, no una inferencia de un modelo. No necesita una API key y no envía datos a OpenAI. El texto recibido determina el resultado; React solo lo solicita y presenta.

### OpenAI: integración opcional

```dotenv
AI_PROVIDER=openai
OPENAI_API_KEY=tu_clave
OPENAI_MODEL=tu_modelo_compatible
```

Reinicia el backend después de editar la configuración. El adaptador utiliza Chat Completions con Structured Outputs y valida la respuesta con Zod; requiere un modelo compatible y acceso en tu cuenta. Consulta la [referencia oficial de Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create).

En este modo, el texto de la conversación se envía a OpenAI y las peticiones pueden generar costos. Las credenciales se mantienen exclusivamente en el servidor: nunca uses variables `VITE_` para claves. La integración se verifica con transporte simulado en las pruebas; no se ha validado una llamada real con credenciales. No hay cambio silencioso a mock si OpenAI falla: la API devuelve `502` y la interfaz permite reintentar. Una configuración de proveedor inválida impide iniciar el servidor.

## API HTTP

| Método | Endpoint | Resultado |
| --- | --- | --- |
| GET | `/health` | `200`, estado del proceso (no comprueba la base) |
| POST | `/api/leads` | `201`, lead creado |
| GET | `/api/leads` | `200`, lista por creación descendente |
| GET | `/api/leads/:id` | `200`, lead |
| PATCH | `/api/leads/:id` | `200`, lead actualizado |
| DELETE | `/api/leads/:id` | `204`, sin cuerpo |
| POST | `/api/ai/analyze` | `200`, análisis y proveedor |

Las respuestas de datos usan `{ "data": ... }`; los errores, `{ "error": "..." }`. Los IDs deben ser UUID válidos. Datos inválidos devuelven `400`, contactos inexistentes `404` y correos duplicados `409`.

### Crear o actualizar leads

```json
{
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "company": "Analytical Engines",
  "phone": "+57 300 123 4567",
  "source": "website"
}
```

`name` y `email` son obligatorios para crear. `source` vale `manual` si se omite. `PATCH` acepta al menos un campo entre `name`, `email`, `company`, `phone`, `source` y `status`; omitir un campo conserva su valor. Enviar `""` limpia empresa o teléfono. Estados: `new`, `contacted`, `qualified`, `won`, `closed`, `lost`. La interfaz muestra `qualified` como Interesado y tanto `won` como `closed` como Cerrado. Las actualizaciones modifican `updatedAt`.

### Analizar una conversación

```http
POST /api/ai/analyze
Content-Type: application/json
```

```json
{ "conversation": "Quiero contratar y agendar una demo" }
```

Respuesta en modo mock:

```json
{
  "data": {
    "score": 85,
    "intent": "alta",
    "summary": "Análisis simulado por reglas. Se detectaron señales comerciales: demo.",
    "nextAction": "Proponer una reunión para confirmar necesidades y próximos pasos.",
    "topics": ["demo"],
    "provider": "mock"
  }
}
```

`conversation` debe contener entre 1 y 12 000 caracteres tras recortar espacios; no se aceptan campos adicionales. La intención es `alta`, `media` o `baja`; el score va de 0 a 100. Un fallo o respuesta inválida del proveedor devuelve `502`. El endpoint no modifica el estado del lead.

## Validación

```bash
npm test
npm run typecheck
npm run build
```

Las pruebas cubren CRUD, validación de análisis, mock sin credenciales, fallos de proveedor y contrato de OpenAI con transporte simulado. No requieren PostgreSQL ni acceso a servicios externos. Para comprobar la persistencia real, crea un contacto en la interfaz y recarga con Docker y la API activos.
