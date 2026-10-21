// Worker lifecycle is independent of the rules and the rendering layer.
export class OpponentController {
 constructor({workerFactory,onResult,onError,fallback=null,timeout=30000}){this.workerFactory=workerFactory;this.onResult=onResult;this.onError=onError;this.fallback=fallback;this.timeout=timeout;this.worker=null;this.serial=0;this.key=null;this.timer=null;}
 cancel(){this.serial++;clearTimeout(this.timer);this.timer=null;this.worker?.terminate();this.worker=null;this.key=null;}
 start(key,observation){
  if(this.key===key)return;
  this.cancel();this.key=key;const serial=this.serial;let failing=false;
  const fail=message=>{
   if(serial!==this.serial||failing)return;failing=true;
   clearTimeout(this.timer);this.worker?.terminate();this.worker=null;
   if(!this.fallback){this.cancel();this.onError(message);return;}
   this.timer=setTimeout(()=>{
    if(serial!==this.serial)return;
    try{const result=this.fallback(observation);this.cancel();this.onResult(result,key);}
    catch(error){this.cancel();this.onError(error.message);}
   },30);
  };
  try {
   const worker=this.worker=this.workerFactory();
   worker.onmessage=event=>{if(serial!==this.serial||failing)return;if(event.data.error){fail(event.data.error);return;}this.cancel();this.onResult(event.data.result,key);};
   worker.onerror=event=>{if(serial!==this.serial||failing)return;event.preventDefault?.();fail(event.message||'Falha ao calcular a jogada.');};
   this.timer=setTimeout(()=>fail('O cálculo demorou demais.'),this.timeout);
   worker.postMessage(observation);
  }catch(error){fail(error.message);}
 }
}
