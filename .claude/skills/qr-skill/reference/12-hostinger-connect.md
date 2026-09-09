# 12 — Conectar Hostinger (capacidad 🔌)

Esta es la capacidad de **conexión**: dejar la cuenta de Hostinger de la persona
conectada a Claude Code, para que a partir de entonces se pueda gestionar su
hosting (subir/publicar webs, dominios, etc.). Es autónoma: si la persona solo
pide "conéctame Hostinger", haces esto, verificas y **paras** — no encadenas con
crear una web ni nada más.

El conector oficial (`hostinger-api-mcp`) es un servidor **local** (se instala en
el ordenador de cada persona, no es un conector remoto por URL): por eso no se
puede añadir desde un formulario y hay que instalarlo y registrarlo tú. La
persona probablemente nunca ha abierto una terminal: **haces todo por ella**.

> Comunicación: cero jerga (nada de "MCP", "CLI", "stdio", "npm", "variable de
> entorno"). Di "el conector de Hostinger", "preparar tu ordenador", "conectar
> tu cuenta", "comprobar que funciona". Todos los comandos los ejecutas tú; lo
> único que puede tocarle es el clic de login en su navegador.

## Paso A — Preparar el ordenador

1. Detecta el sistema operativo.
2. Comprueba qué hay instalado con el script de diagnóstico (no lo hagas a mano):
   - Windows: `scripts/diagnostico.ps1`
   - macOS / Linux: `scripts/diagnostico.sh`

   Te dice si falta Node.js, si la versión es antigua (el conector necesita
   **Node.js 24 o superior** — no asumas que un Node existente ya sirve) y si el
   paquete `hostinger-api-mcp` ya está instalado.
3. Si falta Node o es viejo, instálalo tú con el primer método que funcione:
   - **nvm** (preferido: instala en la carpeta del usuario, evita problemas de
     permisos):
     ```
     # macOS / Linux:
     curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
     nvm install 24 && nvm use 24
     ```
     En Windows, `nvm-windows` si está disponible, o cae al siguiente método.
   - **Gestor del sistema**: `winget install OpenJS.NodeJS.LTS` (Windows) o
     `brew install node@24` (macOS con Homebrew).
   - **Instalador oficial**: `.msi`/`.pkg` de https://nodejs.org (24 LTS),
     silencioso si el entorno lo permite.
   - En Windows, tras instalar puede hacer falta recargar el PATH o abrir una
     sesión nueva antes de que `node` exista — vuelve a correr el diagnóstico
     para confirmarlo, no lo asumas.
4. Instala el conector: `npm install -g hostinger-api-mcp`. Instala varios
   binarios, uno por área de Hostinger (los usarás en el paso C).

Si nvm, winget/brew y el instalador oficial fallan los tres, es el único punto
donde pides ayuda: en una frase, explícale que su ordenador tiene una
restricción de permisos y dale https://nodejs.org/en/download/ con "descárgalo,
ábrelo y dime cuando termine".

## Paso B — Qué quiere gestionar (una sola pregunta, o inferido)

Si ya te dijo para qué lo quiere ("subir mi web", "gestionar mi VPS"), **infiere
la categoría y no vuelvas a preguntar**. Si no, pregúntalo en un mensaje con
opciones concretas:

- **Sitios web** (subir archivos, desplegar webs/apps, dominios de la web) → `hostinger-hosting-mcp`
- **Dominios y DNS** → `hostinger-domains-mcp` + `hostinger-dns-mcp`
- **VPS** (servidores, firewalls, Docker) → `hostinger-vps-mcp`
- **Tienda / Ecommerce** → `hostinger-ecommerce-mcp`
- **Email marketing** → `hostinger-reach-mcp`
- **Facturación** → `hostinger-billing-mcp`
- **Todo** → `hostinger-api-mcp` (servidor unificado; avisa de que carga muchas
  más herramientas — para casi todo es mejor 1-2 categorías concretas).

> Para **publicar webs** (capacidad 🚀, `reference/13-hostinger-deploy.md`) la
> categoría necesaria es **Sitios web** (`hostinger-hosting-mcp`).

## Paso C — Registrar el conector y conectar la cuenta

Registra cada categoría como servidor MCP con **scope `user`** (disponible en
todos los proyectos, no solo la carpeta actual):

```
claude mcp add --transport stdio hostinger-hosting --scope user -- hostinger-hosting-mcp
```

(sustituye nombre y binario por la categoría; registra varias con nombres
distintos: `hostinger-domains`, `hostinger-vps`, etc.)

**En Windows** los binarios son `.cmd`; si el registro directo no arranca bien,
regístralo lanzándolo con `cmd /c`:

```
claude mcp add --transport stdio hostinger-hosting --scope user -- cmd /c hostinger-hosting-mcp
```

**No pidas ningún token.** Dispara tú el login por navegador (OAuth) justo tras
registrar el primer conector:

```
hostinger-hosting-mcp --login
```

Abre el navegador de la persona. Dile exactamente esto y nada más:
"Se va a abrir tu navegador. 1) Inicia sesión con tu cuenta de Hostinger.
2) Pulsa autorizar. 3) Vuelve aquí y dime 'listo'." Si no se abre solo, copia la
URL que imprime el comando y ábrela tú, o pásasela.

