import {tr} from "../i18n/index.mjs";
// Web Crypto only. Keys stay in GM memory; the passphrase is never stored or sent.
const encode=new TextEncoder(), decode=new TextDecoder();
export function requireSecureContext(){if(!globalThis.crypto?.subtle)throw Error(tr("El registro secreto requiere HTTPS o localhost para usar el cifrado del navegador."));}
const b64=bytes=>{
  const array=new Uint8Array(bytes);let text="";
  for(let i=0;i<array.length;i+=8192)text+=String.fromCharCode(...array.subarray(i,i+8192));
  return btoa(text);
};
const un64=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
async function passwordKey(password,salt) {
  const material=await crypto.subtle.importKey("raw",encode.encode(password),"PBKDF2",false,["deriveKey"]);
  return crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:310000,hash:"SHA-256"},material,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
}
async function seal(key,value) {
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const bytes=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,encode.encode(JSON.stringify(value)));
  return {iv:b64(iv),data:b64(bytes)};
}
async function open(key,box) {
  return JSON.parse(decode.decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:un64(box.iv)},key,un64(box.data))));
}
export async function createVault(password,body) {
  requireSecureContext();

  const salt=crypto.getRandomValues(new Uint8Array(16)), key=await passwordKey(password,salt);
  const pair=await crypto.subtle.generateKey({name:"RSA-OAEP",modulusLength:3072,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["encrypt","decrypt"]);
  body.privateKey=await crypto.subtle.exportKey("jwk",pair.privateKey);
  const header={version:1,salt:b64(salt),publicKey:await crypto.subtle.exportKey("jwk",pair.publicKey)};
  return {key,header,body};
}
export async function unlockVault(password,stored) {
  requireSecureContext();
  if(stored.version!==1)throw Error(tr("Versión del registro desconocida."));
  const key=await passwordKey(password,un64(stored.salt));
  return {key,header:{version:1,salt:stored.salt,publicKey:stored.publicKey},body:await open(key,stored)};
}
export async function encryptVault(state,body=state.body) {return {...state.header,...await seal(state.key,body)};}
export async function encryptReport(publicKey,value) {
  requireSecureContext();
  if(!publicKey)throw Error(tr("El DJ debe preparar primero el registro de traición."));
  const key=await crypto.subtle.generateKey({name:"AES-GCM",length:256},true,["encrypt","decrypt"]);
  const recipient=await crypto.subtle.importKey("jwk",publicKey,{name:"RSA-OAEP",hash:"SHA-256"},false,["encrypt"]);
  const wrapped=await crypto.subtle.encrypt("RSA-OAEP",recipient,await crypto.subtle.exportKey("raw",key));
  return {...await seal(key,value),key:b64(wrapped)};
}
export async function decryptReport(privateKey,box) {
  const recipient=await crypto.subtle.importKey("jwk",privateKey,{name:"RSA-OAEP",hash:"SHA-256"},false,["decrypt"]);
  const raw=await crypto.subtle.decrypt("RSA-OAEP",recipient,un64(box.key));
  return open(await crypto.subtle.importKey("raw",raw,"AES-GCM",false,["decrypt"]),box);
}
