/**
 * RFC 4880 & RFC 9580 OpenPGP Binary Packet Parser
 * Tự phát triển module giải mã nhị phân OpenPGP ở tầng low-level (byte-level).
 * Không phụ thuộc vào blackbox framework, phục vụ nghiên cứu & thẩm định an ninh.
 */

// Bảng ánh xạ mã thuật toán khóa công khai theo RFC 4880
export const PUBLIC_KEY_ALGORITHMS = {
  1: 'RSA (Encrypt or Sign)',
  2: 'RSA Encrypt-Only',
  3: 'RSA Sign-Only',
  16: 'Elgamal (Encrypt-Only)',
  17: 'DSA (Digital Signature Algorithm)',
  18: 'ECDH (Elliptic Curve Diffie-Hellman)',
  19: 'ECDSA (Elliptic Curve Digital Signature)',
  22: 'EdDSA / Ed25519 (RFC 4880bis / RFC 9580)'
};

// Bảng ánh xạ mã hàm băm theo RFC 4880
export const HASH_ALGORITHMS = {
  1: 'MD5 (Deprecated)',
  2: 'SHA-1 (Legacy)',
  3: 'RIPEMD-160',
  8: 'SHA-256',
  9: 'SHA-384',
  10: 'SHA-512',
  11: 'SHA-224'
};

// Bảng ánh xạ thuật toán đối xứng (Symmetric-Key Algorithms)
export const SYMMETRIC_ALGORITHMS = {
  1: 'IDEA',
  2: 'TripleDES (168-bit)',
  3: 'CAST5 (128-bit)',
  4: 'Blowfish (128-bit)',
  7: 'AES-128',
  8: 'AES-192',
  9: 'AES-256',
  10: 'Twofish (256-bit)'
};

// Bảng ánh xạ các loại chữ ký (Signature Types - Tag 2)
export const SIGNATURE_TYPES = {
  0x00: 'Signature of a binary document',
  0x01: 'Signature of a canonical text document (0x01)',
  0x02: 'Standalone signature',
  0x10: 'Generic certification of a User ID and Public-Key',
  0x11: 'Persona certification of a User ID and Public-Key',
  0x12: 'Casual certification of a User ID and Public-Key',
  0x13: 'Positive certification of a User ID and Public-Key (Standard CA Sign)',
  0x18: 'Subkey Binding Signature',
  0x19: 'Primary Key Binding Signature',
  0x1F: 'Signature directly on a key (Revocation / Direct Key)',
  0x20: 'Key Revocation Signature',
  0x28: 'Subkey Revocation Signature',
  0x30: 'Certification Revocation Signature'
};

// Bảng mô tả định danh gói tin (Packet Tags)
export const PACKET_TAGS = {
  1: 'Public-Key Encrypted Session Key (PKESK)',
  2: 'Signature Packet',
  3: 'Symmetric-Key Encrypted Session Key (SKESK)',
  4: 'One-Pass Signature Packet',
  5: 'Secret-Key Packet',
  6: 'Public-Key Packet',
  7: 'Secret-Subkey Packet',
  8: 'Compressed Data Packet',
  9: 'Symmetrically Encrypted Data Packet',
  10: 'Marker Packet',
  11: 'Literal Data Packet',
  12: 'Trust Packet',
  13: 'User ID Packet',
  14: 'Public-Subkey Packet',
  17: 'User Attribute Packet',
  18: 'Sym. Encrypted and Integrity Protected Data (SEIPD)',
  19: 'Modification Detection Code (MDC)'
};

// Bảng Subpacket Types (trong Signature Packet)
export const SUBPACKET_TYPES = {
  2: 'Signature Creation Time',
  3: 'Signature Expiration Time',
  4: 'Exportable Certification',
  5: 'Trust Signature',
  6: 'Regular Expression',
  7: 'Revocable',
  9: 'Key Expiration Time',
  11: 'Preferred Symmetric Algorithms',
  12: 'Revocation Key',
  16: 'Issuer Key ID',
  20: 'Notation Data',
  21: 'Preferred Hash Algorithms',
  22: 'Preferred Compression Algorithms',
  23: 'Key Server Preferences',
  24: 'Preferred Key Server',
  25: 'Primary User ID',
  26: 'Policy URI',
  27: 'Key Flags',
  28: "Signer's User ID",
  29: 'Reason for Revocation',
  30: 'Features',
  31: 'Signature Target',
  32: 'Embedded Signature',
  33: 'Issuer Fingerprint'
};

