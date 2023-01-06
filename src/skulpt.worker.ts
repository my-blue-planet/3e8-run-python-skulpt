//"__IMPORT_SKULPT_MIN__"
//"__IMPORT_SKULPT_STDLIB__"

interface WorkerEventData {
  type: string, code?: string, addLib?: any, key?: string, name?: string, readysignal?: string, payload?: any}
interface WorkerEvent {data: WorkerEventData}

function init() {

  // @ts-ignore
  const Sk = self.Sk;

  const readModule = function(module: string) {
    if (Sk.builtinFiles === undefined || Sk.builtinFiles["files"][module] === undefined)
      throw `File not found: ${module}`;
    return Sk.builtinFiles["files"][module];
  };

  const sendMessage = (type: string, payload: any) => {
    self.postMessage(JSON.stringify({type, payload}));
  };

  const run = (code: string) => {
    let runningPromise = Sk.misceval.asyncToPromise(function() {
      return Sk.importMainWithBody("<stdin>",  /*dumpjs*/ false, code || "", /*useSupensions (async)*/ true);
    });
    return runningPromise.then(
      function success(mod: any) {
        sendMessage('exit', {});
      },
      function fail(err: Error) {
        // console.log(err, JSON.stringify(err.traceback));
        sendMessage('error', err.toString());
      });
  };

  Sk.configure({
    read: readModule,
    __future__: Sk.python3,
    output: function (output: any) {
      sendMessage('log', output);
    }
  });

  //@keyboard, etc
  const state: Record<string, any> = {
    pressed_keys: [],
  }
  // list of ready js tasks
  const ready: Record<string, any> = {};
  //SharedArrayBuffers
  const sharedArrayBuffers: Record<string, Uint8Array | Uint32Array> = {}

  const customBuiltins = {
    show: function(payload: any)  {
      return sendMessage("show", {"show": Sk.ffi.remapToJs(payload)}); //mayBe unwrap
    },
    waitFor: function(readysignal: string) {
      let readySignalJS: string = Sk.ffi.remapToJs(readysignal);
      if(ready[readySignalJS]) {
        let signal = ready[readySignalJS];
        delete ready[readySignalJS];
        return Sk.ffi.remapToPy(signal);
      }
      else return false;
    },
    checkGlobals: function(keys: string[]) {
      let globals = {} as Record<string, any>;
      for(let k of Sk.ffi.remapToJs(keys)) {
        globals[k] = Sk.ffi.remapToJs(k in Sk.globals ? Sk.globals[k] : "__undefined__");
      }
      return sendMessage("evaluate", globals);
    },
    getWorkerState: function(key: string) {
      let keyJsString = Sk.ffi.remapToJs(key);
      return Sk.ffi.remapToPy(state[keyJsString]);
    },
    readShared: function(namepy: string, index: number) {
      let name = Sk.ffi.remapToJs(namepy)
      if(!sharedArrayBuffers[name]) {
        console.warn(`${name} is not a shared buffer`);
        return -1
      }
      return Sk.ffi.remapToPy(sharedArrayBuffers[name][Sk.ffi.remapToJs(index)]);
    },
    writeShared: function(namepy: string, index: number, value: number) {
      let name = Sk.ffi.remapToJs(namepy)
      if(!sharedArrayBuffers[name]) {
        console.warn(`${name} is not a shared buffer`);
        return -1
      }
      if(sharedArrayBuffers[name] instanceof Uint8Array) {
        let v = Sk.ffi.remapToJs(value)
        sharedArrayBuffers[name][Sk.ffi.remapToJs(index)] = v < 0 ? 0 : v > 255 ? 255 : v // clip
      }
      else {
        sharedArrayBuffers[name][Sk.ffi.remapToJs(index)] = Sk.ffi.remapToJs(value)
      }
    },
  }

  for(let name of Object.keys(customBuiltins) as (keyof typeof customBuiltins)[]) {
    Sk.builtin[name] = Sk.builtins[name] = customBuiltins[name];
  }

  const messageHandlers = {
    run(e: WorkerEvent) {run(e.data.code);},
    addLib(e: WorkerEvent) {
      for(let path in e.data.addLib) {
        if(Sk.builtinFiles.files[path] && !path.match(/os/)) {
          console.warn(path + " exists, module is overwritten");
        }
        Sk.builtinFiles.files[path] = e.data.addLib[path];
      }
    },
    event(e: WorkerEvent) {
      if(e.data.name === "keydown") state.pressed_keys.push(e.data.key);
      if(e.data.name === "keyup") state.pressed_keys = state.pressed_keys.filter((k: string)=>k!==e.data.key);
    },
    readysignal(e: WorkerEvent) {
      ready[e.data.readysignal as string] = {payload: e.data.payload};
    },
    addSharedArrayBuffer(e: WorkerEvent) {
      sharedArrayBuffers[e.data.name] = e.data.payload
    }
  }

  globalThis.addEventListener('message', (e: WorkerEvent) => {
    const type = e.data.type as keyof typeof messageHandlers;
    if(type in messageHandlers) {
      messageHandlers[type](e);
    }
    else {
      console.warn(`Unknown Data Type: ${type}`);
    }
  })
}

init()
