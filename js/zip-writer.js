/**
 * zip-writer.js — Escritor ZIP mínimo (método STORE, sin compresión).
 *
 * Un .3mf es, por especificación, un paquete OPC = un .zip. No hace falta
 * comprimir (STORE es un método válido del estándar ZIP) para que cualquier
 * lector de 3MF/OPC lo abra correctamente, así que se evita depender de una
 * librería de compresión externa: menos superficie de dependencias, mismo
 * resultado válido.
 */
(function (global) {
  'use strict';

  let crcTable = null;
  function crc32(bytes) {
    if (!crcTable) {
      crcTable = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        crcTable[n] = c >>> 0;
      }
    }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
      crc = crcTable[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function dosDateTime() {
    // Fecha/hora fija y válida (no afecta a la lectura del archivo por el slicer).
    return { time: 0, date: 0x21 }; // 1980-01-01
  }

  function strToBytes(s) {
    return new TextEncoder().encode(s);
  }

  /**
   * @param {Array<{name:string, data:Uint8Array|string}>} files
   * @returns {Blob}
   */
  function createZip(files) {
    const chunks = [];
    const centralRecords = [];
    let offset = 0;
    const { time, date } = dosDateTime();

    for (const file of files) {
      const nameBytes = strToBytes(file.name);
      const data = typeof file.data === 'string' ? strToBytes(file.data) : file.data;
      const crc = crc32(data);
      const localHeaderOffset = offset;

      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);       // versión mínima
      local.setUint16(6, 0, true);        // flags
      local.setUint16(8, 0, true);        // método: 0 = STORE
      local.setUint16(10, time, true);
      local.setUint16(12, date, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, data.length, true); // comprimido = sin comprimir
      local.setUint32(22, data.length, true);
      local.setUint16(26, nameBytes.length, true);
      local.setUint16(28, 0, true);       // extra field length

      chunks.push(new Uint8Array(local.buffer), nameBytes, data);
      offset += 30 + nameBytes.length + data.length;

      centralRecords.push({ nameBytes, crc, size: data.length, localHeaderOffset });
    }

    const centralStart = offset;
    for (const rec of centralRecords) {
      const central = new DataView(new ArrayBuffer(46));
      central.setUint32(0, 0x02014b50, true);
      central.setUint16(4, 20, true);   // versión que lo creó
      central.setUint16(6, 20, true);   // versión mínima
      central.setUint16(8, 0, true);
      central.setUint16(10, 0, true);   // método STORE
      central.setUint16(12, time, true);
      central.setUint16(14, date, true);
      central.setUint32(16, rec.crc, true);
      central.setUint32(20, rec.size, true);
      central.setUint32(24, rec.size, true);
      central.setUint16(28, rec.nameBytes.length, true);
      central.setUint16(30, 0, true);   // extra
      central.setUint16(32, 0, true);   // comentario
      central.setUint16(34, 0, true);   // disco inicial
      central.setUint16(36, 0, true);   // atributos internos
      central.setUint32(38, 0, true);   // atributos externos
      central.setUint32(42, rec.localHeaderOffset, true);
      chunks.push(new Uint8Array(central.buffer), rec.nameBytes);
      offset += 46 + rec.nameBytes.length;
    }
    const centralSize = offset - centralStart;

    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(4, 0, true);
    end.setUint16(6, 0, true);
    end.setUint16(8, centralRecords.length, true);
    end.setUint16(10, centralRecords.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, centralStart, true);
    end.setUint16(20, 0, true);
    chunks.push(new Uint8Array(end.buffer));

    return new Blob(chunks, { type: 'application/zip' });
  }

  global.MiniZip = { createZip, crc32 };
})(window);
