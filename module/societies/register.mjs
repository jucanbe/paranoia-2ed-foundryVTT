import * as service from "./service.mjs";
import {SOCIETY_REGISTRY} from "./registry.mjs";
export function registerSocieties(){
  game.settings.register("paranoia-2-edition","customSocieties",{scope:"world",config:false,type:Object,default:{}});
  game.paranoia=Object.freeze({...game.paranoia,SecretSocietyService:Object.freeze({...service,registry:SOCIETY_REGISTRY})});
}
