import test from 'node:test';
import assert from 'node:assert/strict';
import {canEditPortrait,editPortrait} from '../module/sheets/portrait.mjs';
test('portrait respects core update permission, locked packs, and revocation while picker is open',async()=>{
 const gm={id:'gm'},owner={id:'owner'},observer={id:'observer'},stranger={id:'stranger'};let allowed=true,options,updates=[];
 const actor={img:'old.webp',canUserModify:user=>allowed&&[gm,owner].includes(user),update:async data=>updates.push(data)};
 globalThis.game={user:owner,packs:new Map([['locked',{locked:true}]])};
 globalThis.foundry={applications:{apps:{FilePicker:{implementation:class{constructor(o){options=o;}async browse(){}}}}}};
 globalThis.ui={notifications:{error:message=>assert.fail(message)}};
 assert.equal(canEditPortrait(actor,gm),true);assert.equal(canEditPortrait(actor,owner),true);assert.equal(canEditPortrait(actor,observer),false);assert.equal(canEditPortrait(actor,stranger),false);
 assert.equal(canEditPortrait({...actor,pack:'locked'},gm),false);
 await editPortrait.call({actor,position:{top:0,left:0}},null,{});assert.equal(options.type,'image');assert.equal(options.document,actor);await options.callback('new.webp');assert.deepEqual(updates,[{img:'new.webp'}]);
 allowed=false;await options.callback('unauthorized.webp');assert.equal(updates.length,1);
 delete globalThis.game;delete globalThis.foundry;delete globalThis.ui;
});
