# 13 — Publish a static site to Hostinger (capacidad 🚀)

This is the capability that **puts a finished static site live on Hostinger**,
using the Hostinger connection (capability 🔌). It's the natural bridge between
"build a website" and "connect Hostinger" — but it's still **independent**: run
it only when the user asks to publish/upload, and stop when done.

**Prerequisite:** the **Sitios web** connector (`hostinger-hosting`) must be
connected (`reference/12-hostinger-connect.md`). If it isn't, say so in one line
and offer to connect it first — but don't connect silently or force it if they
only wanted, say, a local build.

Once connected, the hosting connector exposes these tools (use them directly —
they're the clean path; no hand-rolled HTTP needed):

| Tool | Use |
|---|---|
| `hosting_listWebsitesV1` | List the account's sites; also where you read the plan's **`order_id`** |
| `hosting_generateAFreeSubdomainV1` | Get a free temporary `*.hostingersite.com` domain (no args) |
| `hosting_createWebsiteV1` | Create a website for a domain (`{domain, order_id}`) |
| `hosting_deployStaticWebsite` | Upload a zip and deploy it (`{domain, archivePath}`) |

---

## Two flows

### A. Temporary domain (demos, previews, "muéstramela en una web")

1. `hosting_generateAFreeSubdomainV1` → returns e.g. `seagreen-meerkat-880260.hostingersite.com`.
2. Get the plan's **`order_id`**: call `hosting_listWebsitesV1` and read
   `order_id` from any existing site (all addon sites on the same plan share it).
   If the account has no sites yet, use `hosting_listOrdersV1`.
3. `hosting_createWebsiteV1` with `{domain, order_id}` → `"Request accepted"`.
   **This is asynchronous** — see the gotcha below before deploying.
4. Package + `hosting_deployStaticWebsite` (below).
5. Verify live (below).

### B. The user's own domain

The website usually already exists on the account (they bought the domain /
hosting). Confirm with `hosting_listWebsitesV1`; if the domain is there, skip
straight to packaging + deploy. If it isn't, create it
(`hosting_createWebsiteV1`) or point them to Hostinger's domain setup first.

---

## Packaging the site (get this exactly right)

`hosting_deployStaticWebsite` uploads a **zip archive** and extracts it into the
site's web root. So:

- **Zip the folder's CONTENTS, not the folder** — `index.html` must sit at the
  **root** of the archive (not inside a subfolder). On PowerShell:
  `Compress-Archive -Path "C:\...\mysite\*" -DestinationPath site.zip`.
- **Include `.htaccess`** (it controls cache correctness — invariant #2).
  `Compress-Archive` with `folder\*` does include dotfiles on Windows; verify the
  archive lists `.htaccess`.
- **Exclude working/secret files.** If AI images were used, the OpenAI key and
  working photos live in the sibling `{project}-ia/` folder — those are already
  outside the site folder, good. Also exclude the heavy originals:
  `assets/photos/source/` doesn't need to go live. Stage a copy without it (e.g.
  `robocopy mysite staging /E /XD "mysite\assets\photos"`) and zip the staging
  folder's contents.
- Keep only what the site serves: `index.html` (+ other pages), `styles.css`,
  `main.js`, `lib/`, `assets/img/*.webp`, `.htaccess`, `creditos.html` if
  present.

Then:

```
hosting_deployStaticWebsite  { "domain": "<domain>", "archivePath": "<abs path to .zip>" }
```

**Windows path gotcha:** pass `archivePath` with **forward slashes**
(`C:/Users/.../site.zip`) to avoid backslash-escaping issues. A successful call
returns `upload: success` + `deploy: success` (`"Request accepted"`).

---

## The async-creation gotcha (the one that bites)

`hosting_createWebsiteV1` returns `"Request accepted"` immediately, but the
website is **provisioned a few seconds later**. If you call
`hosting_deployStaticWebsite` right away you get:

> `No website found for domain: <domain>`

Fix: after creating, **wait ~10-15 s and confirm the domain now appears in
`hosting_listWebsitesV1`** before deploying — or simply retry the deploy once
after a short wait. Not a real error; just provisioning lag.

---

## Verify live before telling the user it's done (invariant #12)

After deploy (allow a few seconds for extraction), fetch the URL and check:

- `GET https://<domain>/` → **200**, and the page contains your expected
  headline/section markers.
- `styles.css?v=…` and `main.js?v=…` → **200** (so the design and behavior load).
- Responsive rules present in the served CSS (`@media`, viewport meta in HTML).
- If the hero uses AI-generated imagery: apply the **banner contract**
  verification (`reference/11-ai-image-generation.md` §7 clause 5) — hero whole
  at 16:9 **and** mobile.

Only then give the user the link. Be honest if something didn't verify.

---

## Redeploying to the same domain

Static files are cached. On every redeploy that changed CSS/JS, **bump the
`?v=YYYYMMDD` cache-buster** in the HTML (invariant #2) so the browser fetches
fresh — the `.htaccess` handles the rest (`reference/10-deployment-and-cache.md`).
Then re-zip and `hosting_deployStaticWebsite` again (the website already exists,
so no create step).

---

## If the connector isn't available (fallback)

If Hostinger isn't connected and the user doesn't want to connect right now, the
site is still a plain folder they can publish by hand:

> "Tu web está lista en la carpeta. Para subirla sin conectar nada: entra en
> hPanel → Administrador de archivos → carpeta `public_html` de tu dominio, y
> arrastra ahí todos los archivos de la carpeta. Si prefieres, te conecto la
> cuenta y la publico yo en un clic."

Don't push. The build capability's deliverable (the folder) is complete on its
own; publishing is a separate, optional capability.

---

## Talking to the user

Non-technical, no jargon. Announce before something visible happens ("voy a
publicarla, tarda unos segundos"), celebrate the milestone with the live link
("✅ Tu web ya está online: <URL>"), and — per the skill's golden rule — **don't
automatically jump to the next thing**. Offer the natural next step in one
optional sentence at most ("¿quieres que le ponga imágenes a medida, o la dejo
así?").
