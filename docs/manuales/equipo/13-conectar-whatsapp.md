# 13. Conectar WhatsApp de principio a fin

Esta guía junta las piezas que están repartidas en varias pestañas. Necesitas una **cuenta de WhatsApp Business** del cliente en Meta y un **dominio con HTTPS** para que Meta pueda avisar a Ignis.

## Resumen de piezas

| Pieza                                                       | Dónde se configura                                       | Quién                  |
| ----------------------------------------------------------- | -------------------------------------------------------- | ---------------------- |
| Módulo **Canal de WhatsApp**                                | [Plan](02-pestana-plan.md) del cliente                   | Equipo de Ignis        |
| **Id del número** (`phone_number_id`) y **token de acceso** | **Canales** del panel del cliente                        | El dueño (o tú con él) |
| **Id de la cuenta de WhatsApp Business** (WABA)             | [Plantillas WhatsApp](07-pestana-plantillas-whatsapp.md) | Equipo de Ignis        |
| **Webhook** en Meta                                         | Meta for Developers → tu app → WhatsApp → Configuración  | Equipo de Ignis        |
| Variables de entorno del servidor                           | Despliegue                                               | Equipo de Ignis        |

## Paso a paso

1. **Activa el módulo.** En [Plan](02-pestana-plan.md) del cliente marca **Canal de WhatsApp**.
2. **Crea la app en Meta** (Meta for Developers) con el producto _WhatsApp_ y asocia la cuenta de WhatsApp Business y el número del cliente.
3. **Copia el Id del número** (_Phone number ID_) y genera un **token de acceso permanente** (usuario del sistema).
4. **Conecta el canal.** El dueño entra a **Canales** y pega el **Id del número** y el **token** (el token queda guardado cifrado y no se vuelve a mostrar).
5. **Configura el webhook en Meta.** URL de devolución de llamada: `https://TU-DOMINIO/webhooks/meta`. **Token de verificación:** el mismo valor de `IGNIS_META_VERIFY_TOKEN`. Suscribe el campo `messages`.
6. **Variables de entorno del servidor:**
   - `IGNIS_META_APP_SECRET`: el secreto de la app de Meta; con él Ignis verifica la firma de cada aviso.
   - `IGNIS_META_VERIFY_TOKEN`: el token de verificación del paso anterior.
7. **Guarda el Id de la cuenta (WABA)** en la pestaña Plantillas WhatsApp, para poder crear plantillas.
8. **Prueba:** escribe desde otro teléfono al número; el mensaje debe aparecer en **Conversaciones** y el asistente responder.

## Recordatorios

- Solo puedes escribir libremente dentro de las **24 horas** siguientes al último mensaje del cliente; fuera de ahí, usa una [plantilla aprobada](07-pestana-plantillas-whatsapp.md).
- Si Meta responde que el token no sirve, el token venció: genera uno permanente y vuélvelo a pegar en **Canales**.
- Mientras no haya cuenta real puedes practicar con el simulador de Meta (`IGNIS_META_GRAPH_URL`), descrito en Plantillas WhatsApp.
