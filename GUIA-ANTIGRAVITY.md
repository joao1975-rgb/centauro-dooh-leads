# Guía de desarrollo para Antigravity — Captura de Leads DOOH (Centauro Ads)

> **Instrucción para el agente:** Eres responsable de implementar, configurar y verificar el sistema
> de captura de leads descrito abajo. Trabaja por fases, en orden. No avances de fase sin cumplir
> los criterios de aceptación. Pide al usuario las credenciales marcadas como `[SECRETO]` cuando
> las necesites; nunca las escribas en el repositorio.

---

## 1. Contexto del proyecto

Centauro Ads vende espacios en pantallas DOOH (LED/TOTEMs) en Caracas. Un peatón escanea un QR
dinámico en la pantalla → llega a una landing → deja nombre/empresa (email opcional) → es
redirigido a WhatsApp con mensaje prellenado → el lead inicia el chat (flujo "pull", cero riesgo
de spam ante Meta) → Kommo CRM registra y gestiona el seguimiento.

**Arquitectura decidida (no la cambies):** el lead SIEMPRE inicia la conversación de WhatsApp.
Las plantillas salientes (UTILITY) solo se usan para reactivar leads que YA escribieron y
dejaron de responder. Nunca enviar plantillas a números tipeados en formularios.

### Stack y recursos
| Recurso | Detalle |
|---|---|
| Hosting | Droplet DigitalOcean, despliegues vía Easypanel |
| Repositorio | GitHub (crear repo `centauro-dooh-leads`) |
| Automatización | n8n self-hosted en el mismo droplet |
| CRM | Kommo, con WhatsApp Business API integrado |
| Número API (WABA) | +422-1003559 — registrado y validado en Meta, conectado a Kommo |
| Número app (closer) | 0424-2644335 — NO se usa en el flujo automatizado |
| Diseño | Canva Pro (assets exportados por el usuario) |
| QR dinámico | Sistema propio; apuntar destino a la landing con `?screen=<ID>` |

### Archivos base entregados (en esta carpeta)
- `escenario-2-api-kommo/index.html` — landing funcional (form 2 campos + consent → beacon a n8n → redirect wa.me)
- `escenario-2-api-kommo/n8n-flujo-leads-kommo.json` — webhook → lead en Kommo → log Sheets → email brief
- `escenario-2-api-kommo/n8n-reactivacion-utility.json` — cron 24h → plantilla UTILITY a leads `chat_frio`
- `README.md` — despliegue general

---

## 2. Placeholders y credenciales

Pedir al usuario y configurar como variables de entorno / credenciales de n8n (NUNCA en el código):

