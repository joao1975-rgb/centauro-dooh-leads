# Parche del landing — incrustar `ref_code` (public/index.html)

Objetivo: generar un código de referencia único por registro, enviarlo a n8n y **embeberlo en el texto prellenado de WhatsApp**. Es la clave que vincula el chat con la fila exacta de la Google Sheet, sin depender del número ni del email.

Son **3 ediciones** dentro del `<script>` del bloque `submit` (alrededor de las líneas 397–454). No toques nada más.

---

## Edición 1 — generar el `ref_code` dentro del objeto `data`

**Busca** (≈ línea 404):

```javascript
      timestamp: new Date().toISOString(),
      user_agent: navigator.userAgent
    };
```

**Reemplaza por:**

```javascript
      timestamp: new Date().toISOString(),
      user_agent: navigator.userAgent,
      // Código de referencia único: vincula este registro con el chat de WhatsApp.
      ref_code: "REF-" + Date.now().toString(36).toUpperCase()
              + Math.random().toString(36).slice(2, 7).toUpperCase()
    };
```

---

## Edición 2 — enviar el `ref_code` a n8n en el beacon

**Busca** (≈ línea 419):

```javascript
    params.append("user_agent", data.user_agent);
```

**Reemplaza por:**

```javascript
    params.append("user_agent", data.user_agent);
    params.append("ref_code", data.ref_code);
```

---

## Edición 3 — incrustar el `ref_code` en el mensaje de WhatsApp

**Busca** (≈ línea 452):

```javascript
    const msg = `Hola Centauro Ads, soy ${data.nombre} de la empresa ${data.empresa}, correo: ${data.email}. Vi su ${friendlyDevice} (${screenId}) y quiero recibir el brief de pantallas LED y TOTEMs.`;
```

**Reemplaza por:**

```javascript
    const msg = `Hola Centauro Ads, soy ${data.nombre} de la empresa ${data.empresa}, correo: ${data.email}. Vi su ${friendlyDevice} (${screenId}) y quiero recibir el brief de pantallas LED y TOTEMs. Mi código de registro es: ${data.ref_code}`;
```

---

## Notas

- El **mismo** `data.ref_code` viaja al beacon (Edición 2) y al `wa.me` (Edición 3). No lo regeneres entre medias.
- El beacon es fire-and-forget: si el cliente escribiera por WhatsApp antes de que la fila exista, la 1ª instancia no encontrará la fila por `ref_code`; el **barrido (2ª instancia)** la recupera después por `kommo_lead_id`. Cobertura garantizada.
- No cambia el comportamiento visible del landing ni el flujo "pull" (el lead sigue iniciando el chat).
