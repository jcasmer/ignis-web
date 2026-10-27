# 7. Pestaña Plantillas WhatsApp

## Para qué sirve

WhatsApp solo deja que un negocio le escriba **libremente** a un cliente durante las **24 horas siguientes a su último mensaje**. Para escribirle **primero** (un aviso, un recordatorio) o **después de 24 horas**, hay que usar una **plantilla**: un mensaje que **Meta revisa y aprueba** antes de poder usarse. Esta pestaña permite crear esas plantillas, ver si Meta las aprobó, probarlas y borrarlas. Las plantillas aprobadas se usan después en las [automatizaciones](10-pestana-automatizaciones.md) (paso «Escribir por WhatsApp con una plantilla»).

![Plantillas de WhatsApp aprobadas](../imagenes/cliente-12-plantillas-whatsapp.jpg)

> Requisitos: el cliente debe tener el módulo **Canal de WhatsApp**, haber conectado su número en **Canales** (el dueño lo hace) y tener una **cuenta de WhatsApp Business** en Meta. Ver [Conectar WhatsApp de principio a fin](13-conectar-whatsapp.md).

## Tu cuenta de WhatsApp Business

| Campo                                    | Qué es                                                                                                                                                                                                                                                     |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Id de la cuenta de WhatsApp Business** | Meta guarda las plantillas en la _cuenta_ de WhatsApp Business (WABA), no en el número. Es un número largo, por ejemplo `109876543210`. **Solo dígitos** (hasta 40). Lo encuentras en Meta Business Suite → Configuración → Cuentas → Cuentas de WhatsApp. |
| **Guardar**                              | Guarda el id. Verás «Cuenta guardada.». Sin este id no se pueden crear plantillas.                                                                                                                                                                         |

## Tus plantillas

Cada tarjeta muestra el **nombre**, el idioma, el tipo (**Utilidad** o **Marketing**), cuándo se actualizó, el **estado**, el texto, el pie, y los botones **Enviar prueba** y **Borrar**.

| Estado          | Qué significa                                                                         |
| --------------- | ------------------------------------------------------------------------------------- |
| **En revisión** | Meta la está revisando; suele tardar de unos minutos a un día.                        |
| **Aprobada**    | Lista para usar.                                                                      |
| **Rechazada**   | Meta no la aprobó. Se muestra «Motivo de Meta: …». Crea otra corrigiendo lo que dice. |
| **Pausada**     | Meta la pausó (por ejemplo, por quejas de clientes). No se puede enviar por ahora.    |
| **Desactivada** | Meta la desactivó. No se puede enviar.                                                |

- **Actualizar estados** pregunta a Meta cómo va la revisión de todas. También se hace solo al abrir la página si hay plantillas en revisión.
- **Nueva plantilla** abre el formulario (necesita el id de la cuenta guardado).

## Crear una plantilla: cada campo

1. Pulsa **Nueva plantilla**.
2. Llena:

   | Campo                     | Qué es                                                                                                                                                                        | Reglas                                                                                           |
   | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
   | **Cómo la llamas**        | Un nombre para ti. Ej.: `Pedido listo`.                                                                                                                                       | Con él se arma solo el nombre para Meta.                                                         |
   | **Nombre para Meta**      | El nombre técnico.                                                                                                                                                            | Minúsculas, números y guion bajo, sin espacios, hasta 100. Ej.: `pedido_listo`. Se puede editar. |
   | **Idioma**                | Código de idioma de Meta.                                                                                                                                                     | `es`, `es_CO`, `es_MX`, `es_AR`, `es_ES`, `en`, `en_US`, `pt_BR`.                                |
   | **Tipo**                  | **Utilidad:** avisos de algo que el cliente ya hizo (pedido listo, cita, pago recibido). **Marketing:** promociones y novedades; Meta las revisa con más cuidado y cobra más. |                                                                                                  |
   | **Mensaje**               | El texto como lo leerá el cliente. Donde cambie un dato, marca una variable: `{{1}}`, `{{2}}`…                                                                                | Hasta 1024 caracteres.                                                                           |
   | **Ejemplos de los datos** | Aparece un campo por cada variable. Meta los lee para entender la plantilla.                                                                                                  | Un ejemplo real de cada una (hasta 150 caracteres, una línea).                                   |
   | **Pie (opcional)**        | Una línea corta debajo del mensaje.                                                                                                                                           | Hasta 60 caracteres, **sin variables**.                                                          |

   A la derecha, **Así lo verá el cliente** muestra una burbuja con los ejemplos puestos.

3. Pulsa **Enviar a Meta**. Verás «Plantilla enviada a Meta. Queda pendiente hasta que la revise.».

### Las reglas de Meta que Ignis comprueba antes de enviar

- Las variables van **en orden** (`{{1}}`, `{{2}}`, `{{3}}`…) y cada una se usa una vez.
- **Dos variables no pueden ir juntas** (`{{1}}{{2}}`): pon una palabra en medio.
- El mensaje **no puede empezar ni terminar con una variable**.
- Hasta **20 variables**.
- Un ejemplo por cada variable.
- No uses otras llaves dobles: `{{nombre}}` se rechaza.

### Errores frecuentes

- «Ya tienes una plantilla con ese nombre en ese idioma.»
- «Primero guarda el id de tu cuenta de WhatsApp Business.»
- «Primero conecta tu número de WhatsApp en Canales.»
- «No se pudo: Meta respondió: …»: es lo que dijo Meta, tal cual.
- «Meta no aceptó el token de acceso del canal: puede haber vencido»: el dueño debe volver a pegar un token vigente en **Canales**.

## Enviar prueba

Solo habilitado en plantillas **Aprobadas**.

1. Pulsa **Enviar prueba**.
2. **Número de WhatsApp:** con código de país y solo números (8 a 15 dígitos). Ej.: `573001234567`.
3. Llena un **Valor de la variable** por cada variable: una línea, sin tabuladores ni más de 4 espacios seguidos.
4. Revisa la vista previa y pulsa **Enviar**. Verás «Mensaje enviado a Meta.».

## Borrar

**Borrar** pide confirmación: se borra **también en Meta, en todos sus idiomas**; los mensajes ya enviados no cambian. No se puede deshacer. Si Meta falla, la plantilla se conserva.

## Probar sin cuenta de Meta: el simulador

Mientras no haya cuenta real, la plataforma puede apuntar a un simulador de Meta (`cmd/metasim`) con `IGNIS_META_GRAPH_URL=http://127.0.0.1:9999/v21.0`. Aprueba solo las plantillas tras unos segundos, y **rechaza** las que traen «reject» en el nombre. Solo para pruebas.
