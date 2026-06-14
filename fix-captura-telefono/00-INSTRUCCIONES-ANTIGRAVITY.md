# Instrucción para Antigravity — Fix: captura fiable del teléfono de WhatsApp

> **Rol del agente:** Implementa este fix por fases, en orden. No avances de fase sin cumplir los
> criterios de aceptación (✅). Pide las credenciales `[SECRETO]` cuando las necesites; nunca las
> escribas en el repo. Trabaja sobre los archivos de esta carpeta (`fix-captura-telefono/`) y aplica
> los cambios indicados a `public/index.html` y a los flujos de `n8n/`.

---

## 0. Problema y causa raíz (contexto que NO debes ignorar)

El teléfono **no existe** cuando se crea el lead: el landing solo envía nombre, empresa, email,
screen_id y consentimiento. El número aparece **después**, cuando el cliente escribe por WhatsApp, y
Kommo lo adjunta **al contacto, no al lead**.

El diseño anterior intentaba capturarlo en un único disparo síncrono y fallaba porque:

1. El `entity_id` del webhook de mensaje es el `talk_id`, no el lead → la búsqueda fallaba.
2. Con emails duplicados, el fallback por email actualizaba la fila equivocada.
3. **No existía una clave determinística** que uniera el chat de WhatsApp con la fila del landing.
   Cuando Kommo no fusionaba el contacto (email) con el de WhatsApp (teléfono), el número quedaba en
   otro lead y la fila original nunca lo recibía. De ahí que unos registros sí y otros no.

**Solución (no la cambies):** un código de referencia único (`ref_code`) generado en el landing e
incrustado en el texto prellenado del WhatsApp + dos instancias de escritura con claves distintas:

- **1ª instancia (captura, tiempo real):** webhook de chat de Kommo → lee `ref_code` del mensaje →
  obtiene el teléfono de la API de Kommo → `UPDATE` de la fila por `ref_code`.
- **2ª instancia (barrido, red de seguridad):** cron cada 15 min → rellena lo que falte por
  `kommo_lead_id` → marca `sin_whatsapp` tras 48 h.

Claves distintas (`ref_code` y `kommo_lead_id`) ⇒ se cubren mutuamente.

---

## 1. Máquina de estados (columna `estado`)

| estado | significado | quién lo escribe |
|---|---|---|
| `esperando_chat` | lead creado con consentimiento, esperando WhatsApp | creación v2 |
| `sin_consentimiento` | lead sin consentimiento | creación v2 |
| `chat_iniciado` | llegó el mensaje, teléfono capturado | captura / barrido |
| `sin_whatsapp` | 48 h sin escribir; terminal | barrido |
| `chat_frio`, `reintentar_manana`, `reactivado_utility` | reactivación (flujo existente) | reactivación UTILITY |

---

## Fase 1 — Google Sheet (prerequisito)

Hoja `Leads` del documento `1vrWnwJtJKi0HfLxi4LNXxAYf0ggt1gsVAFzE8cnJo4I`.

- Añade la columna **`ref_code`** (siguiente columna libre, tras `Consentimiento`).
- Confirma que ya existen `telefono` y `kommo_contact_id` (columnas I y J). No las renombres.

✅ **Aceptación:** la fila de cabecera contiene exactamente `ref_code` y `kommo_lead_id` escritos así
(el emparejamiento de n8n usa el nombre de cabecera).

---

## Fase 2 — Landing (`public/index.html`)

Aplica las 3 ediciones de **`landing-patch-ref_code.md`** (generar `ref_code`, enviarlo en el beacon,
incrustarlo en el `wa.me`). El mismo `data.ref_code` debe viajar al beacon y al mensaje.

✅ **Aceptación:** al enviar el formulario, el mensaje prellenado de WhatsApp termina en
`...Mi código de registro es: REF-XXXXX`, y el payload a n8n incluye `ref_code` con ese mismo valor.

