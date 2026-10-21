import {chooseAction} from './opponent.mjs';
self.onmessage=event=>{try{self.postMessage({result:chooseAction(event.data.observation,event.data.options)});}catch(error){self.postMessage({error:error.message});}};
