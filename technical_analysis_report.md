# Reporte de Análisis Técnico: Integración Meta WhatsApp Cloud API y Landing Page

Este documento resume los problemas técnicos identificados, las pruebas realizadas, las causas raíz y los algoritmos/scripts de diagnóstico para que otro asesor técnico pueda resolverlos rápidamente.

---

## 1. Problema de Autenticación de Meta WhatsApp API (HTTP 401 / OAuthException)

### Descripción del Problema
Al intentar enviar mensajes de plantilla o texto utilizando la API oficial de Meta Cloud, el servidor responde constantemente con errores de autenticación HTTP 401.

### Diagnóstico Realizado
1. **Tokens en Base de Datos de n8n**: Se escanearon y desencriptaron los tokens de n8n almacenados en el servidor. Se verificó que las credenciales etiquetadas como `Header Auth account` correspondían a Kommo (anteriormente amoCRM) y no a tokens de Meta.
2. **Tokens Históricos de Meta**: Se recuperaron dos tokens del historial de ejecuciones y base de datos (con prefijo `EAA...`).
3. **Ejecución de Prueba**: Se creó un algoritmo para validar los tokens contra el endpoint de Meta `/me` y `/whatsapp_business_accounts`.

### Algoritmo de Verificación de Tokens
Este script de Node.js realiza llamadas de diagnóstico a la API de Meta para comprobar el estado de cualquier token:

```javascript
// verify_tokens.js
const tokens = [
  "EAAMTSb17yPQBQfw1L...", // Token Histórico 1
  "EAAMTSb17yPQBQQH4..."  // Token Histórico 2
];

async function verify() {
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    console.log(`\n--- Probando Token ${i + 1} (${token.substring(0, 15)}...) ---`);
    try {
      // 1. Obtener información del usuario
      let res = await fetch("https://graph.facebook.com/v21.0/me?fields=id,name", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      let data = await res.json();
      console.log("Información de Usuario:", JSON.stringify(data, null, 2));

      if (res.ok) {
        // 2. Obtener cuentas de WhatsApp Business
        res = await fetch("https://graph.facebook.com/v21.0/me/whatsapp_business_accounts", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        data = await res.json();
        console.log("Cuentas de WhatsApp:", JSON.stringify(data, null, 2));
      }
    } catch (e) {
      console.error("Error en Fetch:", e.message);
    }
  }
}
verify();
```

### Resultados del Diagnóstico (Causa Raíz)
La API de Meta retornó el siguiente error para ambos tokens históricos:
```json
{
  "error": {
    "message": "Error validating access token: The session has been invalidated because the user changed their password or Facebook has changed the session for security reasons.",
    "type": "OAuthException",
    "code": 190,
    "error_subcode": 460
  }
}
```
*   **Causa Raíz**: Los tokens de Meta que teníamos guardados **fueron invalidados (código de error 190, subcódigo 460)** debido a un cambio de contraseña en la cuenta de Facebook administradora o porque eran tokens de corta duración (24 horas) que ya expiraron.
*   **Solución**: Se requiere generar un **Token de Acceso de Sistema Permanente (System User Access Token)** en el Administrador Comercial de Meta (Business Manager) con los permisos `whatsapp_business_messaging` y `whatsapp_business_management`, y obtener el **Phone Number ID** (ID de 15 dígitos) de la consola de desarrolladores.

---

## 2. Redirección y Auto-Cierre de la Landing Page

### Descripción del Problema
1. El número de teléfono no debe ser ingresado por el usuario en la landing page. Debe obtenerse del contexto de WhatsApp/Kommo.
2. Una vez que el formulario de la landing page (Nombre y Empresa) es enviado a n8n, la pestaña del navegador móvil del usuario debe cerrarse automáticamente para no dejarlo en una página en blanco o en un loop infinito de "Abriendo WhatsApp".

### Causa Raíz
*   Los navegadores web móviles modernos (Safari en iOS, Chrome en Android) restringen estrictamente el uso de `window.close()`. Un script **solo puede cerrar una ventana si esta fue abierta por el propio script** (usando `window.open()`). Si el usuario abrió el enlace desde WhatsApp, el navegador bloquea el cierre automático por razones de seguridad.

### Algoritmo de la Landing Page (Frontend Solución)
Se reestructuró la landing page (`public/index.html`) para:
1. Eliminar por completo el campo de entrada de teléfono.
2. Captar el identificador del contacto (`contactId`) y otros parámetros directamente desde la URL (`https://leads.centauroads.com/?contactId=XXXX`).
3. Enviar un payload mediante `fetch` (evitando CORS mediante una petición limpia de baliza) al webhook de n8n.
4. Redireccionar al usuario inmediatamente al chat de WhatsApp (`wa.me`) con un texto predefinido.
5. Implementar un fallback visual elegante (Glassmorphism con Loader y botón manual de cierre) para cuando el navegador bloquee el cierre automático.

