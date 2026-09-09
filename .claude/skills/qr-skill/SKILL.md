---
name: crear-web-micro-saas-cloudflare
description: Crea y publica sitios web de herramientas Micro-SaaS estáticos en Cloudflare Pages mediante tres capacidades INDEPENDIENTES: (a) CONNECT cuenta Cloudflare/Wrangler, (b) BUILD sitio web 100% client-side (HTML/CSS/JS vainilla, catálogo de 25 arquetipos), (c) PUBLISH la web en vivo a Cloudflare Pages (*.pages.dev).
---

# Micro-SaaS Studio (Cloudflare Pages Edition) · Skill Definition

### Visión General
Este skill adapta la arquitectura de Micro-SaaS Studio para utilizar **Cloudflare Pages** como infraestructura de alojamiento estático. Mantiene la separación estricta de capacidades independientes, el principio 100% client-side y las reglas de diseño y SEO sin backend ni base de datos.

---

### Capacidades Principales

#### 1. 🔌 Connect (Cloudflare / Wrangler)
- **Propósito:** Autenticar la CLI de Wrangler (`npx wrangler`) con la cuenta de Cloudflare del usuario.
- **Flujo:**
  1. Verificar entorno (Node.js 18+, `npx`).
  2. Ejecutar `npx wrangler login` para abrir la autenticación en el navegador del usuario.
  3. Verificar el acceso mediante llamada de lectura limpia (`npx wrangler whoami`).
- **Independencia:** Si el usuario solo pide conectar, verificar la autenticación y detenerse.

#### 2. 🧰 Build (Herramientas Client-Side)
- **Propósito:** Construir la herramienta web en local a partir del catálogo de 25 arquetipos o patrones personalizados.
- **Reglas del Stack:**
  - 100% Client-Side (HTML5, CSS3, JS Vainilla en IIFE).
  - Cero dependencias de servidor, cero claves API de pago.
  - Gestión de cabeceras estáticas mediante archivo `_headers` en la raíz (sustituye al archivo `.htaccess` de Apache).
  - Previsión local obligatoria con servidor HTTP (`python -m http.server`).
  - Carga diferida (*lazy loading*) de motores pesados (WASM, OCR, IA local).
- **Independencia:** Al terminar la construcción, solicitar confirmación antes de publicar.

#### 3. 🚀 Publish (Despliegue en Cloudflare Pages)
- **Propósito:** Publicar la web construida en vivo en Cloudflare Pages.
- **Flujo de Despliegue:**
  1. Verificar que Wrangler esté autenticado.
  2. Desplegar mediante el comando:
     `npx wrangler pages deploy ./proyecto --project-name <nombre-proyecto>`
  3. Obtener la URL en vivo resultante (`https://<nombre-proyecto>.pages.dev`).
  4. **Verificación activa:** Probar la URL en vivo ejecutando una prueba de uso de la herramienta.

---

### Invariantes Obligatorias

1. **REGLA DE ORO: No encadenar capacidades no solicitadas.** No ejecutar Build ni Publish si solo se pidió Connect; no publicar automáticamente si solo se pidió Build.
2. **100% Client-Side:** Los archivos del usuario nunca salen de su navegador. Privacidad como propuesta de valor principal.
3. **Herramienta Above the Fold:** La utilidad principal debe ser usable en menos de 3 segundos sin hacer scroll. SEO y contenido extenso debajo de la herramienta.
4. **Configuración de Cloudflare Pages (`_headers`):**
   ```headers
   /*
     X-Frame-Options: DENY
     X-Content-Type-Options: nosniff
     Referrer-Policy: strict-origin-when-cross-origin
   ```
5. **Comunicación sin jerga técnica:** Explicar el estado de las operaciones de manera clara y accesible para usuarios no técnicos.

---

### Tabla de Enrutamiento de Solicitudes

| Solicitud del usuario | Capacidad a activar | Comando / Acción principal |
| :--- | :--- | :--- |
| "Conecta mi cuenta de Cloudflare", "Inicia sesión en Wrangler" | 🔌 **Connect** | `npx wrangler login` + `npx wrangler whoami` |
| "Hazme un generador de QR", "Crea un conversor de imágenes" | 🧰 **Build** | Selección de arquetipo + descarga de librerías + HTML/CSS/JS local |
| "Publícala en Cloudflare", "Súbela a Pages" | 🚀 **Publish** | `npx wrangler pages deploy` |
| "Cámbiale el color", "Añade un botón de descarga" | ✏️ **Surgical Edit** | Edición directa de código fuente local |