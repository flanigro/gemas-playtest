// Worker lifecycle is independent of the rules and the rendering layer.
export class OpponentController {
 constructor({workerFactory,onResult,onError}){this.workerFactory=workerFactory;this.onResult=onResult;this.onError=onError;this.worker=null;this.serial=0;this.key=null;}
 cancel(){this.serial++;this.worker?.terminate();this.worker=null;this.key=null;}
 start(key,observation){
  if(this.key===key)return;
  this.cancel();this.key=key;const serial=this.serial;
  try {
   const worker=this.worker=this.workerFactory();
   worker.onmessage=event=>{if(serial!==this.serial)return;this.cancel();if(event.data.error)this.onError(event.data.error);else this.onResult(event.data.result,key);};
   worker.onerror=event=>{if(serial!==this.serial)return;this.cancel();this.onError(event.message||'Falha ao calcular a jogada.');};
   worker.postMessage(observation);
  }catch(error){this.cancel();this.onError(error.message);}
 }
}
