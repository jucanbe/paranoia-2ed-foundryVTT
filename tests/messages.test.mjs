import test from "node:test";
import assert from "node:assert/strict";
import {replyRecipients,actorPlayers,sendPrivateMessage} from "../module/messages/service.mjs";

function setup(currentId){
  const users=[{id:"gm",name:"GM",isGM:true,active:true},{id:"gm2",name:"Co-GM",isGM:true,active:true},
    {id:"p1",name:"Ana",isGM:false,active:true},{id:"p2",name:"Luis",isGM:false,active:false}];
  const created=[];
  const collection=Object.assign([...users],{get:id=>users.find(u=>u.id===id),has:id=>users.some(u=>u.id===id)});
  globalThis.game={user:users.find(u=>u.id===currentId),users:collection,messages:{get:()=>null},i18n:{localize:key=>key}};
  globalThis.foundry={utils:{escapeHTML:value=>String(value).replace(/</g,"&lt;"),getDocumentClass:()=>({getSpeaker:()=>({alias:"speaker"}),create:data=>{created.push(data);return data;}})}};
  return created;
}

test("GM replies go to the player author; player replies go to every GM",()=>{
  setup("gm");
  assert.deepEqual(replyRecipients({author:{id:"p1",isGM:false}}),["p1"]);
  assert.deepEqual(replyRecipients({author:{id:"gm",isGM:true}}),[]);
  setup("p1");
  assert.deepEqual(replyRecipients({author:{id:"gm",isGM:true}}),["gm","gm2"]);
});

test("actor players are non-GM owners only",()=>{
  setup("gm");
  const actor={testUserPermission:(user,level)=>level==="OWNER"&&["gm","p2"].includes(user.id)};
  assert.deepEqual(actorPlayers(actor).map(u=>u.id),["p2"]);
});

test("private messages whisper recipients, sender and all GMs; text is required and escaped",async()=>{
  const created=setup("gm");
  await assert.rejects(sendPrivateMessage({recipients:["p1"],text:"  "}));
  await assert.rejects(sendPrivateMessage({recipients:[],text:"Hola"}));
  await assert.rejects(sendPrivateMessage({recipients:["gm"],text:"Solo a mí"}));
  await sendPrivateMessage({recipients:["p1"],text:"<b>Hola</b>",speakerMode:"computer"});
  const message=created.at(-1);
  assert.deepEqual(new Set(message.whisper),new Set(["p1","gm","gm2"]));
  assert.ok(!message.content.includes("<b>"));
  assert.equal(message.flags["paranoia-2-edition"].privateMessage.replyTo,null);
  const fromPlayer=setup("p1");
  await sendPrivateMessage({recipients:["gm"],text:"Duda"});
  assert.deepEqual(new Set(fromPlayer.at(-1).whisper),new Set(["gm","p1","gm2"]));
});
