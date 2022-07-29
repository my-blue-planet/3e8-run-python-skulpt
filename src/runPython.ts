const WORKERCODE1 = "__SKULPTMIN__"
const WORKERCODE2 = "__SKULPTSTDLIB__"
const WORKERCODE3 = "__MYWORKERCODE__"

const workercode = WORKERCODE1 + "\n" + WORKERCODE2 + "\n" + WORKERCODE3

const blob = new Blob([workercode]);
const blobURL = window.URL.createObjectURL(blob);

interface IRunSubscriber {
  sendReadySignal: (readySignal: string, payload: any)=>void
}

export interface IRunConfig {
  context?: "play" | "evaluate"
  code: string
  outputElement?: HTMLDivElement
  show?: (payload: any)=>void
  validator?: (code: string)=>boolean
  subscribers?: IRunSubscriber
  addLib?: Record<string, any>
}

export function runPython(config: IRunConfig) {

  const context = config.context || "play"
  const code = config.code || ""
  const outputElement = config.outputElement || document.createElement("div")
  const show = config.show || ((payload: any)=>0)
  const validator = config.validator || ((code: string)=>false)
  const subscribers = config.subscribers
  const addLib = config.addLib


  //console.log(code.indexOf("\r"), code.split("\n").slice(1).join("\n"), tj && tj.findAllErrors(code.split("\n").slice(1).join("\n")));
  console.log(config);

  const w = new Worker(blobURL);

  outputElement.innerHTML = '';

  function closeWorker(w: Worker) {
    console.log("close");
    w.dispatchEvent(new CustomEvent("terminate"));
    w.terminate();
  }

  w.onmessage = function(event: { data : {type: string, payload: any}}) {
    console.log(event);
    // @ts-ignore
    const {type, payload} = JSON.parse(event.data)
    if (type === 'exit') {
      closeWorker(w);
    }
    if (type === 'log') {
      let texts = payload.split("\n").slice(0,-1).forEach((t: string)=>{
        let div = document.createElement("div");
        div.classList.add("log");
        div.textContent = t;
        outputElement && outputElement.append(div);
      });
      console.log(payload);
    }
    if (type === 'show') {
      show(payload)
    }
    if (type === 'evaluate') {
      validator(payload)
    }
    if (type === 'error') {
      let lines = code.split("\n").length;
      let matches = payload.match(/SyntaxError: bad input on line (\d+)/);
      if(matches && matches.length) {
        if(+matches[1] >= lines) {
          outputElement.innerHTML += `<div class="warn">Unexpected end of code.</div>`;
        }
      }
      else {
        outputElement.innerHTML += `<div class="warn">${payload}</div>`;
      }
      console.warn(payload);
      closeWorker(w);
    }
  };
  if(addLib) {
    console.log(addLib);
    w.postMessage({type: "addLib", addLib});
  }
  setTimeout(()=>w.postMessage({type: "run", code}), 10);

  if(subscribers) subscribers.sendReadySignal = (readysignal, payload) => {
    w.postMessage({type: "readysignal", readysignal, payload})
  };

  //send keyboard events
  window.addEventListener("keydown", e=>{
    w.postMessage({type: "event", name: "keydown", key: e.key})
  })
  window.addEventListener("keyup", e=>{
    w.postMessage({type: "event", name: "keyup", key: e.key})
  })


  return w;
}