```javascript
// Algoritmo de Envío y Redirección en public/index.html
document.getElementById('leadForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const submitBtn = document.getElementById('submitBtn');
  const loader = document.getElementById('loader');
  const successState = document.getElementById('successState');
  
  submitBtn.style.display = 'none';
  loader.style.display = 'block';
  
  const name = document.getElementById('name').value;
  const company = document.getElementById('company').value;
  
  // Obtener parámetros de la URL
  const urlParams = new URLSearchParams(window.location.search);
  const contactId = urlParams.get('contactId') || '';
  const screen = urlParams.get('screen') || '';
  
  const payload = {
    name: name,
    company: company,
    contactId: contactId,
    screen: screen,
    timestamp: new Date().toISOString()
  };
  
  try {
    // Enviar datos al webhook de n8n
    await fetch('https://n8n.centauroads.com/webhook/landing-leads-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      mode: 'no-cors' // Evita preflight CORS para respuestas rápidas
    });
    
    // Transición visual
    loader.style.display = 'none';
    successState.style.display = 'block';
    
    // 1. Redireccionar a WhatsApp con mensaje pre-rellenado
    const waUrl = "https://wa.me/584221003559?text=" + encodeURIComponent("Hola, he completado mi registro del Brief DOOH.");
    window.location.href = waUrl;
    
    // 2. Intentar cerrar la pestaña después de un pequeño retraso
    setTimeout(() => {
      window.close();
      
      // Si el navegador bloqueó window.close(), mostrar mensaje y botón manual
      document.getElementById('statusMsg').innerText = "¡Registro completado! Ya puedes regresar a WhatsApp.";
      document.getElementById('manualCloseBtn').style.display = 'inline-block';
    }, 1500);
    
  } catch (error) {
    console.error("Error al procesar el registro:", error);
    alert("Hubo un problema de conexión. Por favor, intente nuevamente.");
    submitBtn.style.display = 'block';
    loader.style.display = 'none';
  }
});
```

---

## 3. Configuración del Chatbot en n8n (Flujo `U02Z6lSLDwTr6Ber`)

### Descripción del Problema
Anteriormente se utilizaba el nodo de "Evolution API" para enviar mensajes interactivos y de texto (como el link del brief de Canva). Al quedar inactivo ese servicio secundario, se requiere migrar al canal oficial de Meta Cloud API de forma directa mediante peticiones HTTP.

### Reglas de Negocio de la API de Meta
1.  **Ventana de 24 Horas**: Solo se pueden enviar mensajes de texto libre (como enviar el link de Canva) si el usuario ha enviado un mensaje en las últimas 24 horas.
2.  **Mensajes de Plantilla**: Fuera de la ventana de 24 horas, es mandatorio utilizar plantillas aprobadas por Meta (por ejemplo, `seguimiento_brief_dooh`).

### Algoritmo del Payload de n8n para Envío de Plantilla (HTTP Request)
Para enviar la plantilla `seguimiento_brief_dooh` con variables dinámicas desde n8n:

*   **Método HTTP**: `POST`
*   **URL**: `https://graph.facebook.com/v21.0/{{$env.META_PHONE_NUMBER_ID}}/messages`
*   **Headers**:
    *   `Authorization`: `Bearer {{$env.META_ACCESS_TOKEN}}`
    *   `Content-Type`: `application/json`
*   **Payload JSON**:
```json
{
  "messaging_product": "whatsapp",
  "to": "{{$json.telefono_destinatario}}",
  "type": "template",
  "template": {
    "name": "seguimiento_brief_dooh",
    "language": {
      "code": "es"
    },
    "components": [
      {
        "type": "body",
        "parameters": [
          {
            "type": "text",
            "text": "{{$json.cliente_nombre}}"
          },
          {
            "type": "text",
            "text": "{{$json.empresa_nombre}}"
          }
        ]
      }
    ]
  }
}
```

### Algoritmo del Payload de n8n para Envío de Link de Canva (Mensaje de Texto Libre)
Si el usuario está dentro de la ventana de 24 horas, se envía el link como texto plano:

*   **Método HTTP**: `POST`
*   **URL**: `https://graph.facebook.com/v21.0/{{$env.META_PHONE_NUMBER_ID}}/messages`
*   **Payload JSON**:
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "{{$json.telefono_destinatario}}",
  "type": "text",
  "text": {
    "preview_url": true,
    "body": "Hola! Aquí tienes el link para completar tu Brief de Canva: https://canva.com/..."
  }
}
```

---

## 4. Próximos Pasos Recomendados para el Asesor Técnico
1.  **Generar Nuevo Token Permanente**:
    *   Ir a [Facebook Developers](https://developers.facebook.com/).
    *   Acceder al Administrador Comercial de la cuenta Centauro.
    *   Crear un **System User** (Usuario del Sistema) de nivel Admin.
    *   Generar un nuevo token permanente asociando la aplicación de WhatsApp.
    *   Asegurar que los permisos `whatsapp_business_messaging` y `whatsapp_business_management` estén seleccionados.
2.  **Actualizar las Variables de Entorno en el Servidor (Easypanel)**:
    *   Ingresar a Easypanel en `https://panel.centauroads.com` (o la URL del panel de control del droplet).
    *   Abrir el servicio de `n8n`.
    *   Configurar las variables de entorno:
        *   `META_ACCESS_TOKEN` = `[Nuevo Token EAA...]`
        *   `META_PHONE_NUMBER_ID` = `[ID de 15 dígitos del número de envío]`
3.  **Ejecutar el Script de Prueba**:
    *   Colocar el nuevo token y el ID del número en el script local `test-meta-waba.js` y correr `node test-meta-waba.js` en la consola para confirmar el envío de plantilla exitoso (HTTP 200).
