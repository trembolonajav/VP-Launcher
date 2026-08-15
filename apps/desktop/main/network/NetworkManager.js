import { DirectProvider,SystemProvider,ProxyProvider,ProtonProvider } from "./providers.js";
import { PreflightService } from "./PreflightService.js";

export class NetworkManager {
  constructor({repository,events,preflight=new PreflightService(),publish=()=>{},credentialResolver=async()=>null}) {
    this.repository=repository;this.events=events;this.preflight=preflight;this.publish=publish;this.credentialResolver=credentialResolver;
    this.active=new Map();this.operations=new Map();this.controllers=new Map();
  }
  resolve(profile) {
    if(!profile||profile.enabled===false)throw new Error("Network profile unavailable");
    if(profile.type==="DIRECT")return new DirectProvider();if(profile.type==="SYSTEM")return new SystemProvider();
    if(profile.type==="PROXY")return new ProxyProvider(profile);if(profile.type==="PROTON")return new ProtonProvider(profile);
    throw new Error(`Unknown network provider: ${profile.type}`);
  }
  profile(id){return this.repository.list().find(item=>item.id===id);}
  status(accountId){const value=this.active.get(accountId);if(!value)return null;const{providerInstance,ses,...safe}=value;return safe;}
  cancel(accountId){this.controllers.get(accountId)?.abort();}
  async prepare({accountId,profileId,ses,sessionRunId}) {
    this.cancel(accountId);const controller=new AbortController();this.controllers.set(accountId,controller);
    const prior=this.operations.get(accountId)||Promise.resolve();
    const work=prior.catch(()=>{}).then(async()=>{
      const profile=this.profile(profileId);this.events.add({accountId,sessionRunId,type:"NETWORK_CHECK_STARTED",payload:{profileId}});
      try {
        const provider=this.resolve(profile);
        if(profile.credentialId){const credential=await this.credentialResolver(profile.credentialId);if(credential?.state!=="READY")throw new Error("Proxy credentials unavailable in Vault");throw new Error("Authenticated proxy preflight is not supported safely by this adapter");}
        if(controller.signal.aborted)return{profileId,result:{status:"UNKNOWN",cancelled:true,error:"cancelled"}};
        const applied=await provider.apply(ses),result=await this.preflight.check(ses,profile.config||{},controller.signal);
        if(controller.signal.aborted||result.cancelled)return{profileId,result:{status:"UNKNOWN",cancelled:true,error:"cancelled"}};
        const state={profileId,profileName:profile.name,provider:provider.type,protected:["PROXY","PROTON"].includes(provider.type),reconnectSupported:provider.reconnectSupported,applied,result};
        this.active.set(accountId,{...state,providerInstance:provider,ses});
        const type=result.status==="OK"?"NETWORK_READY":result.status==="MISMATCH"?"NETWORK_MISMATCH":"NETWORK_FAILED";
        this.events.add({accountId,sessionRunId,type,severity:result.status==="OK"?"INFO":"ERROR",payload:state});this.publish(accountId,{network:state});return state;
      } catch(error) {
        const state={profileId,profileName:profile?.name||profileId,provider:profile?.type||null,protected:["PROXY","PROTON"].includes(profile?.type),reconnectSupported:false,result:{status:"CONFIG_ERROR",error:error.message,checkedAt:new Date().toISOString()}};
        this.events.add({accountId,sessionRunId,type:"NETWORK_FAILED",severity:"ERROR",payload:state});this.publish(accountId,{network:state});return state;
      }
    });
    this.operations.set(accountId,work);try{return await work;}finally{if(this.operations.get(accountId)===work)this.operations.delete(accountId);if(this.controllers.get(accountId)===controller)this.controllers.delete(accountId);}
  }
  async reconnect(accountId){const current=this.active.get(accountId);if(!current?.providerInstance?.reconnectSupported)return{ok:false,error:"Reconnect unsupported"};return current.providerInstance.reconnect(current.ses);}
}
