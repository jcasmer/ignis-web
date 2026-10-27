# 1. Crear un cliente

## Para qué sirve

Cada negocio que usa Ignis es un **cliente** (en el código, un _tenant_). Al crearlo se prepara un espacio aislado con su dueño, sus módulos contratados y su propio plan. Todo lo demás (canales, conocimiento, automatizaciones) se configura después, pestaña por pestaña.

## La lista de clientes

![Lista de clientes](../imagenes/admin-02-clientes.jpg)

- **Buscar por nombre o identificador:** filtra la lista mientras escribes.
- Cada fila muestra el nombre, el identificador (`demo-local`), cuántos **módulos** tiene, su perfil de IA (**Económico** o **Calidad**), la fecha de alta y su estado (**Activo** o **Suspendido**).
- Al pulsar una fila entras a las pestañas del cliente.
- **Ver más clientes** carga más cuando hay muchos.

## Tutorial: dar de alta a «Café Luna»

1. En **Clientes**, pulsa **Nuevo cliente**.

   ![Formulario de nuevo cliente](../imagenes/admin-03-nuevo-cliente.jpg)

2. Llena el formulario:

   | Campo                                                | Qué poner                                                                                                                                                                                                                 | Ejemplo             |
   | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
   | **Nombre del negocio**                               | El nombre comercial, como lo verán en el panel.                                                                                                                                                                           | `Café Luna`         |
   | **Identificador**                                    | Una palabra corta en minúsculas, números y guiones. **No se puede cambiar después.** Debe ser único.                                                                                                                      | `cafe-luna`         |
   | **Correo del dueño**                                 | Con este correo entrará el dueño. Debe ser único en toda la plataforma.                                                                                                                                                   | `dueno@cafeluna.co` |
   | **Enviar al dueño un correo para activar su cuenta** | Encendido (lo recomendado): el dueño recibe un enlace y **él elige su contraseña**; tú nunca la ves. Apagado: aparece **Contraseña inicial** (mínimo 12 caracteres; **Generar** y **Copiar** ayudan) y se la entregas tú. | Encendido           |
   | **Exigir el segundo factor desde el primer ingreso** | Solo con la invitación. Encendido, el dueño tendrá que configurar su app de autenticación al ingresar por primera vez.                                                                                                    | Encendido           |
   | **Plan** y **Módulos contratados**                   | El plan define módulos, límites y crédito de IA (ver [Planes](12-apartados-generales.md#planes)). Sin plan, eliges los módulos a mano.                                                                                    | Con IA              |

3. Pulsa **Nuevo cliente** (el botón del final).
   - **Con invitación:** verás «Cliente creado. Enviamos el correo de activación a …». El dueño recibe **«Activa tu cuenta de Ignis»** con un botón. El enlace **sirve una sola vez y vence en 3 días**.
   - **Si el correo no pudo salir** (el correo de Ignis no está configurado o el proveedor falló), el cliente **sí queda creado** y aparece una ventana con el **enlace de activación** para que lo copies y se lo entregues por otro medio.
4. **Qué hace el dueño:** abre el enlace → elige su contraseña (**Activa tu cuenta**) → ingresa → configura su **segundo factor** con una app de autenticación (si lo exigiste) y guarda sus códigos de recuperación. Recibe además un aviso de que su contraseña cambió.
5. **Si el dueño perdió el correo o el enlace venció:** abre la ficha del cliente → pestaña [Seguridad](03-pestana-seguridad.md) → **Reenviar el correo de activación**. Los enlaces anteriores siguen sirviendo hasta que venzan.

### Errores frecuentes

- «Ya existe un cliente con ese identificador o ese correo.»: cambia el identificador o usa otro correo.
- «Revisa los datos: la contraseña necesita 12 caracteres o más.»: solo si apagaste la invitación y escribiste la contraseña a mano.
- «Sin correo configurado no se puede invitar»: la API no tiene un proveedor de correo; define la contraseña inicial o configura el correo ([Correos de Ignis](15-correos-de-ignis.md)).
- «El identificador no es válido.»: usa solo minúsculas, números y guiones.

## Después de crear el cliente

Entra a su ficha y recorre las pestañas en este orden recomendado:

1. [Plan](02-pestana-plan.md): confirma módulos y límites, y el modelo de IA.
2. [Créditos](04-pestana-creditos.md): acredita saldo (compra o cortesía) para que el asistente pueda responder.
3. [Correo](05-pestana-correo.md): a quién avisar por correo.
4. [Asistente](06-pestana-asistente.md): cómo se presenta (o que lo llene el dueño).
5. [Conocimiento](09-pestana-conocimiento.md): sube sus documentos.
6. [Conectar WhatsApp](13-conectar-whatsapp.md) (el dueño lo hace en **Canales**) y luego [Plantillas WhatsApp](07-pestana-plantillas-whatsapp.md).
7. [Conectores](08-pestana-conectores.md) y [Automatizaciones](10-pestana-automatizaciones.md) si los necesita.
8. [Privacidad](11-pestana-privacidad.md): revisa el aviso que verán sus contactos.

## La ficha de un cliente

![Pestañas de un cliente](../imagenes/admin-04-plan-modulos.jpg)

Arriba ves el nombre, el identificador y el estado. Debajo, las pestañas: **Plan, Seguridad, Créditos, Correo, Asistente, Plantillas WhatsApp, Conectores, Conocimiento (RAG), Automatizaciones, Privacidad**. Cada una tiene su manual; usa la flecha **← Clientes** para volver a la lista.