Las credenciales se comparten entre todos los binarios de Hostinger: si
registras varias categorías, **el login se hace una sola vez**.

### Alternativa: token (solo sin navegador disponible)

```
claude mcp add --env HOSTINGER_API_TOKEN=SU_TOKEN --transport stdio hostinger-hosting --scope user -- hostinger-hosting-mcp
```

El token se genera en hPanel (sección de API). No lo ofrezcas como primera
opción; el login por navegador es más simple.

## Paso D — Verificar antes de dar nada por hecho

1. `claude mcp list` → confirma que el/los conectores salen conectados (no error
   ni pendiente).
2. **Haz una llamada real de solo lectura** del conector recién registrado
   (p. ej. listar sus sitios/dominios/VPS) para confirmar que devuelve **datos
   reales**, no solo que el proceso arrancó.
3. Si el paso 2 falla por autorización, repite `--login` antes de tocar nada más
   (es la causa más común).

Solo cuando el paso 2 devuelve datos reales, confirma el éxito y di en una frase
qué puede pedirte ahora ("Ya puedo subir y publicar webs en tu hosting y
gestionar tus dominios — pídemelo cuando quieras"). Si no pudiste verificar, sé
honesto en vez de fingir que funcionó.

## Solución de problemas

- **`claude: command not found`** (raro dentro de Claude Code): usa la ruta
  completa (`where claude` en Windows, `which claude` en Mac/Linux).
- **`npm install -g` con EACCES**: Node se instaló con instalador de sistema;
  reinstala con nvm (paso A) en vez de usar `sudo`.
- **Node sigue viejo tras "actualizar"**: con varias versiones instaladas
  `node -v` puede apuntar a la vieja. Verifica con el diagnóstico, no de memoria.
- **El navegador no abre tras `--login`**: abre tú la URL impresa, o pásasela.
- **Login OK pero la verificación falla**: puede que la cuenta no tenga permisos
  de esa categoría (p. ej. sin VPS contratado). Confírmalo antes de asumir que
  el conector está mal.

## Reglas de oro de la conexión

1. Nunca pidas abrir una terminal ni pegar comandos — única excepción: el clic
   de login en su navegador.
2. Instala tú Node si falta; no mandes enlaces de descarga salvo que los tres
   métodos automáticos del paso A hayan fallado.
3. Prioriza OAuth por navegador sobre el token manual.
4. Nunca des por terminado sin una llamada de prueba real (paso D) que confirme
   datos.
5. `--scope user` al registrar, salvo que la persona pida explícitamente que solo
   funcione en un proyecto concreto.
