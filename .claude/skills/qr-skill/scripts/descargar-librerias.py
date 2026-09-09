#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
descargar-librerias.py — vendoriza las librerías pinneadas de la skill
crear-web-micro-saas dentro del proyecto actual.

Uso (desde la RAÍZ del proyecto web):
    python scripts/descargar-librerias.py --list
    python scripts/descargar-librerias.py generador-qr
    python scripts/descargar-librerias.py conversor-audio video-a-gif

Las versiones/URLs son las de reference/14-library-pinning.md (verificadas
jul-2026). Si una URL falla algún día, la decisión de upgrade se toma en ese
archivo, no aquí. Idempotente: los archivos ya presentes se saltan.
"""
import os
import sys
import urllib.request

# Consolas Windows con cp1252 revientan con caracteres Unicode: forzar UTF-8
# si se puede y usar simbolos ASCII en la salida en cualquier caso.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

CDN = "https://cdn.jsdelivr.net/npm/"
HF = "https://huggingface.co/"

# (url, destino_relativo)
FILES = {
    "qr-code-styling": (CDN + "qr-code-styling@1.9.2/lib/qr-code-styling.js",
                        "lib/vendor/qr-code-styling.js"),
    "jszip":           (CDN + "jszip@3.10.1/dist/jszip.min.js",
                        "lib/vendor/jszip.min.js"),
    "heic-to":         (CDN + "heic-to@1.5.2/dist/iife/heic-to.js",
                        "lib/vendor/heic-to.js"),
    "img-compression": (CDN + "browser-image-compression@2.0.2/dist/browser-image-compression.js",
                        "lib/vendor/browser-image-compression.js"),
    "exifr":           (CDN + "exifr@7.1.3/dist/lite.umd.js",
                        "lib/vendor/exifr-lite.umd.js"),
    "jspdf":           (CDN + "jspdf@4.2.1/dist/jspdf.umd.min.js",
                        "lib/vendor/jspdf.umd.min.js"),
    "jspdf-autotable": (CDN + "jspdf-autotable@5/dist/jspdf.plugin.autotable.min.js",
                        "lib/vendor/jspdf.plugin.autotable.min.js"),
    "pdf-lib":         (CDN + "pdf-lib@1.17.1/dist/pdf-lib.min.js",
                        "lib/vendor/pdf-lib.min.js"),
    "pdfjs":           (CDN + "pdfjs-dist@6.1.200/build/pdf.min.mjs",
                        "lib/vendor/pdfjs/pdf.min.mjs"),
    "pdfjs-worker":    (CDN + "pdfjs-dist@6.1.200/build/pdf.worker.min.mjs",
                        "lib/vendor/pdfjs/pdf.worker.min.mjs"),
    "wavesurfer":      (CDN + "wavesurfer.js@7.12.11/dist/wavesurfer.min.js",
                        "lib/vendor/wavesurfer/wavesurfer.min.js"),
    "wavesurfer-reg":  (CDN + "wavesurfer.js@7.12.11/dist/plugins/regions.min.js",
                        "lib/vendor/wavesurfer/regions.min.js"),
    "lamejs":          (CDN + "@breezystack/lamejs@1.2.7/dist/lamejs.iife.js",
                        "lib/vendor/lamejs.iife.js"),
    "ffmpeg":          (CDN + "@ffmpeg/ffmpeg@0.12.15/dist/umd/ffmpeg.js",
                        "lib/vendor/ffmpeg/ffmpeg.js"),
    "ffmpeg-chunk":    (CDN + "@ffmpeg/ffmpeg@0.12.15/dist/umd/814.ffmpeg.js",
                        "lib/vendor/ffmpeg/814.ffmpeg.js"),
    "ffmpeg-util":     (CDN + "@ffmpeg/util@0.12.2/dist/umd/index.js",
                        "lib/vendor/ffmpeg/util.js"),
    "ffmpeg-core-js":  (CDN + "@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js",
                        "lib/vendor/ffmpeg/ffmpeg-core.js"),
    "ffmpeg-core-wasm":(CDN + "@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.wasm",
                        "lib/vendor/ffmpeg/ffmpeg-core.wasm"),
    "tesseract":       (CDN + "tesseract.js@7.0.0/dist/tesseract.min.js",
                        "lib/vendor/tesseract/tesseract.min.js"),
    "tesseract-worker":(CDN + "tesseract.js@7.0.0/dist/worker.min.js",
                        "lib/vendor/tesseract/worker.min.js"),
    "opencv":          ("https://docs.opencv.org/4.7.0/opencv.js",
                        "lib/vendor/opencv/opencv.js"),
    "jscanify":        (CDN + "jscanify@1.4.3/src/jscanify.min.js",
                        "lib/vendor/jscanify.min.js"),
    "three":           (CDN + "three@0.185.1/build/three.module.min.js",
                        "lib/vendor/three/three.module.min.js"),
    # CRITICO: three.module.min.js hace `import ... from "./three.core.min.js"`.
    # Sin este archivo hermano, la vista 3D revienta en tiempo de ejecucion con
    # un error que NO menciona el archivo que falta (ver reference/14 y 11).
    "three-core":      (CDN + "three@0.185.1/build/three.core.min.js",
                        "lib/vendor/three/three.core.min.js"),
    "three-stl":       (CDN + "three@0.185.1/examples/jsm/exporters/STLExporter.js",
                        "lib/vendor/three/addons/exporters/STLExporter.js"),
    "three-orbit":     (CDN + "three@0.185.1/examples/jsm/controls/OrbitControls.js",
                        "lib/vendor/three/addons/controls/OrbitControls.js"),
    "modnet-config":   (HF + "Xenova/modnet/resolve/main/config.json",
                        "assets/models/Xenova/modnet/config.json"),
    "modnet-preproc":  (HF + "Xenova/modnet/resolve/main/preprocessor_config.json",
                        "assets/models/Xenova/modnet/preprocessor_config.json"),
    "modnet-onnx":     (HF + "Xenova/modnet/resolve/main/onnx/model_fp16.onnx",
                        "assets/models/Xenova/modnet/onnx/model_fp16.onnx"),
}

# arquetipo -> claves de FILES que necesita
ARCHETYPES = {
    # Patrón A/B/D: sin librerías
    "mi-ip": [], "test-velocidad": [], "generador-contrasenas": [],
    "contador-dias": [], "paleta-colores": [], "visor-json": [],
    "conversor-unidades": [], "calculadora-sueldo": [], "calculadora-hipoteca": [],
    # Patrón C
    "generador-qr": ["qr-code-styling", "jszip",
                     "three", "three-core", "three-stl", "three-orbit"],
    "generador-favicons": ["jszip"],
    # Patrón E
    "conversor-imagenes": ["heic-to"],
    "compresor-imagenes": ["img-compression", "jszip"],
    "redimensionador-rrss": [],
    "limpiador-metadatos": ["exifr"],
    "generador-cv": ["jspdf"],
    "generador-facturas": ["jspdf", "jspdf-autotable"],
    "firmar-pdf": ["pdf-lib", "pdfjs", "pdfjs-worker"],
    "herramientas-pdf": ["pdf-lib", "pdfjs", "pdfjs-worker", "jspdf", "jszip"],
    # Patrón F
    "conversor-audio": ["ffmpeg", "ffmpeg-chunk", "ffmpeg-util",
                        "ffmpeg-core-js", "ffmpeg-core-wasm"],
    "video-a-gif": ["ffmpeg", "ffmpeg-chunk", "ffmpeg-util",
                    "ffmpeg-core-js", "ffmpeg-core-wasm"],
    "recortador-mp3": ["wavesurfer", "wavesurfer-reg", "lamejs",
                       "ffmpeg", "ffmpeg-chunk", "ffmpeg-util",
                       "ffmpeg-core-js", "ffmpeg-core-wasm"],
    # Patrón G
    "quitar-fondo": ["modnet-config", "modnet-preproc", "modnet-onnx"],
    "ocr-imagenes": ["tesseract", "tesseract-worker"],
    "escaner-documentos": ["opencv", "jscanify", "jspdf"],
}


def human(n):
    for unit in ("B", "KB", "MB"):
        if n < 1024:
            return "%.0f %s" % (n, unit)
        n /= 1024.0
    return "%.1f GB" % n


def download(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        print("  = ya existe  %s" % dest)
        return
    os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
    print("  [descargando] %s" % url)
    req = urllib.request.Request(url, headers={"User-Agent": "crear-web-micro-saas/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r, open(dest + ".part", "wb") as f:
        total = 0
        while True:
            chunk = r.read(1 << 16)
            if not chunk:
                break
            f.write(chunk)
            total += len(chunk)
    os.replace(dest + ".part", dest)
    print("  [OK] %s (%s)" % (dest, human(total)))


def main(argv):
    args = [a for a in argv if not a.startswith("-")]
    if "--list" in argv or not args:
        print("Arquetipos y archivos que vendorizan:\n")
        for name, keys in sorted(ARCHETYPES.items()):
            print("  %-24s %s" % (name, ", ".join(keys) if keys else "(sin librerías)"))
        return 0
    keys, unknown = [], []
    for a in args:
        if a in ARCHETYPES:
            keys.extend(ARCHETYPES[a])
        else:
            unknown.append(a)
    if unknown:
        print("Arquetipo(s) desconocido(s): %s\nUsa --list para verlos." % ", ".join(unknown))
        return 1
    if not keys:
        print("Esos arquetipos no necesitan librerias. Nada que descargar. [OK]")
        return 0
    seen = []
    for k in keys:
        if k not in seen:
            seen.append(k)
    print("Vendorizando %d archivo(s) en %s\n" % (len(seen), os.getcwd()))
    failures = 0
    for k in seen:
        url, dest = FILES[k]
        try:
            download(url, dest)
        except Exception as e:
            failures += 1
            print("  [FALLO] %s -> %s (%s)" % (k, dest, e))
    if failures:
        print("\n%d descarga(s) fallaron. Revisa la conexión o reference/14-library-pinning.md." % failures)
        return 2
    print("\nTodo vendorizado. [OK]")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
