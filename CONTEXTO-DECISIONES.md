# Contexto de decisiones (resumen de los análisis council)

Documento de referencia para el agente de desarrollo. Resume POR QUÉ la arquitectura es como es.
No modificar la arquitectura sin consultar al usuario.

## Decisión central
El lead SIEMPRE inicia la conversación de WhatsApp (flujo "pull" vía wa.me con mensaje prellenado).
Razones:
1. **Meta/anti-spam:** un chat iniciado por el usuario abre la ventana de servicio de 24h — se puede
   responder libremente sin plantillas, sin costo y sin riesgo para el quality rating del número.
2. **Calidad del dato:** el número de WhatsApp se captura verificado de facto (escribió desde él),
   eliminando typos del campo más propenso a error de un formulario en la calle.
3. **Confianza:** los usuarios no quieren escribir su número en el formulario de una valla; sí están
   dispuestos a iniciar ellos el chat (control percibido).
4. **Conversión B2B:** en el mercado venezolano cierra la conversación humana, no el PDF automático.

## Rol de cada número
- **+422-1003559 (API, en Kommo):** puerta de entrada del funnel. Kommo registra cada chat
  automáticamente; Salesbot responde al instante en la ventana 24h.
- **0424-2644335 (app):** línea del vendedor/closer. FUERA de toda automatización.

## Rol de la API de WhatsApp
"La API no da permiso de empujar; da memoria y estructura cuando el lead jala primero."
- NO se usa para captura ni para entrega inicial del brief (eso lo cubre la ventana 24h).
- SÍ se usa para reactivación: plantilla UTILITY `seguimiento_brief_dooh` a leads que iniciaron
  chat y enfriaron >24h. UTILITY está exenta del frequency capping (~2 plantillas marketing por
  usuario/día, error 131049) y es más barata.
- Riesgo vigilado: Meta puede reclasificar una utility a marketing si el texto suena promocional.

## Decisiones descartadas (no reintroducir)
- Tally/Typeform: terceriza el dato sin necesidad; la landing propia da control y atribución.
- Push de plantilla al número tipeado en el formulario: typos → mensajes no solicitados →
  bloqueos → rating rojo → muerte del número API. El rescate de quien no abrió WhatsApp es por EMAIL.
- Instagram como destino del QR: fricción de login y distracción.
- Librerías no oficiales (Baileys/WAHA): riesgo de baneo del número.

## Mandatos pendientes del council
- Piloto de 2 semanas en UNA pantalla antes de escalar (medir: escaneos → submits → chats → ventas).
- Definir SLA humano de respuesta (quién, horario, fin de semana).
- Mitigar desconfianza del prefijo +422: display name verificado "Centauro Ads ✓" anunciado en
  pantalla y landing.
- Aviso de privacidad y opt-in documentable (checkbox en el form).
- Fallback estático si el droplet cae (el QR dinámico permite redirigir).
- Verificar propiedad/portabilidad del WABA si Kommo actúa como BSP (plan de salida ante lock-in).

## Visión de producto (fase posterior, post-piloto)
La misma infraestructura (QR por pantalla → landing co-brandeada → WhatsApp del anunciante →
reporte de leads/atribución) es vendible a los propios anunciantes de Centauro como producto
"DOOH con leads medibles" — pricing premium y atribución por pantalla como diferenciador.
