//"__IMPORT_SKULPT_MIN__"
//"__IMPORT_SKULPT_STDLIB__"
function init() {
    // @ts-ignore
    const Sk = self.Sk;
    const readModule = function (module) {
        if (Sk.builtinFiles === undefined || Sk.builtinFiles["files"][module] === undefined)
            throw `File not found: ${module}`;
        return Sk.builtinFiles["files"][module];
    };
    const sendMessage = (type, payload) => {
        self.postMessage(JSON.stringify({ type, payload }));
    };
    const run = (code) => {
        let runningPromise = Sk.misceval.asyncToPromise(function () {
            return Sk.importMainWithBody("<stdin>", /*dumpjs*/ false, code || "", /*useSupensions (async)*/ true);
        });
        return runningPromise.then(function success(mod) {
            sendMessage('exit', {});
        }, function fail(err) {
            // console.log(err, JSON.stringify(err.traceback));
            sendMessage('error', err.toString());
        });
    };
    Sk.configure({
        read: readModule,
        __future__: Sk.python3,
        output: function (output) {
            sendMessage('log', output);
        }
    });
    //@keyboard, etc
    const state = {
        pressed_keys: [],
    };
    // list of ready js tasks
    const ready = {};
    //SharedArrayBuffers
    const sharedArrayBuffers = {};
    const customBuiltins = {
        show: function (payload) {
            return sendMessage("show", { "show": Sk.ffi.remapToJs(payload) }); //mayBe unwrap
        },
        waitFor: function (readysignal) {
            let readySignalJS = Sk.ffi.remapToJs(readysignal);
            if (ready[readySignalJS]) {
                let signal = ready[readySignalJS];
                delete ready[readySignalJS];
                return Sk.ffi.remapToPy(signal);
            }
            else
                return false;
        },
        checkGlobals: function (keys) {
            let globals = {};
            for (let k of Sk.ffi.remapToJs(keys)) {
                globals[k] = Sk.ffi.remapToJs(k in Sk.globals ? Sk.globals[k] : "__undefined__");
            }
            return sendMessage("evaluate", globals);
        },
        getWorkerState: function (key) {
            let keyJsString = Sk.ffi.remapToJs(key);
            return Sk.ffi.remapToPy(state[keyJsString]);
        },
        readShared: function (namepy, index) {
            let name = Sk.ffi.remapToJs(namepy);
            if (!sharedArrayBuffers[name]) {
                console.warn(`${name} is not a shared buffer`);
                return -1;
            }
            return Sk.ffi.remapToPy(sharedArrayBuffers[name][Sk.ffi.remapToJs(index)]);
        },
        writeShared: function (namepy, index, value) {
            let name = Sk.ffi.remapToJs(namepy);
            if (!sharedArrayBuffers[name]) {
                console.warn(`${name} is not a shared buffer`);
                return -1;
            }
            sharedArrayBuffers[name][Sk.ffi.remapToJs(index)] = Sk.ffi.remapToJs(value);
        },
    };
    for (let name of Object.keys(customBuiltins)) {
        Sk.builtin[name] = Sk.builtins[name] = customBuiltins[name];
    }
    const messageHandlers = {
        run(e) { run(e.data.code); },
        addLib(e) {
            for (let path in e.data.addLib) {
                if (Sk.builtinFiles.files[path] && !path.match(/os/)) {
                    console.warn(path + " exists, module is overwritten");
                }
                Sk.builtinFiles.files[path] = e.data.addLib[path];
            }
        },
        event(e) {
            if (e.data.name === "keydown")
                state.pressed_keys.push(e.data.key);
            if (e.data.name === "keyup")
                state.pressed_keys = state.pressed_keys.filter((k) => k !== e.data.key);
        },
        readysignal(e) {
            ready[e.data.readysignal] = { payload: e.data.payload };
        },
        addSharedArrayBuffer(e) {
            sharedArrayBuffers[e.data.name] = e.data.payload;
        }
    };
    globalThis.addEventListener('message', (e) => {
        const type = e.data.type;
        if (type in messageHandlers) {
            messageHandlers[type](e);
        }
        else {
            console.warn(`Unknown Data Type: ${type}`);
        }
    });
}
init();
