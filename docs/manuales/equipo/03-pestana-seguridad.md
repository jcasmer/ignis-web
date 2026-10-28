# 3. Pestaña Seguridad

## Para qué sirve

Decide si **todos los usuarios de este cliente** deben proteger su cuenta con un segundo factor (código de 6 dígitos de una app de autenticación), además de la contraseña.

![Pestaña Seguridad](../imagenes/admin-05-seguridad.jpg)

## La opción

**Exigir segundo factor a los usuarios de este cliente** (interruptor)

- **Encendido:** quien no tenga segundo factor configurado lo configura en su **siguiente ingreso**: la consola le muestra un código QR para registrar la app y sus códigos de recuperación. **Con esto activo nadie puede desactivarlo.**
- **Apagado:** cada usuario decide si lo usa.
- Al cambiarlo se guarda al instante: verás «Política actualizada.».

## Cuándo encenderlo

- Siempre que el cliente maneje datos de personas (casi todos): es la medida más barata contra el robo de cuentas.
- Para el piloto, déjalo encendido y avisa al dueño que la primera vez le pedirá escanear un QR.

## Si un usuario del cliente pierde su teléfono

Hoy el restablecimiento del segundo factor de un usuario del cliente se pide al equipo de Ignis (el panel del cliente todavía no tiene una pantalla de usuarios). Consulta [Problemas frecuentes](14-problemas-frecuentes.md).

## Estado de la cuenta: suspender y reactivar

**Suspender la cuenta** cierra todo el acceso del cliente sin borrar nada. Se usa, por ejemplo, por falta de pago o por un uso indebido.

1. Pestaña **Seguridad** → **Estado de la cuenta** → **Suspender la cuenta**.
2. Escribe el **motivo**: es **obligatorio** porque **lo lee el dueño** en el correo que recibe («Falta de pago de la factura de octubre»).
3. Confirma. El encabezado de la ficha y la lista de clientes muestran **Suspendido** y el motivo.

**Qué pasa mientras está suspendida**

- Nadie del cliente puede ingresar: al escribir su contraseña correcta ven «Esta cuenta está suspendida. Escribe al equipo de Ignis para reactivarla.».
- Las **sesiones abiertas y las llaves de API dejan de servir en pocos segundos** (hasta 10 s).
- El **asistente no responde** (los mensajes que lleguen se descartan, no se acumulan) y las **automatizaciones no corren**.
- **Los datos se conservan**: conversaciones, documentos, plantillas y configuración.
- Tú, como equipo de Ignis, sigues pudiendo entrar a su ficha y configurarla.

**Reactivar la cuenta** la deja funcionando de inmediato y el dueño recibe un correo avisándole. Quedan en la [auditoría](12-apartados-generales.md#auditoria) quién la suspendió, cuándo y por qué.

## Correo del dueño

Sirve para cambiar el correo con el que ingresa el dueño (por ejemplo, porque dejó de usar el anterior).

1. Pestaña **Seguridad** → **Correo del dueño** → escribe el **correo nuevo** → **Enviar confirmación**.
2. **No cambia nada todavía.** Al correo nuevo le llega un enlace para confirmarlo (sirve una vez y vence en 3 días) y **al correo actual le llega un aviso** de que se pidió el cambio.
3. Cuando el dueño del correo nuevo abre el enlace, la cuenta pasa a usar ese correo: **se cierran sus sesiones** y se avisa al correo anterior. Ingresa con el correo nuevo y **la misma contraseña**; su segundo factor no cambia.

Por qué es así: si solo se cambiara el correo, una persona podría quedar con una cuenta en una dirección que no es suya, o el dueño real quedar sin saberlo.

- «Ya existe una cuenta con ese correo, o es el mismo del dueño.»: usa otro.
- Si el correo de Ignis no está configurado, aparece el **enlace** para entregarlo por otro medio.
- Si pides otro cambio antes de que se confirme el primero, **solo vale el último**.