export class OpenPgpPacketInspector {
  /**
   * Giải mã ASCII Armor thành binary Buffer
   */
  static dearmor(armoredText) {
    if (!armoredText || typeof armoredText !== 'string') {
      throw new Error('Đầu vào phải là chuỗi OpenPGP Armored hợp lệ.');
    }

    const lines = armoredText.split(/\r?\n/);
    let inBody = false;
    let base64Lines = [];
    let armorType = 'UNKNOWN';
    let headers = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('-----BEGIN PGP ') && line.endsWith('-----')) {
        armorType = line.replace('-----BEGIN PGP ', '').replace('-----', '');
        // Đọc headers cho đến khi gặp dòng trống
        let j = i + 1;
        while (j < lines.length && lines[j].trim() !== '') {
          const headerLine = lines[j].trim();
          const colonIdx = headerLine.indexOf(':');
          if (colonIdx !== -1) {
            const hKey = headerLine.substring(0, colonIdx).trim();
            const hVal = headerLine.substring(colonIdx + 1).trim();
            headers[hKey] = hVal;
          }
          j++;
        }
        i = j; // Nhảy qua các header
        inBody = true;
        continue;
      }

      if (line.startsWith('-----END PGP ')) {
        inBody = false;
        break;
      }

      if (inBody) {
        if (line.startsWith('=')) {
          // Bỏ qua dòng Radix-64 CRC Checksum (bắt đầu bằng =)
          continue;
        }
        if (line.length > 0) {
          base64Lines.push(line);
        }
      }
    }

    if (base64Lines.length === 0) {
      // Có thể đầu vào là base64 raw không có armor
      try {
        const buf = Buffer.from(armoredText.trim(), 'base64');
        if (buf.length > 0) return { buffer: buf, armorType: 'RAW_BASE64', headers };
      } catch (e) {
        // ignore
      }
      throw new Error('Không tìm thấy khối dữ liệu PGP hợp lệ trong Armor Header.');
    }

    const base64Str = base64Lines.join('');
    const buffer = Buffer.from(base64Str, 'base64');
    return { buffer, armorType, headers };
  }

  /**
   * Phân tích luồng Buffer thành danh sách các RFC 4880 Packets
   */
  static parsePackets(buffer) {
    let offset = 0;
    const packets = [];
    let packetIndex = 0;

    while (offset < buffer.length) {
      const startOffset = offset;
      const headerByte = buffer[offset++];
      
      // Bit 7 phải là 1 trong mọi gói tin OpenPGP
      if ((headerByte & 0x80) === 0) {
        // Dữ liệu rác hoặc kết thúc luồng
        break;
      }

      const isNewFormat = (headerByte & 0x40) !== 0;
      let tag = 0;
      let packetLength = 0;
      let headerSize = 1;

      if (isNewFormat) {
        // New Packet Format: Tag nằm ở 6 bit thấp (bits 5-0)
        tag = headerByte & 0x3F;
        if (offset >= buffer.length) break;

        const lenByte1 = buffer[offset++];
        headerSize++;
        if (lenByte1 < 192) {
          packetLength = lenByte1;
        } else if (lenByte1 >= 192 && lenByte1 < 224) {
          if (offset >= buffer.length) break;
          const lenByte2 = buffer[offset++];
          headerSize++;
          packetLength = ((lenByte1 - 192) << 8) + lenByte2 + 192;
        } else if (lenByte1 === 255) {
          if (offset + 4 > buffer.length) break;
          packetLength = buffer.readUInt32BE(offset);
          offset += 4;
          headerSize += 4;
        } else {
          // Partial body length (224-254)
          packetLength = 1 << (lenByte1 & 0x1F);
        }
      } else {
        // Old Packet Format: Tag ở bits 5-2, Length type ở bits 1-0
        tag = (headerByte >> 2) & 0x0F;
        const lengthType = headerByte & 0x03;

        if (lengthType === 0) {
          if (offset >= buffer.length) break;
          packetLength = buffer[offset++];
          headerSize += 1;
        } else if (lengthType === 1) {
          if (offset + 2 > buffer.length) break;
          packetLength = buffer.readUInt16BE(offset);
          offset += 2;
          headerSize += 2;
        } else if (lengthType === 2) {
          if (offset + 4 > buffer.length) break;
          packetLength = buffer.readUInt32BE(offset);
          offset += 4;
          headerSize += 4;
        } else {
          // Gói tin kéo dài đến hết buffer
          packetLength = buffer.length - offset;
        }
      }

      const bodyEnd = Math.min(offset + packetLength, buffer.length);
      const packetBody = buffer.subarray(offset, bodyEnd);
      const totalPacketSize = (bodyEnd - startOffset);
      const rawHex = buffer.subarray(startOffset, bodyEnd).toString('hex');

      const parsedDetails = OpenPgpPacketInspector.inspectPacketBody(tag, packetBody);

      packets.push({
        index: packetIndex++,
        tag,
        tagName: PACKET_TAGS[tag] || `Custom/Unknown Packet (Tag ${tag})`,
        format: isNewFormat ? 'RFC 4880 New Format' : 'RFC 1991 Old Format',
        startOffset,
        length: packetLength,
        totalSize: totalPacketSize,
        hexPreview: rawHex.substring(0, 64) + (rawHex.length > 64 ? '...' : ''),
        details: parsedDetails
      });

      offset = bodyEnd;
    }

    return packets;
  }

  /**
   * Bóc tách chi tiết cấu trúc nội tại của từng loại Tag
   */
  static inspectPacketBody(tag, body) {
    try {
      switch (tag) {
        case 2: // Signature Packet
          return OpenPgpPacketInspector.parseSignaturePacket(body);
        case 6: // Public-Key Packet
        case 14: // Public-Subkey Packet
        case 5: // Secret-Key Packet
        case 7: // Secret-Subkey Packet
          return OpenPgpPacketInspector.parseKeyPacket(body);
        case 13: // User ID Packet
          return {
            userId: body.toString('utf-8'),
            length: body.length
          };
        case 4: // One-Pass Signature Packet
          return OpenPgpPacketInspector.parseOnePassSignature(body);
        case 18: // SEIPD
          return {
            version: body.length > 0 ? body[0] : 1,
            encryptedDataLength: body.length - 1,
            description: 'AES/Symmetric Encrypted Data with MDC (Modification Detection Code)'
          };
        case 8: // Compressed Data
          return {
            algorithm: body[0] === 1 ? 'ZIP' : body[0] === 2 ? 'ZLIB' : body[0] === 3 ? 'BZip2' : 'Uncompressed',
            compressedSize: body.length - 1
          };
        default:
          return {
            rawSize: body.length,
            hex: body.subarray(0, 32).toString('hex')
          };
      }
    } catch (err) {
      return {
        parseError: err.message,
        rawSize: body.length
      };
    }
  }

  /**
   * Parse Tag 2: Signature Packet (RFC 4880 Section 5.2)
   */
  static parseSignaturePacket(body) {
    if (body.length < 5) return { rawSize: body.length };
    const version = body[0];
    let offset = 1;

    if (version === 4) {
      const sigType = body[offset++];
      const pubKeyAlgo = body[offset++];
      const hashAlgo = body[offset++];

      // Hashed subpackets
      const hashedSubpacketsLen = body.readUInt16BE(offset);
      offset += 2;
      const hashedSubpacketsRaw = body.subarray(offset, offset + hashedSubpacketsLen);
      offset += hashedSubpacketsLen;
      const hashedSubpackets = OpenPgpPacketInspector.parseSubpackets(hashedSubpacketsRaw);

      // Unhashed subpackets
      const unhashedSubpacketsLen = body.readUInt16BE(offset);
      offset += 2;
      const unhashedSubpacketsRaw = body.subarray(offset, offset + unhashedSubpacketsLen);
      offset += unhashedSubpacketsLen;
      const unhashedSubpackets = OpenPgpPacketInspector.parseSubpackets(unhashedSubpacketsRaw);

      // 2 bytes quick hash verification
      const hashPrefix = body.subarray(offset, offset + 2).toString('hex').toUpperCase();
      offset += 2;

      // MPIs (Mathematical Signature Data)
      const sigData = body.subarray(offset).toString('hex');

      return {
        version: 4,
        signatureType: {
          code: sigType,
          description: SIGNATURE_TYPES[sigType] || `Type 0x${sigType.toString(16).toUpperCase()}`
        },
        publicKeyAlgorithm: {
          code: pubKeyAlgo,
          name: PUBLIC_KEY_ALGORITHMS[pubKeyAlgo] || `Algorithm ${pubKeyAlgo}`
        },
        hashAlgorithm: {
          code: hashAlgo,
          name: HASH_ALGORITHMS[hashAlgo] || `Hash Algo ${hashAlgo}`
        },
        hashPrefixTwoBytes: hashPrefix,
        hashedSubpackets,
        unhashedSubpackets,
        signatureDataLength: body.length - offset,
        signatureDataHexPreview: sigData.substring(0, 48) + '...'
      };
    }

    return { version, rawSize: body.length };
  }

  /**
   * Parse Subpackets trong Signature
   */
  static parseSubpackets(buffer) {
    const subpackets = [];
    let offset = 0;

    while (offset < buffer.length) {
      let len = buffer[offset++];
      if (len >= 192 && len < 255) {
        if (offset >= buffer.length) break;
        len = ((len - 192) << 8) + buffer[offset++] + 192;
      } else if (len === 255) {
        if (offset + 4 > buffer.length) break;
        len = buffer.readUInt32BE(offset);
        offset += 4;
      }

      if (offset >= buffer.length || len === 0) break;
      const subpacketTypeByte = buffer[offset++];
      const isCritical = (subpacketTypeByte & 0x80) !== 0;
      const type = subpacketTypeByte & 0x7F;
      const subDataLen = len - 1;
      const subData = buffer.subarray(offset, offset + subDataLen);
      offset += subDataLen;

      let parsedValue = null;
      if (type === 2) { // Creation Time
        if (subData.length >= 4) {
          const timestamp = subData.readUInt32BE(0);
          parsedValue = new Date(timestamp * 1000).toISOString();
        }
      } else if (type === 16) { // Issuer Key ID
        parsedValue = subData.toString('hex').toUpperCase();
      } else if (type === 33) { // Issuer Fingerprint
        const version = subData[0];
        parsedValue = subData.subarray(1).toString('hex').toUpperCase();
      } else if (type === 27) { // Key Flags
        parsedValue = `0x${subData.toString('hex')}`;
      } else if (type === 21) { // Preferred Hash Algorithms
        parsedValue = Array.from(subData).map(c => HASH_ALGORITHMS[c] || c).join(', ');
      } else if (type === 11) { // Preferred Symmetric Algorithms
        parsedValue = Array.from(subData).map(c => SYMMETRIC_ALGORITHMS[c] || c).join(', ');
      } else {
        parsedValue = subData.toString('hex');
      }

      subpackets.push({
        type,
        typeName: SUBPACKET_TYPES[type] || `Subpacket ${type}`,
        isCritical,
        value: parsedValue
      });
    }

    return subpackets;
  }

  /**
   * Parse Tag 6 / 14: Public Key Packet
   */
  static parseKeyPacket(body) {
    if (body.length < 6) return { rawSize: body.length };
    const version = body[0];
    let offset = 1;

    if (version === 4) {
      const creationTimestamp = body.readUInt32BE(offset);
      offset += 4;
      const algo = body[offset++];

      const result = {
        version: 4,
        createdAt: new Date(creationTimestamp * 1000).toISOString(),
        algorithm: {
          code: algo,
          name: PUBLIC_KEY_ALGORITHMS[algo] || `Algorithm ${algo}`
        }
      };

      if (algo === 1 || algo === 2 || algo === 3) { // RSA
        // MPI Modulus (n)
        const nBits = body.readUInt16BE(offset);
        offset += 2;
        const nBytes = Math.ceil(nBits / 8);
        result.keySize = `${nBits} bits`;
        result.rsaModulusHexPreview = body.subarray(offset, offset + Math.min(nBytes, 16)).toString('hex') + '...';
      } else if (algo === 22) { // EdDSA (Curve25519)
        const oidLen = body[offset++];
        const oid = body.subarray(offset, offset + oidLen).toString('hex');
        offset += oidLen;
        result.curveOid = oid === '2b06010401da470f01' ? 'Curve25519 / Ed25519 (RFC 4880bis)' : oid;
      }

      return result;
    }

    return { version, rawSize: body.length };
  }

  /**
   * Parse Tag 4: One-Pass Signature
   */
  static parseOnePassSignature(body) {
    if (body.length < 13) return { rawSize: body.length };
    return {
      version: body[0],
      signatureType: SIGNATURE_TYPES[body[1]] || body[1],
      hashAlgorithm: HASH_ALGORITHMS[body[2]] || body[2],
      publicKeyAlgorithm: PUBLIC_KEY_ALGORITHMS[body[3]] || body[3],
      issuerKeyID: body.subarray(4, 12).toString('hex').toUpperCase(),
      nestedFlag: body[12] === 1 ? 'Last signature' : 'Nested signature'
    };
  }

  /**
   * Phân tích tổng thể 1 chuỗi OpenPGP Armored Text
   */
  static analyze(armoredText) {
    const { buffer, armorType, headers } = OpenPgpPacketInspector.dearmor(armoredText);
    const packets = OpenPgpPacketInspector.parsePackets(buffer);

    return {
      armorType,
      headers,
      totalBytes: buffer.length,
      packetsCount: packets.length,
      packets
    };
  }
}