---

## Fase 3 — Flujo de creación v2

Sustituye el flujo `n8n/n8n-flujo-leads-kommo.json` por **`n8n-flujo-leads-kommo-v2.json`** (impórtalo
en n8n; mantén el mismo webhook `lead-dooh-api`). Cambios respecto al actual:

- Guarda `kommo_contact_id` (de `$json.contact_id` que devuelve `/leads/complex`).
- Guarda `ref_code` (del body del webhook).
- Deja `telefono` vacío y unifica `estado` a `esperando_chat` (consentimiento) / `sin_consentimiento`.

✅ **Aceptación:** un registro nuevo aparece en la hoja con `kommo_lead_id`, `kommo_contact_id` y
`ref_code` poblados, `telefono` vacío y `estado = esperando_chat`.

---

## Fase 4 — Captura en tiempo real (1ª instancia)

Importa **`n8n-captura-telefono.json`**. Configura en Kommo el webhook de **mensaje entrante / chat**
apuntando a `/webhook/kommo-chat-inbound`.

> ⚠️ **Verifica los nombres de campo del webhook:** Kommo envía `form-urlencoded` con claves tipo
> `message[add][0][text]`. **Fija (pin) una ejecución real** y confirma que las claves que lee el nodo
> *“Parsear webhook entrante”* coinciden con tu instancia; ajústalas si difieren. Este es el único
> punto que depende de la configuración concreta de tu cuenta.

Credencial Kommo: Header Auth → `Authorization: Bearer [SECRETO: KOMMO_TOKEN]`.

✅ **Aceptación:** tras enviar el WhatsApp prellenado, la fila con ese `ref_code` pasa a `telefono`
lleno (normalizado) y `estado = chat_iniciado` en segundos, **sin** tocar otras filas con el mismo
email/número.

---

## Fase 5 — Barrido de reconciliación (2ª instancia)

Importa **`n8n-barrido-reconciliacion.json`** (cron 15 min). Usa la misma credencial de Kommo.

✅ **Aceptación (red de seguridad):** desactiva temporalmente la Fase 4, crea un lead, escribe por
WhatsApp (la fila queda sin teléfono); en ≤15 min el barrido la rellena por `kommo_lead_id`. Un lead
que nunca escribe pasa a `sin_whatsapp` a las 48 h.

---

## Fase 6 — Pruebas finales

| Test | Pasos | Esperado |
|---|---|---|
| A. Vinculación | Form con email repetido → enviar WhatsApp | Se actualiza **solo** la fila de ese `ref_code` |
| B. Número duplicado | Dos `ref_code` distintos desde el mismo número | Cada uno actualiza su propia fila |
| C. Barrido | Captura off, escribir WhatsApp | El cron rellena en ≤15 min |
| D. Expiración | Crear lead y no escribir | `sin_whatsapp` a las 48 h |
| E. Idempotencia | Reenviar el mismo mensaje 2 veces | UPDATE, sin filas duplicadas |

✅ **Aceptación global:** 0 registros nuevos con consentimiento quedan sin teléfono pasadas 48 h
(o están explícitamente en `sin_whatsapp`).

---

## Archivos de esta carpeta

| Archivo | Rol |
|---|---|
| `00-INSTRUCCIONES-ANTIGRAVITY.md` | Este plan por fases |
| `n8n-flujo-leads-kommo-v2.json` | Creación v2 (guarda `ref_code` + `kommo_contact_id`) |
| `n8n-captura-telefono.json` | 1ª instancia: captura por webhook de chat |
| `n8n-barrido-reconciliacion.json` | 2ª instancia: cron de reconciliación |
| `landing-patch-ref_code.md` | 3 ediciones exactas en `public/index.html` |

> El flujo de reactivación (`chat_frio` → plantilla UTILITY) es independiente y no se modifica; ahora
> recibirá el `telefono` ya garantizado por estas dos instancias.
