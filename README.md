# Ignis web

La consola de Ignis: el área de los clientes (tenants) y el área del equipo de Ignis (super admin). Quasar + Vue 3 + TypeScript + Pinia, en español.

El backend vive en [ignis-core](https://github.com/jcasmer/ignis-core); esta consola no tiene lógica de negocio propia: todo pasa por su API.

## Empezar

```bash
npm install
npm run dev          # http://localhost:9000, con /api enviado al backend
```

En desarrollo `/api` se reenvía a `http://localhost:8080` (cambia con `IGNIS_API_TARGET`), así el navegador ve un solo origen y la cookie de sesión funciona sin CORS.

En producción define `VITE_API_URL` con el origen de la API (por ejemplo `https://api.ignis.example`) y agrega el origen de la consola a `IGNIS_CORS_ORIGINS` del backend.

## Comandos

| Comando              | Qué hace                         |
| -------------------- | -------------------------------- |
| `npm run dev`        | servidor de desarrollo           |
| `npm run build`      | compila a `dist/spa`             |
| `npm test`           | pruebas (Vitest)                 |
| `npm run typecheck`  | tipos (vue-tsc, modo estricto)   |
| `npm run lint:check` | formato y reglas, sin modificar  |
| `npm run lint`       | formatea y corrige               |
| `npm run audit`      | vulnerabilidades de dependencias |

## Seguridad

- El **token de acceso vive solo en memoria** (store de Pinia): ni `localStorage`, ni `sessionStorage`, ni la URL. Al recargar, la sesión se recupera con la cookie.
- El **token de renovación es una cookie `HttpOnly`, `Secure`, `SameSite=Strict`** que el JavaScript no puede leer. Cada llamada que la usa envía `X-Ignis-CSRF: 1`.
- Un solo ingreso en curso a la vez: el desafío entre la contraseña y el código también vive en memoria.
- El enlace de recuperación se quita de la barra de direcciones apenas se lee.
- El QR del segundo factor se dibuja en el navegador; el secreto no sale a ningún servicio externo.
- Los mensajes de error se muestran en español y nunca el texto crudo del servidor.
- `public/_headers` trae la política de seguridad de contenido (CSP) y demás cabeceras para el hosting estático; ajusta `connect-src` al origen real de la API.
- Rojo solo para errores: la paleta de marca es ámbar.

## Estructura

```
src/api        cliente HTTP y llamadas del ingreso
src/stores     estado (Pinia): la sesión
src/router     rutas y guardas por área (tenant / ops)
src/layouts    AuthLayout (ingreso) y ShellLayout (consola)
src/pages      auth/, tenant/, admin/
src/css        tokens de diseño (ámbar, modo oscuro)
src/i18n       textos en español
test           pruebas del cliente y de la sesión
```

## Áreas

- Clientes: `/login`, `/app`.
- Equipo de Ignis: `/admin/login`, `/admin`.

Las dos áreas no se mezclan: un usuario de un cliente no entra a `/admin` ni al revés.
