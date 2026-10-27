# Manuales de Ignis

Dos series de manuales, escritas con las pantallas reales de la consola:

| Serie                      | Para quién                              | Qué encuentras                                                                                                                                                                                                  |
| -------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Equipo de Ignis](equipo/) | Quien opera la plataforma (super admin) | Cómo dar de alta un cliente, qué hace **cada pestaña** de un cliente y **cada opción**, y tutoriales paso a paso: conectar un sistema, armar una automatización, preparar el conocimiento, configurar WhatsApp. |
| [Cliente](cliente/)        | El dueño o administrador del negocio    | Cómo usar su panel día a día: ver conversaciones y reportes, aprobar acciones, contarle su negocio al asistente, crear automatizaciones y plantillas de WhatsApp.                                               |

Cómo leerlos:

- Cada pantalla se explica en este orden: **para qué sirve**, **cada opción** (qué es, qué valores acepta, qué pasa si la cambias) y **errores frecuentes**.
- Los tutoriales llevan los pasos numerados y un ejemplo completo con datos de un negocio ficticio, «Café Luna» (una cafetería de Medellín).
- Lo que escribes en la consola aparece entre «comillas»; los nombres de botones y campos van en **negrita**, tal como se ven en pantalla.
- Las imágenes viven en [imagenes/](imagenes/). Si una pantalla cambia, se vuelve a capturar con el mismo nombre.

## Serie del equipo de Ignis

1. [Primeros pasos: entrar y moverse por el panel](equipo/00-primeros-pasos.md)
2. [Crear un cliente](equipo/01-crear-un-cliente.md)
3. Las pestañas de un cliente, una por una:
   1. [Plan](equipo/02-pestana-plan.md)
   2. [Seguridad](equipo/03-pestana-seguridad.md)
   3. [Créditos](equipo/04-pestana-creditos.md)
   4. [Correo](equipo/05-pestana-correo.md)
   5. [Asistente](equipo/06-pestana-asistente.md)
   6. [Plantillas WhatsApp](equipo/07-pestana-plantillas-whatsapp.md)
   7. [Conectores](equipo/08-pestana-conectores.md) (incluye el tutorial de Zoho CRM)
   8. [Conocimiento (RAG)](equipo/09-pestana-conocimiento.md)
   9. [Automatizaciones](equipo/10-pestana-automatizaciones.md) (incluye el tutorial paso a paso)
   10. [Privacidad](equipo/11-pestana-privacidad.md)
4. [Los apartados generales del panel: Resumen, Demo, Paquetes, Precios de IA y Equipo](equipo/12-apartados-generales.md)
5. [Conectar WhatsApp de principio a fin](equipo/13-conectar-whatsapp.md)
6. [Preguntas y problemas frecuentes](equipo/14-problemas-frecuentes.md)

## Serie del cliente

1. [Bienvenida: entrar y conocer tu panel](cliente/00-bienvenida.md)
2. [Resumen](cliente/01-resumen.md)
3. [Conversaciones](cliente/02-conversaciones.md)
4. [Reportes](cliente/03-reportes.md)
5. [Acciones por aprobar](cliente/04-acciones.md)
6. [Automatizaciones](cliente/05-automatizaciones.md) (con tutorial)
7. [Asistente](cliente/06-asistente.md)
8. [Conocimiento](cliente/07-conocimiento.md)
9. [Créditos](cliente/08-creditos.md)
10. [Canales](cliente/09-canales.md)
11. [Plantillas WhatsApp](cliente/10-plantillas-whatsapp.md) (con tutorial)
12. [Conectores](cliente/11-conectores.md)
13. [Correo](cliente/12-correo.md)
14. [Privacidad](cliente/13-privacidad.md)
15. [Preguntas frecuentes](cliente/14-preguntas-frecuentes.md)

## Glosario mínimo

- **Tenant / cliente:** un negocio que usa Ignis. Sus datos están aislados de los de los demás.
- **Módulo:** una capacidad que se contrata (WhatsApp, correo, automatizaciones…). Sin el módulo, la función no aparece o se rechaza.
- **Límite:** un tope del plan (usuarios, correos por día, documentos…).
- **Asistente:** la IA que responde a los contactos del negocio por los canales conectados.
- **Contacto:** una persona que le escribe al negocio.
- **Conector:** la unión entre el asistente (o una automatización) y un sistema del negocio, como un CRM, por su API.
- **Automatización:** una regla fija: «cuando pasa esto y se cumple esto, haz aquello». Puede usar o no IA.
- **Plantilla de WhatsApp:** un mensaje que Meta debe aprobar, necesario para escribirle primero a un cliente o después de 24 horas sin hablar.
- **Conocimiento (RAG):** los documentos del negocio que el asistente consulta para responder con datos reales.
- **Crédito:** el saldo en dólares con el que se paga el uso de la IA.
