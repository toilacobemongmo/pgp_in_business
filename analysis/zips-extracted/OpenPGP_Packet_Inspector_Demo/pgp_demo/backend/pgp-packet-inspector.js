"use strict";
// Educational structural inspector. Does NOT verify cryptographic signatures.
const fs = require('node:fs');
const MAX = 16 * 1024 * 1024;
class Reader {
  constructor(buf) { this.buf = buf; this.pos = 0; }
  take(n) {
    if (!Number.isSafeInteger(n) || n < 0 || n > this.buf.length - this.pos)
      throw new Error(`TRUNCATED at body offset ${this.pos}: need ${n}`);
    const b = this.buf.subarray(this.pos, this.pos + n); this.pos += n; return b;
  }
  u8() { return this.take(1)[0]; }
  u16() { return this.take(2).readUInt16BE(); }
  u32() { return this.take(4).readUInt32BE(); }
  get left() { return this.buf.length - this.pos; }
}
function crc24(buf) {
  let crc = 0xB704CE;
  for (const b of buf) {
    crc ^= b << 16;
    for (let i = 0; i < 8; i++) {
      crc *= 2;
      if (crc & 0x1000000) crc ^= 0x1864CFB;
    }
  }
  return crc & 0xFFFFFF;
}
function base64(s) {
  if (!s || s.length % 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s))
    throw new Error('INVALID_BASE64');
  const b = Buffer.from(s, 'base64');
  if (b.toString('base64') !== s) throw new Error('NON_CANONICAL_BASE64');
  return b;
}
function decodeInput(input) {
  if (input.length > MAX) throw new Error('INPUT_LIMIT_16_MIB');
  if (!input.subarray(0, 11).equals(Buffer.from('-----BEGIN ')))
    return {data: input, armor: {present: false}};
  const lines = input.toString('ascii').replace(/\r\n/g, '\n').trim().split('\n');
  const m = /^-----BEGIN (PGP (?:MESSAGE|PUBLIC KEY BLOCK|SIGNATURE))-----$/.exec(lines[0]);
  if (!m) throw new Error('UNSUPPORTED_ARMOR_LABEL');
  if (lines.at(-1) !== `-----END ${m[1]}-----`) throw new Error('ARMOR_END_MISMATCH');
  let i = 1;
  while (i < lines.length && lines[i] !== '') {
    if (!/^[^:]+: .*$/.test(lines[i])) throw new Error('BAD_ARMOR_HEADER');
    i++;
  }
  if (i >= lines.length) throw new Error('ARMOR_SEPARATOR_MISSING');
  const payload = lines.slice(i + 1, -1);
  let expected = null;
  if (payload.at(-1)?.startsWith('=')) {
    const c = base64(payload.pop().slice(1));
    if (c.length !== 3) throw new Error('CRC_LENGTH');
    expected = c.readUIntBE(0, 3);
  }
  const data = base64(payload.join(''));
  const actual = crc24(data);
  return {data, armor: {present: true, label: m[1],
    crc: expected === null ? 'absent' : expected === actual ? 'match' : 'mismatch',
    expected, actual}};
}
function newLength(r) {
  const b = r.u8();
  if (b < 192) return {n:b, partial:false};
  if (b < 224) return {n:(b-192)*256+r.u8()+192, partial:false};
  if (b === 255) return {n:r.u32(), partial:false};
  return {n:2 ** (b & 31), partial:true};
}
function packets(buf) {
  const r = new Reader(buf), out = [];
  while (r.left) {
    if (out.length >= 10000) throw new Error('PACKET_COUNT_LIMIT');
    const offset=r.pos, h=r.u8();
    if (!(h & 128)) throw new Error(`INVALID_HEADER at ${offset}`);
    const modern=!!(h & 64), tag=modern ? h & 63 : (h >> 2) & 15;
    const chunks=[]; let partial=false, indeterminate=false, total=0;
    if (modern) {
      let l = newLength(r);
      if (l.partial && (![8,9,11,18].includes(tag) || l.n < 512))
        throw new Error('INVALID_PARTIAL_START');
      partial=l.partial;
      do {
        total += l.n;
        if(total > MAX) throw new Error('PACKET_SIZE_LIMIT');
        chunks.push(r.take(l.n));
        if (!l.partial) break;
        l = newLength(r);
      } while (true);
    } else {
      const type=h & 3;
      const n=type===0?r.u8():type===1?r.u16():type===2?r.u32():r.left;
      indeterminate=type===3; chunks.push(r.take(n)); total=n;
    }
    out.push({offset, tag, format:modern?'new':'old', partial, indeterminate,
      bodyLength:total, endOffset:r.pos, body:chunks.length===1?chunks[0]:Buffer.concat(chunks)});
  }
  return out;
}
function mpi(r) {
  const bits=r.u16(), bytes=r.take(Math.ceil(bits/8));
  // Return encoding metadata; special legacy signature octet strings need separate semantics.
  return {bits, bytes:bytes.length, hex:bytes.toString('hex')};
}
function subpackets(buf, hashed) {
  const r=new Reader(buf), out=[];
  while(r.left) {
    if(out.length>=10000) throw new Error('SUBPACKET_COUNT_LIMIT');
    const b=r.u8();
    // Unlike packet lengths, 224..254 are TWO-OCTET subpacket lengths.
    const n=b<192?b:b<255?(b-192)*256+r.u8()+192:r.u32();
    if(n<1) throw new Error('ZERO_SUBPACKET_LENGTH');
    const s=new Reader(r.take(n)), typeByte=s.u8(), type=typeByte & 127;
    const data=s.take(s.left); let value=data.toString('hex');
    if(type===2) {
      if(data.length!==4) throw new Error('BAD_CREATION_TIME');
      value=new Date(data.readUInt32BE()*1000).toISOString();
    }
    if(type===16 && data.length!==8) throw new Error('BAD_ISSUER_KEY_ID');
    if(type===33 && (!data.length || ![4,6].includes(data[0]) || data.length!==(data[0]===4?21:33)))
      throw new Error('BAD_ISSUER_FINGERPRINT');
    out.push({type, critical:!!(typeByte & 128), hashed, value,
      decoded:[2,16,33].includes(type)});
  }
  return out;
}
const HASH={1:'MD5',2:'SHA-1',8:'SHA-256',9:'SHA-384',10:'SHA-512',11:'SHA-224'};
const ALG={1:'RSA',18:'ECDH',19:'ECDSA',22:'EdDSALegacy',25:'X25519',27:'Ed25519'};
function signature(buf) {
  const r=new Reader(buf), version=r.u8();
  if(version!==4) return {version, supported:false, reason:'Only v4 signature bodies decoded'};
  const signatureType=r.u8(), publicKeyAlgorithm=r.u8(), hashAlgorithm=r.u8();
  const hashed=subpackets(r.take(r.u16()),true);
  const unhashed=subpackets(r.take(r.u16()),false);
  const hashPrefix=r.take(2).toString('hex');
  const count=[1,2,3].includes(publicKeyAlgorithm)?1:[17,19,22].includes(publicKeyAlgorithm)?2:null;
  const mpis=[];
  if(count!==null) for(let i=0;i<count;i++) mpis.push(mpi(r));
  const remainder=r.left;
  if(count!==null && remainder) throw new Error('TRAILING_SIGNATURE_BYTES');
  return {version, supported:count!==null, signatureType, publicKeyAlgorithm,
    algorithm:ALG[publicKeyAlgorithm]||'unknown', hashAlgorithm, hash:HASH[hashAlgorithm]||'unknown',
    hashPrefix, subpackets:[...hashed,...unhashed], mpis, remainder};
}
const OIDS={
  '2b06010401da470f01':'Ed25519Legacy',
  '2b060104019755010501':'Curve25519Legacy'
};
function publicKey(buf) {
  const r=new Reader(buf), version=r.u8();
  if(![4,6].includes(version)) return {version,supported:false};
  const created=r.u32(), algorithm=r.u8();
  if(version===6 && r.u32()!==r.left) throw new Error('KEY_MATERIAL_LENGTH');
  const result={version,created,algorithm,name:ALG[algorithm]||'unknown',supported:true};
  if([18,19,22].includes(algorithm)) {
    const n=r.u8(); if(n===0||n===255) throw new Error('OID_LENGTH');
    result.oid=r.take(n).toString('hex'); result.curve=OIDS[result.oid]||'unrecognized';
    result.point=mpi(r);
    if(algorithm===18) result.kdf=r.take(r.u8()).toString('hex');
    // Curve validity, KDF policy, and version-algorithm compatibility are not audited here.
  } else if([25,27].includes(algorithm)) result.nativePublicKey=r.take(32).toString('hex');
  else if([1,2,3].includes(algorithm)) {result.n=mpi(r);result.e=mpi(r);}
  else {result.supported=false;result.reason='Unknown key algorithm';return result;}
  if(r.left) throw new Error('TRAILING_KEY_BYTES');
  return result;
}
function inspect(input) {
  const {data,armor}=decodeInput(input), findings=[], result=[];
  if(armor.crc==='mismatch') findings.push({level:'warning',code:'CRC_MISMATCH',
    note:'Diagnostic only; RFC 9580 does not permit rejection solely for CRC mismatch'});
  for(const p of packets(data)) {
    const {body,...meta}=p; let details;
    try {
      if(p.tag===2) details=signature(body);
      else if([6,14].includes(p.tag)) details=publicKey(body);
      else if(p.tag===13) details={userId:body.toString('utf8'),supported:true};
      else details={supported:false,reason:'Body not decoded in this demo'};
      if(details.supported===false) findings.push({level:'unsupported',code:'BODY_NOT_FULLY_DECODED',offset:p.offset});
      if(p.tag===2 && [1,2].includes(details.hashAlgorithm))
        findings.push({level:'policy',code:'WEAK_SIGNATURE_HASH',offset:p.offset,hash:details.hash});
      for(const s of details.subpackets||[]) if(s.critical&&!s.decoded)
        findings.push({level:'unsupported',code:'CRITICAL_SUBPACKET_NOT_IMPLEMENTED',type:s.type,offset:p.offset});
    } catch(e) { details={error:e.message}; findings.push({level:'error',code:'MALFORMED_BODY',offset:p.offset,reason:e.message}); }
    result.push({...meta,details});
  }
  return {scope:'Educational structural inspection; no cryptographic verification',
    status:findings.some(x=>['error','policy'].includes(x.level))?'issues_found':'no_error_in_implemented_checks',
    coverage:'partial',armor,packets:result,findings};
}
module.exports={Reader,crc24,decodeInput,packets,mpi,subpackets,signature,publicKey,inspect};
if(require.main===module) {
  try {
    const file=process.argv[2];
    if(!file) throw new Error('Usage: node backend/pgp-packet-inspector.js FILE');
    if(fs.statSync(file).size>MAX) throw new Error('INPUT_LIMIT_16_MIB');
    const report=inspect(fs.readFileSync(file));
    console.log(JSON.stringify(report,null,2));
    if(report.status==='issues_found') process.exitCode=2;
  } catch(e) {console.error(JSON.stringify({error:e.message}));process.exitCode=1;}
}
