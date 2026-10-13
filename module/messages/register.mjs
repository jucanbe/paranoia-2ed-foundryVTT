import {tr} from "../i18n/index.mjs";
import {privateMessageDialog,replyRecipients,actorPlayers,sendPrivateMessage} from "./service.mjs";

const run=promise=>Promise.resolve(promise).catch(error=>ui.notifications.error(error.message));
const replyable=message=>replyRecipients(message).length>0;

/** Private GM ↔ player messages: reply buttons, chat and player-list context menus. */
export function registerMessages(){
  game.paranoia=Object.freeze({...game.paranoia,MessageService:Object.freeze({privateMessageDialog,sendPrivateMessage,actorPlayers})});

  // A visible Reply button on private messages a player sent to the GM, and on GM messages to a player.
  Hooks.on("renderChatMessageHTML",(message,html)=>{
    if(!message.whisper?.length||!replyable(message)||html.querySelector("[data-p2-reply]"))return;
    const fromPlayer=game.user.isGM&&!message.author?.isGM;
    const fromGM=!game.user.isGM&&message.author?.isGM&&message.whisper.includes(game.user.id);
    if(!fromPlayer&&!fromGM)return;
    const button=document.createElement("button");
    button.type="button";button.dataset.p2Reply="";button.className="p2-reply-button";
    button.innerHTML=`<i class="fa-solid fa-reply" inert></i> ${foundry.utils.escapeHTML(tr("Responder en privado"))}`;
    button.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();
      run(privateMessageDialog({recipients:replyRecipients(message),replyTo:message.id,title:tr("Responder en privado")}));});
    (html.querySelector(".message-content")??html).append(button);
  });

  Hooks.on("getChatMessageContextOptions",(_app,options)=>{
    options.push({label:tr("Responder en privado"),icon:"fa-solid fa-reply",
      visible:li=>replyable(game.messages.get(li.dataset.messageId)),
      onClick:(_event,li)=>{const message=game.messages.get(li.dataset.messageId);
        return run(privateMessageDialog({recipients:replyRecipients(message),replyTo:message.id,title:tr("Responder en privado")}));}});
  });

  Hooks.on("getUserContextOptions",(_app,options)=>{
    options.push({label:tr("Mensaje privado"),icon:"fa-solid fa-envelope",
      visible:li=>li.dataset.userId!==game.user.id,
      onClick:(_event,li)=>run(privateMessageDialog({recipients:[li.dataset.userId]}))});
  });
}

/** GM shortcut from a citizen sheet: write to the players who own that Actor. */
export function messageActorPlayers(actor){
  const recipients=actorPlayers(actor).map(user=>user.id);
  return privateMessageDialog({recipients,actor,title:`${tr("Mensaje privado")} · ${actor.name}`});
}
