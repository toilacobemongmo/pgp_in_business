'use strict';
const fs=require('node:fs'), path=require('node:path'), os=require('node:os');
const {spawnSync}=require('node:child_process');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const p=require('./backend/pgp-packet-inspector');
fs.mkdirSync('samples',{recursive:true});fs.mkdirSync('results',{recursive:true});
const tests=[];
function test(name,fn){try{fn();tests.push({name,status:'PASS'});}catch(e){tests.push({name,status:'FAIL',error:e.message});}}
const b=Buffer.from;
function u16(n){const a=Buffer.alloc(2);a.writeUInt16BE(n);return a;}
function u32(n){const a=Buffer.alloc(4);a.writeUInt32BE(n);return a;}
function packet(tag,body){return Buffer.concat([b([192|tag,255]),u32(body.length),body]);}
function arm(data,crc=p.crc24(data)) {
 const c=Buffer.alloc(3);c.writeUIntBE(crc,0,3);
 return b('-----BEGIN PGP SIGNATURE-----\n\n'+data.toString('base64')+'\n='+c.toString('base64')+'\n-----END PGP SIGNATURE-----\n');
}
const minimalSig=b([4,0,1,8,0,0,0,0,0,0,0,1,1]); // Structurally valid; NOT a real signature.
test('CRC known vector 123456789',()=>assert.equal(p.crc24(b('123456789')),0x21CF02));
test('New header Tag 2',()=>assert.equal(p.packets(b([0xC2,0]))[0].tag,2));
test('Old header one octet',()=>assert.equal(p.packets(b([0x88,0]))[0].tag,2));
test('Old header two octets',()=>assert.equal(p.packets(b([0x89,0,0]))[0].bodyLength,0));
test('Old header four octets',()=>assert.equal(p.packets(b([0x8A,0,0,0,0]))[0].bodyLength,0));
test('Old indeterminate boundary',()=>assert.equal(p.packets(b([0xAF,1,2,3]))[0].bodyLength,3));
for(const n of [191,192,8383,8384]) test('New length '+n,()=>{
 const len=n<192?b([n]):n<=8383?b([192+((n-192)>>8),(n-192)&255]):Buffer.concat([b([255]),u32(n)]);
 assert.equal(p.packets(Buffer.concat([b([0xCB]),len,Buffer.alloc(n)]))[0].bodyLength,n);
});
test('Partial body 512 plus 3',()=>assert.equal(p.packets(Buffer.concat([b([0xCB,233]),Buffer.alloc(512),b([3,1,2,3])]))[0].bodyLength,515));
test('Reject partial signature packet',()=>assert.throws(()=>p.packets(b([0xC2,233])),/PARTIAL/));
test('Truncated partial final header',()=>assert.throws(()=>p.packets(Buffer.concat([b([0xCB,233]),Buffer.alloc(512)])),/TRUNCATED/));
test('Invalid bit 7',()=>assert.throws(()=>p.packets(b([0,0])),/HEADER/));
test('Truncated body',()=>assert.throws(()=>p.packets(b([0xC2,5,1])),/TRUNCATED/));
test('MPI nine bits',()=>assert.deepEqual(p.mpi(new p.Reader(b([0,9,1,0]))),{bits:9,bytes:2,hex:'0100'}));
test('Truncated MPI',()=>assert.throws(()=>p.mpi(new p.Reader(b([0,9,1]))),/TRUNCATED/));
test('Subpacket length 224 is not partial',()=>{
 const data=Buffer.alloc(8384); data[0]=100;
 assert.equal(p.subpackets(Buffer.concat([b([224,0]),data]),true)[0].type,100);
});
test('Subpacket zero length',()=>assert.throws(()=>p.subpackets(b([0]),true),/ZERO/));
for(const id of [1,2]) test('Block weak signature hash '+id,()=>{
 const s=b(minimalSig);s[3]=id;
 assert.ok(p.inspect(packet(2,s)).findings.some(x=>x.code==='WEAK_SIGNATURE_HASH'));
});
test('Synthetic signature SHA256',()=>assert.equal(p.inspect(packet(2,minimalSig)).status,'no_error_in_implemented_checks'));
test('Unknown critical subpacket',()=>{
 const s=Buffer.concat([minimalSig.subarray(0,4),u16(2),b([1,228]),minimalSig.subarray(6)]);
 assert.ok(p.inspect(packet(2,s)).findings.some(x=>x.code==='CRITICAL_SUBPACKET_NOT_IMPLEMENTED'));
});
test('CRC match',()=>assert.equal(p.inspect(arm(packet(2,minimalSig))).armor.crc,'match'));
test('CRC mismatch diagnostic only',()=>{
 const r=p.inspect(arm(packet(2,minimalSig),0));assert.equal(r.armor.crc,'mismatch');assert.equal(r.status,'no_error_in_implemented_checks');
});
test('CRC absent accepted',()=>{
 const x=arm(packet(2,minimalSig)).toString().replace(/\n=[^\n]+/,'');assert.equal(p.inspect(b(x)).armor.crc,'absent');
});
test('Version 6 signature explicitly unsupported',()=>assert.equal(p.inspect(packet(2,b([6]))).packets[0].details.supported,false));
for(const alg of [25,27])test('Native v6 key algorithm '+alg,()=>{
 const data=Buffer.concat([b([6]),u32(0),b([alg]),u32(32),Buffer.alloc(32,1)]);
 const r=p.inspect(packet(6,data));assert.equal(r.packets[0].details.nativePublicKey.length,64);
});
test('Bad armor Base64',()=>assert.throws(()=>p.decodeInput(b('-----BEGIN PGP SIGNATURE-----\n\n????\n-----END PGP SIGNATURE-----')),/BASE64/));
const home=fs.mkdtempSync(path.join(os.tmpdir(),'pgp-report-'));fs.chmodSync(home,0o700);
function gpg(args){const r=spawnSync('gpg',['--homedir',home,'--batch','--yes',...args],{encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr);return r;}
fs.writeFileSync('samples/message.txt','OpenPGP packet inspector demonstration.\n');
let real={available:false};
try {
 // Node crypto generates a real RSA signature; GnuPG independently verifies it.
 // This avoids gpg-agent, which requires Unix sockets unavailable in some sandboxes.
 function encodeMPI(bytes) {
   let i=0;while(i<bytes.length&&bytes[i]===0)i++;
   bytes=bytes.subarray(i);
   const bits=bytes.length?8*(bytes.length-1)+(32-Math.clz32(bytes[0])):0;
   return Buffer.concat([u16(bits),bytes]);
 }
 const pair=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
 const jwk=pair.publicKey.export({format:'jwk'});
 const created=u32(Math.floor(Date.now()/1000));
 const pub=Buffer.concat([b([4]),created,b([1]),encodeMPI(Buffer.from(jwk.n,'base64url')),encodeMPI(Buffer.from(jwk.e,'base64url'))]);
 const keyPrefix=Buffer.concat([b([0x99]),u16(pub.length),pub]);
 const fingerprint=crypto.createHash('sha1').update(keyPrefix).digest();
 const uid=b('Packet Demo <demo@example.invalid>');
 function makeSig(type,content) {
   const hashed=Buffer.concat([b([5,2]),created,b([22,33,4]),fingerprint]);
   const head=Buffer.concat([b([4,type,1,8]),u16(hashed.length),hashed]);
   const signed=Buffer.concat([content,head,b([4,255]),u32(head.length)]);
   const digest=crypto.createHash('sha256').update(signed).digest();
   const sig=crypto.sign('sha256',signed,pair.privateKey);
   const unhashed=Buffer.concat([b([9,16]),fingerprint.subarray(-8)]);
   return packet(2,Buffer.concat([head,u16(unhashed.length),unhashed,digest.subarray(0,2),encodeMPI(sig)]));
 }
 const cert=makeSig(0x13,Buffer.concat([keyPrefix,b([0xB4]),u32(uid.length),uid]));
 fs.writeFileSync('samples/rsa-public.pgp',Buffer.concat([packet(6,pub),packet(13,uid),cert]));
 const signed=makeSig(0,fs.readFileSync('samples/message.txt'));
 fs.writeFileSync('samples/signature.asc',arm(signed));
 const ecc=[];
 for(const [type,alg,oid] of [['ed25519',22,'2b06010401da470f01'],['x25519',18,'2b060104019755010501']]) {
   const k=crypto.generateKeyPairSync(type).publicKey.export({format:'jwk'});
   const o=Buffer.from(oid,'hex');
   const point=Buffer.concat([b([0x40]),Buffer.from(k.x,'base64url')]);
   const body=Buffer.concat([b([4]),created,b([alg,o.length]),o,encodeMPI(point),alg===18?b([3,1,8,9]):b([])]);
   ecc.push(packet(alg===22?6:14,body));
 }
 fs.writeFileSync('samples/public.asc',b(arm(Buffer.concat(ecc)).toString().replaceAll('PGP SIGNATURE','PGP PUBLIC KEY BLOCK')));
 const sig=p.inspect(fs.readFileSync('samples/signature.asc'));
 const key=p.inspect(fs.readFileSync('samples/public.asc'));
 fs.writeFileSync('results/signature.json',JSON.stringify(sig,null,2));
 fs.writeFileSync('results/public-key.json',JSON.stringify(key,null,2));
 const raw=p.decodeInput(fs.readFileSync('samples/signature.asc')).data;
 const info=p.packets(raw)[0];
 const weak=b(raw);weak[info.endOffset-info.bodyLength+3]=2;
 fs.writeFileSync('samples/signature-sha1-mutated.pgp',weak);
 fs.writeFileSync('results/weak-hash.json',JSON.stringify(p.inspect(weak),null,2));
 const broken=raw.subarray(0,raw.length-5);fs.writeFileSync('samples/truncated.pgp',broken);
 let truncated;try{p.inspect(broken);}catch(e){truncated=e.message;}
 fs.writeFileSync('results/truncated.txt',truncated+'\n');
 const badCrc=arm(raw,(p.crc24(raw)^1));fs.writeFileSync('samples/bad-crc.asc',badCrc);
 fs.writeFileSync('results/bad-crc.json',JSON.stringify(p.inspect(badCrc),null,2));
 const listed=gpg(['--list-packets','samples/signature.asc']);
 fs.writeFileSync('results/gpg-packets.txt',listed.stdout+listed.stderr);
 const verification=gpg(['--no-default-keyring','--keyring',path.resolve('samples/rsa-public.pgp'),'--trust-model','always','--verify','samples/signature.asc','samples/message.txt']);
 fs.writeFileSync('results/gpg-verify.txt',verification.stdout+verification.stderr);
 fs.writeFileSync('samples/message-tampered.txt','OpenPGP packet inspector demonstration!\n');
 const badVerify=spawnSync('gpg',['--homedir',home,'--batch','--no-default-keyring','--keyring',path.resolve('samples/rsa-public.pgp'),'--trust-model','always','--verify','samples/signature.asc','samples/message-tampered.txt'],{encoding:'utf8'});
 fs.writeFileSync('results/gpg-verify-tampered.txt',badVerify.stdout+badVerify.stderr);
 test('GPG rejects modified message',()=>assert.notEqual(badVerify.status,0));
 real={available:true,node:process.version,gpg:gpg(['--version']).stdout.split('\n')[0],signatureHash:sig.packets[0].details.hash,keyTags:key.packets.map(x=>x.tag),curves:key.packets.filter(x=>[6,14].includes(x.tag)).map(x=>x.details.curve),truncated};
 test('Real RSA detached signature parsed and GPG verified',()=>assert.equal(sig.packets[0].details.hash,'SHA-256'));
 test('Node generated ECC keys recognized',()=>assert.deepEqual(real.curves,['Ed25519Legacy','Curve25519Legacy']));
} finally {
 // Test-only key material stays in a temporary isolated keyring and is never packaged.
 spawnSync('gpgconf',['--homedir',home,'--kill','all']);
 fs.rmSync(home,{recursive:true,force:true});
}
const summary={tests:tests.length,passed:tests.filter(x=>x.status==='PASS').length,failed:tests.filter(x=>x.status==='FAIL').length,real,results:tests};
fs.writeFileSync('results/tests.json',JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));if(summary.failed)process.exitCode=1;