| Placeholder | Dónde se usa | Cómo obtenerlo |
|---|---|---|
| `N8N_WEBHOOK_URL` | index.html | URL generada al activar el workflow en n8n |
| `KOMMO_SUBDOMAIN` | flujo n8n | subdominio de la cuenta (https://SUB.kommo.com) |
| `KOMMO_TOKEN` [SECRETO] | credencial Header Auth n8n | Kommo → Ajustes → Integraciones → token de larga duración |
| `KOMMO_PIPELINE_ID` | flujo n8n | GET /api/v4/leads/pipelines (ver Fase 3) |
| `KOMMO_FIELD_ID_PANTALLA` | flujo n8n | ID del campo personalizado creado en Fase 3 |
| `GOOGLE_SHEET_ID` | flujos n8n | crear hoja "Leads" y copiar ID de la URL |
| `META_PHONE_NUMBER_ID` [SECRETO] | flujo reactivación | Meta Business → WhatsApp → API setup |
| `META_TOKEN` [SECRETO] | credencial Header Auth n8n | token permanente de la app de Meta |
| `BRIEF_URL` | landing, emails, Salesbot | PDF subido al droplet |

---

## 3. Fases de implementación

### FASE 1 — Repositorio y landing (código)
1. Crear repo GitHub `centauro-dooh-leads` con la estructura:
   ```
   /public/index.html        (base: escenario-2-api-kommo/index.html)
   /public/privacidad.html   (crear: aviso de tratamiento de datos, ver 3.1)
   /public/brief-centauro.pdf (lo aporta el usuario desde Canva)
   ```
2. Mejoras a aplicar sobre `index.html`:
   - Mover `N8N_WEBHOOK_URL` a un `config.js` no versionado o inyectado en build.
   - Validación visual de campos y estado de error si el beacon falla (no bloquear el redirect).
   - Peso total de página < 100 KB, sin frameworks, sin fuentes externas. Objetivo: carga < 4 s en 4G.
   - Conservar INTACTOS: parámetro `?screen=`, checkbox de consentimiento obligatorio,
     `sendBeacon` antes del redirect, y el mensaje prellenado con nombre/empresa/pantalla.
3. **3.1 privacidad.html:** redactar aviso breve — qué datos se capturan (nombre, empresa, email,
   teléfono al iniciar chat, estadísticas de escaneo), finalidad (contacto comercial), y canal de
   baja ("escribe BAJA por WhatsApp").

**Aceptación:** Lighthouse mobile ≥ 90 en Performance; el flujo completo funciona con webhook de prueba.

### FASE 2 — Despliegue (Easypanel)
1. En Easypanel: nuevo servicio estático apuntando al repo (carpeta `/public`), dominio + HTTPS.
2. Probar desde móvil real con datos: `https://DOMINIO/?screen=TEST_01`.

**Aceptación:** la página carga por HTTPS, el form envía y redirige a `wa.me/4221003559` con el texto correcto.

### FASE 3 — Configuración de Kommo
Ejecutar vía API (base `https://{KOMMO_SUBDOMAIN}.kommo.com/api/v4`, header `Authorization: Bearer {KOMMO_TOKEN}`) o guiar al usuario en la UI:

1. **Pipeline:** crear "DOOH Caracas" con etapas: `Nuevo lead QR` → `Chat iniciado` → `Calificado` → `Propuesta` → `Ganado/Perdido`.
   - API: `POST /leads/pipelines`. Guardar el `id` devuelto → `KOMMO_PIPELINE_ID`.
2. **Campo personalizado** en Leads: "Pantalla de origen" (tipo texto).
   - API: `POST /leads/custom_fields`. Guardar `id` → `KOMMO_FIELD_ID_PANTALLA`.
3. **Salesbot** (UI de Kommo → Ajustes → Herramientas de comunicación → Salesbot):
   - Disparador: mensaje entrante de WhatsApp (+422).
   - Acciones: (a) responder de inmediato: "¡Hola! Soy el asistente de Centauro Ads 👋 Aquí tienes
     el brief de nuestras pantallas: {BRIEF_URL}. Un asesor te escribe en breve. ¿En qué zona te
     interesa anunciar?"; (b) mover el lead a etapa `Chat iniciado`; (c) crear tarea para el vendedor
     con vencimiento 30 min en horario laboral.
   - La respuesta ocurre dentro de la ventana de 24h (gratis, sin plantilla).
4. **Formulario nativo de Kommo (opcional, solo si el usuario prefiere no usar la landing propia):**
   Leads → Configurar → + Añadir fuente → Formulario web de Kommo. Campos: Nombre (Contacto),
   Empresa (Compañía), Email (Contacto), checkbox consentimiento. En "Configuración": pipeline
   "DOOH Caracas", etapa `Nuevo lead QR`, redirección de gracias a
   `https://wa.me/4221003559?text=Hola,%20quiero%20el%20brief%20de%20pantallas`. El QR debe llevar
   `?utm_source=dooh&utm_content=<SCREEN_ID>` (Kommo captura UTM automáticamente).
   ⚠️ Limitación conocida: esta vía no inyecta nombre/empresa en el mensaje de WhatsApp. La landing
   propia es la opción preferida del proyecto.

**Aceptación:** un POST de prueba a `/leads/complex` crea lead+contacto+compañía visibles en el pipeline correcto con el campo pantalla lleno.

### FASE 4 — Flujos n8n
1. Importar `n8n-flujo-leads-kommo.json`, sustituir placeholders, crear credenciales
   (Google Sheets OAuth, Gmail, Header Auth Kommo). Crear la hoja "Leads" con columnas:
   `timestamp, screen_id, nombre, empresa, email, kommo_lead_id, estado`.
2. Importar `n8n-reactivacion-utility.json`, sustituir `META_PHONE_NUMBER_ID` y credencial de Meta.
   **NO activarlo** hasta que Meta apruebe la plantilla (Fase 5) y exista al menos un lead real `chat_frio`.
3. Añadir manejo de errores: en el flujo de reactivación, capturar respuesta con error `131049`
   (frequency capping) → marcar fila como `reintentar_manana`, no reintentar el mismo día.

**Aceptación:** submit del form → fila en Sheets + lead en Kommo en < 5 s; ejecución manual del flujo de reactivación con un registro de prueba propio funciona.

### FASE 5 — Plantilla de Meta (la somete el usuario, tú preparas el contenido)
- Nombre: `seguimiento_brief_dooh` · Categoría: **UTILITY** · Idioma: `es`
- Cuerpo: "Hola {{1}}, te escribimos por el brief de pantallas DOOH que solicitaste para {{2}}.
  Sigue disponible aquí: {BRIEF_URL_CORTO}. Responde este mensaje si quieres agendar una llamada."
- Reglas: sin lenguaje promocional (riesgo de reclasificación a MARKETING), someter el día 1
  (aprobación 24–48 h).

### FASE 6 — Verificación end-to-end (obligatoria antes de entregar)
Checklist a ejecutar y reportar:
- [ ] QR de prueba → landing con `?screen=TEST_01` carga < 4 s en 4G real
- [ ] Submit → fila en Sheets con screen_id correcto
- [ ] Lead en Kommo: pipeline DOOH Caracas, etapa Nuevo lead QR, campo pantalla, contacto y compañía
- [ ] Redirect abre WhatsApp con nombre, empresa y pantalla en el texto
- [ ] Al enviar el mensaje, el Salesbot responde en < 10 s con el brief y mueve la etapa
- [ ] Email con brief llega si se dio correo
- [ ] privacidad.html accesible desde el form
- [ ] Webhook n8n rechaza/ignora payloads sin consentimiento=true

## 4. Reglas duras (no negociables)
1. Nunca integrar librerías no oficiales de WhatsApp (Baileys/WAHA/Evolution).
2. Nunca enviar plantillas a números que no hayan iniciado chat.
3. El 0424-2644335 queda fuera de toda automatización.
4. Secretos solo en credenciales de n8n / variables de entorno; jamás en el repo.
5. No añadir dependencias pesadas a la landing (sin React, sin Tailwind CDN, sin analytics de terceros).

## 5. Entregable final
Repo desplegado + flujos n8n activos + Kommo configurado + checklist de Fase 6 ejecutado y
reportado al usuario con evidencias (capturas o logs por paso).
