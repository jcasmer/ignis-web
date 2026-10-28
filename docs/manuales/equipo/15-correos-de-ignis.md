# 15. Correos de Ignis

Ignis envía correos **desde la plataforma** (no son los avisos que el asistente manda a un negocio; esos están en la pestaña [Correo](05-pestana-correo.md)). Todos comparten un mismo diseño, con versión de texto para quien no ve HTML, y salen en español.

## Los correos de cuenta

| Correo                                                                          | Cuándo sale                                                                       | Qué lleva                                                                                                                     |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Activa tu cuenta de Ignis**                                                   | Al crear un cliente con invitación, y al **reenviar** la invitación               | Botón **Activar mi cuenta**. Enlace de un solo uso, vence en **3 días**.                                                      |
| **Te invitaron al equipo de Ignis**                                             | Al invitar a una persona al equipo ([Equipo](12-apartados-generales.md#equipo))   | Botón **Crear mi contraseña**. Un solo uso, vence en **3 días**.                                                              |
| **Restablece tu contraseña de Ignis**                                           | Cuando alguien usa «¿Olvidaste tu contraseña?»                                    | Botón **Elegir una contraseña nueva**. Un solo uso, vence en **30 minutos**. Avisa que se seguirá pidiendo el segundo factor. |
| **Cambió la contraseña de tu cuenta**                                           | Al cambiarla o restablecerla                                                      | Aviso, sin enlace: «si no fuiste tú, restablécela y avisa a Ignis».                                                           |
| **Se quitó el segundo factor de tu cuenta**                                     | Cuando un administrador (o el equipo de Ignis) quita el segundo factor de alguien | Aviso, sin enlace.                                                                                                            |
| **Se suspendió / se reactivó la cuenta**                                        | Al suspender o reactivar un cliente ([Seguridad](03-pestana-seguridad.md))        | Aviso al dueño; al suspender, con el **motivo** que escribiste.                                                               |
| **Confirma tu nuevo correo**                                                    | Al pedir el cambio de correo del dueño                                            | Va al **correo nuevo**, con el botón **Confirmar este correo** (un solo uso, 3 días).                                         |
| **Se pidió cambiar el correo de tu cuenta** y **Cambió el correo de tu cuenta** | Al pedir y al confirmar el cambio                                                 | Avisos al **correo anterior**, sin enlace.                                                                                    |

Los avisos de seguridad **no bloquean nada**: si no pueden enviarse, el cambio se hace igual y queda anotado en el registro del servidor.

## Cómo se configura

El envío usa **Brevo**. La API y el worker necesitan estas variables (en Railway):

| Variable                | Qué es                                                                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `IGNIS_BREVO_API_KEY`   | La clave de la API de Brevo.                                                                                                              |
| `IGNIS_MAIL_FROM_EMAIL` | La dirección desde la que se envía. **Debe pertenecer a un dominio autenticado en Brevo**, por ejemplo `no-responder@ignis.lumencorp.co`. |
| `IGNIS_MAIL_FROM_NAME`  | El nombre visible (por defecto `Ignis`).                                                                                                  |

Sin estas variables Ignis funciona, pero **no puede enviar correos**: crear un cliente con invitación mostrará el enlace para entregarlo a mano, y «¿Olvidaste tu contraseña?» no enviará nada.

## Si un correo no llega

1. Revisa **spam** y que el correo del destinatario esté bien escrito.
2. En Brevo → **Transactional → Logs** ves si salió y qué respondió el buzón.
3. Si el enlace venció, reenvíalo: ficha del cliente → **Seguridad** → **Reenviar el correo de activación**.
4. Si no sale ninguno, revisa que `IGNIS_MAIL_FROM_EMAIL` sea de un dominio autenticado y que la clave de Brevo esté en la **API** (los correos de cuenta salen de la API).
