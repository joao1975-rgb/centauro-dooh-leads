/**
 * Script de prueba definitivo para validar la plantilla de Meta WhatsApp "seguimiento_brief_dooh"
 * 
 * Instrucciones:
 * 1. Abre este archivo.
 * 2. Reemplaza "TU_META_ACCESS_TOKEN_REAL" por tu token de la consola de desarrolladores de Facebook.
 * 3. Reemplaza "TU_PHONE_NUMBER_ID_DE_15_DIGITOS" por el Phone ID de tu número de envío.
 * 4. Guarda el archivo (Ctrl + S) y ejecútalo en la terminal con:
 *    node c:\Users\joaou\OneDrive\Documentos\Claude\Projects\FormWeb\test-meta-waba.js
 */

// === CONFIGURACIÓN DE TU CUENTA META ===
// ⚠️ Reemplaza estos dos valores con los de tu consola de Meta
const META_ACCESS_TOKEN = "EAAuXaFZA8wfMBRkLBltdKq5JfZCbyxEVmYzIuNis9IoXDIcC68r2ZB3n4Q5Rh1ZBQmfLEYItZCHZCLlsggxOGAxLewl7BJIe33LVCZB871cBt1EF8x8GAUwqhrwmW3uGBbQKpZC0JLy8Es9Cslc7pVxVxtD3QtmxhHKnXMR1HLWqQGbwb6ANVjIMYiuDudpdqd21qQ4CkQghvlUtYZAalgQjCXzwZCY5gaSnubUwrx";
const PHONE_NUMBER_ID = "930566336807989";

// El número del destinatario de prueba (el tuyo)
const RECIPIENT_NUMBER = "584142137262";

// === DATOS DE LA PLANTILLA ===
const TEMPLATE_NAME = "seguimiento_brief_dooh";
const LANGUAGE_CODE = "es";
const CLIENTE_NOMBRE = "Maria"; // Variable {{1}} de la plantilla
const EMPRESA_NOMBRE = "Inversiones MP"; // Variable {{2}} de la plantilla

// === EJECUCIÓN DE LA LLAMADA AL API DE META ===
async function sendTemplateTest() {
  const url = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: RECIPIENT_NUMBER,
    type: "template",
    template: {
      name: TEMPLATE_NAME,
      language: {
        code: LANGUAGE_CODE
      },
      components: [
        {
          type: "body",
          parameters: [
            {
              type: "text",
              text: CLIENTE_NOMBRE
            },
            {
              type: "text",
              text: EMPRESA_NOMBRE
            },
            {
              type: "text",
              text: "https://links.centauroads.com/oferta-dooh"
            }
          ]
        }
      ]
    }
  };

  console.log("Iniciando envío de plantilla a Meta...");
  console.log(`URL: ${url}`);
  console.log(`Destinatario de prueba: ${RECIPIENT_NUMBER}`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${META_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (response.ok) {
      console.log("\n🎉 ¡MENSAJE ENVIADO CON ÉXITO!");
      console.log("Respuesta de Meta:", JSON.stringify(result, null, 2));
    } else {
      console.error("\n❌ ERROR AL ENVIAR EL MENSAJE:");
      console.error(`Código de Estado HTTP: ${response.status}`);
      console.error("Detalles del Error:", JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error("\n❌ ERROR DE RED O CONEXIÓN:");
    console.error(error.message);
  }
}

sendTemplateTest();
