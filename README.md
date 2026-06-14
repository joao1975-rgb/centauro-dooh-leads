# MVP Captura de Leads DOOH — Centauro Ads

Dos MVPs según el veredicto del council. **El flujo de captura es idéntico en ambos** (el consejo
determinó que el flujo "pull" gana con o sin API): QR dinámico → landing propia → registro en n8n →
redirección a wa.me con mensaje prellenado → el lead inicia el chat (cero riesgo de spam ante Meta).
Lo que cambia entre escenarios es el **número de destino** y lo que pasa **después** del chat.

## Estructura

```
escenario-1-sin-api/
  index.html              Landing (botón wa.me → 0424-2644335, WhatsApp Business app)
  n8n-flujo-leads.json    Webhook → Google Sheets → email con brief (si dio email)

escenario-2-api-kommo/
  index.html                     Landing (botón wa.me → +422-1003559, número API en Kommo)
  n8n-flujo-leads-kommo.json     Webhook → lead en Kommo → log Sheets → email con brief
  n8n-reactivacion-utility.json  Cron 24h → plantilla UTILITY solo a leads que YA iniciaron chat y enfriaron
```

## Despliegue (ambos escenarios)

1. **Repo:** sube la carpeta del escenario a GitHub.
2. **Easypanel:** crea un servicio de sitio estático apuntando al repo (o Nginx sirviendo `index.html`)
   en tu droplet de DigitalOcean. Asigna dominio + HTTPS.
3. **n8n:** importa el/los JSON (menú → Import from file). Reemplaza los placeholders:
   - `REEMPLAZA_ID_DE_TU_GOOGLE_SHEET` y credencial de Google Sheets/Gmail
   - Escenario 2: subdominio Kommo, `PIPELINE_ID`, `FIELD_ID_PANTALLA`, token Bearer de Kommo,
     `PHONE_NUMBER_ID` de la Cloud API y credencial Header Auth con el token de Meta
4. **Landing:** edita el bloque CONFIGURACION de `index.html` (URL del webhook n8n y número).
5. **QR dinámico:** apunta cada pantalla a `https://tu-dominio.com/?screen=TOTEM_CCS_01`
   (un `screen` distinto por dispositivo → atribución por pantalla en Sheets/Kommo).
6. **Brief:** exporta el PDF desde Canva y hospédalo en el droplet (`/brief-centauro.pdf`).

## Escenario 2 — pasos adicionales (de las conclusiones del council)

- **Somete la plantilla UTILITY el día 1** (la aprobación tarda 24–48 h y es el cuello de botella):
  nombre `seguimiento_brief_dooh`, categoría **UTILITY**, idioma es:
  > Hola {{1}}, te escribimos por el brief de pantallas DOOH que solicitaste para {{2}}.
  > Sigue disponible aquí: [LINK]. Responde este mensaje si quieres agendar una llamada.
- **Salesbot en Kommo:** configura respuesta automática al chat entrante del +422 que entregue el
  brief de inmediato dentro de la ventana de 24h (gratis, sin plantilla) y avise a un humano.
- **Display name verificado:** asegúrate de que el +422 muestre "Centauro Ads" con check; el número
  con prefijo extraño genera desconfianza — la pantalla y la landing deben anunciar
  "te responderá Centauro Ads ✓".
- **Regla de oro anti-baneo:** las plantillas SOLO se envían a números que iniciaron chat
  (estado `chat_frio` en el Sheet). Nunca push a números tipeados en el formulario.
  Manejar error 131049 (frequency capping) y vigilar el quality rating en Meta Business.

## Antes de escalar a toda la red (mandato del council)

Piloto de 2 semanas en UNA pantalla midiendo: escaneos (stats del QR) → submits (Sheets) →
chats iniciados → conversaciones de venta. Ese embudo decide la expansión.

## Pendientes fuera del MVP

`privacidad.html` (aviso de tratamiento de datos), monitoreo de caída del droplet con fallback
estático (GitHub Pages), definición del SLA humano de respuesta (horarios, responsable, fin de semana).
