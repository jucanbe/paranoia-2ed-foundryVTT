import {readFile,writeFile,mkdir,cp,readdir,rm} from "node:fs/promises";
import {resolve,dirname,join,relative} from "node:path";
import {fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";
const root=resolve(dirname(fileURLToPath(import.meta.url)),".."),dist=join(root,"dist"),stage=join(dist,"paranoia-2-edition");
// Only this known generated directory can be cleaned; installed packs are untouched.
if(relative(dist,stage)!=="paranoia-2-edition")throw Error("Unsafe staging directory");
await mkdir(dist,{recursive:true});await rm(stage,{recursive:true,force:true});await mkdir(stage,{recursive:true});
for(const name of ["system.json","module","templates","styles","lang","assets","README.md","LICENSE","NOTICE","to_github_instructions.md","docs"]){
  try{await cp(join(root,name),join(stage,name),{recursive:true});}catch(error){if(error.code!=="ENOENT")throw error;}
}
execFileSync(process.execPath,[join(root,"scripts/build-packs.mjs")],{env:{...process.env,PACK_OUTPUT:join(stage,"packs")},stdio:"inherit"});
// LevelDB numeric *.log files are database data, not diagnostic output.
async function files(dir){const result=[];for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())result.push(...await files(path));else if(!["LOG","LOG.old","LOCK"].includes(entry.name))result.push(path);}return result.sort();}
const crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const crc32=buffer=>{let crc=0xffffffff;for(const byte of buffer)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;};
const chunks=[],central=[];let offset=0;
for(const path of await files(stage)){
  const name=Buffer.from(`paranoia-2-edition/${relative(stage,path).replaceAll("\\","/")}`),data=await readFile(path),crc=crc32(data);
  const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(33,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(data.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(name.length,26);
  chunks.push(header,name,data);
  const entry=Buffer.alloc(46);entry.writeUInt32LE(0x02014b50);entry.writeUInt16LE(20,4);entry.writeUInt16LE(20,6);entry.writeUInt16LE(0x800,8);entry.writeUInt16LE(33,14);entry.writeUInt32LE(crc,16);entry.writeUInt32LE(data.length,20);entry.writeUInt32LE(data.length,24);entry.writeUInt16LE(name.length,28);entry.writeUInt32LE(offset,42);central.push(entry,name);offset+=header.length+name.length+data.length;
}
const end=Buffer.alloc(22),directory=Buffer.concat(central);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(central.length/2,8);end.writeUInt16LE(central.length/2,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
const manifest=JSON.parse(await readFile(join(stage,"system.json"),"utf8")),zip=join(dist,`${manifest.id}-${manifest.version}.zip`);await writeFile(zip,Buffer.concat([...chunks,directory,end]));console.log(`Distribution: ${zip}`);
