import {tr,trHTML} from "../i18n/index.mjs";

const NS="paranoia-2-edition";
const esc=value=>foundry.utils.escapeHTML(String(value??""));

/** Users who can receive a private message from the current user. */
export function messageableUsers(){
  return game.users.filter(user=>user.id!==game.user.id);
}

/** Non-GM owners of an Actor: the players who control that citizen. */
export function actorPlayers(actor){
  return game.users.filter(user=>!user.isGM&&actor?.testUserPermission(user,"OWNER"));
}

/** Default reply recipients: the author, or every GM when a player answers the GM. */
export function replyRecipients(message){
  const author=message?.author;
  if(!author||author.id===game.user.id)return [];
  if(!game.user.isGM&&author.isGM)return game.users.filter(user=>user.isGM).map(user=>user.id);
  return [author.id];
}

/**
 * Whisper text to the selected users. Every GM also receives it, so co-GMs stay informed.
 * Uses native Foundry whispers: interface privacy, not encryption.
 */
export async function sendPrivateMessage({recipients=[],text="",speakerMode="user",actor=null,replyTo=null}={}){
  const body=String(text??"").trim();
  if(!body)throw Error(tr("Escribe el mensaje."));
  const targets=[...new Set(recipients)].filter(id=>game.users.has(id)&&id!==game.user.id);
  if(!targets.length)throw Error(tr("Selecciona al menos un destinatario."));
  const whisper=[...new Set([...targets,game.user.id,...game.users.filter(user=>user.isGM).map(user=>user.id)])];
  const Message=foundry.utils.getDocumentClass("ChatMessage");
  const speaker=game.user.isGM&&speakerMode==="computer"?{alias:tr("El Ordenador")}
    :game.user.isGM&&speakerMode==="gm"?{alias:game.user.name}
    :actor?Message.getSpeaker({actor}):Message.getSpeaker();
  const names=targets.map(id=>esc(game.users.get(id)?.name)).join(", ");
  const quoted=replyTo?game.messages.get(replyTo):null;
  const quote=quoted?`<blockquote>${esc(quoted.speaker?.alias??quoted.author?.name)}: ${esc(quotedText(quoted))}</blockquote>`:"";
  const content=trHTML`<section class="p2-private-message"><p class="p2-private-message-to">Mensaje privado para: ${names}</p>`
    +quote+`<p>${esc(body).replace(/\n/g,"<br>")}</p></section>`;
  return Message.create({content,speaker,whisper,flags:{[NS]:{privateMessage:{replyTo:replyTo??null}}}});
}

/** Plain-text summary of a message, for the quote in a reply. */
export function quotedText(message){
  const div=document.createElement("div");div.innerHTML=message?.content??"";
  const text=div.textContent.replace(/\s+/g," ").trim();
  return text.length>160?text.slice(0,157)+"…":text;
}

/** Compose dialog. `recipients` are preselected user IDs; the list lets the sender change them. */
export async function privateMessageDialog({recipients=[],actor=null,replyTo=null,title=tr("Mensaje privado")}={}){
  const users=messageableUsers();
  if(!users.length)throw Error(tr("No hay otros usuarios a los que escribir."));
  const quoted=replyTo?game.messages.get(replyTo):null;
  const options=users.map(user=>`<label class="p2-checkbox"><input type="checkbox" name="to" value="${user.id}" ${recipients.includes(user.id)?"checked":""}> ${esc(user.name)}${user.isGM?` (${esc(tr("DJ"))})`:""}${user.active?"":` · ${esc(tr("desconectado"))}`}</label>`).join("");
  const speaker=game.user.isGM?`<label class="p2-treason-field">${esc(tr("Firmar como"))}<select name="speakerMode"><option value="gm">${esc(game.user.name)}</option><option value="computer">${esc(tr("El Ordenador"))}</option>${actor?`<option value="actor">${esc(actor.name)}</option>`:""}</select></label>`:"";
  const content=`<div class="p2-private-message-form">${quoted?`<blockquote>${esc(quotedText(quoted))}</blockquote>`:""}<fieldset><legend>${esc(tr("Destinatarios"))}</legend>${options}</fieldset>${speaker}<label class="p2-treason-field">${esc(tr("Mensaje"))}<textarea name="text" rows="5" autofocus></textarea></label><p class="hint">${esc(tr("Los DJ siempre reciben una copia. Privacidad de mesa: no es cifrado."))}</p></div>`;
  // The dialog stays open on validation errors so the written text is not lost.
  return new Promise(resolve=>{
    let sending=false,sent=null;
    const dialog=new foundry.applications.api.DialogV2({window:{title},position:{width:460},content,form:{closeOnSubmit:false},buttons:[
      {action:"send",label:tr("Enviar"),icon:"fa-solid fa-paper-plane",default:true,callback:async(_event,button,app)=>{
        if(sending)return;sending=true;
        try{
          const form=button.form;
          sent=await sendPrivateMessage({recipients:[...form.querySelectorAll('input[name="to"]:checked')].map(input=>input.value),
            text:form.elements.text.value,speakerMode:form.elements.speakerMode?.value??"user",actor,replyTo});
          await app.close();
        }catch(error){ui.notifications.error(error.message);}
        finally{sending=false;}
      }},
      {action:"cancel",label:tr("Cancelar"),callback:(_event,_button,app)=>app.close()}
    ]});
    dialog.addEventListener("close",()=>resolve(sent),{once:true});
    dialog.render({force:true});
  });
}
