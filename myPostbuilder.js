// https://www.html5rocks.com/en/tutorials/workers/basics/#toc-inlineworkers

import fs from "fs"

const parseFile = (p)=>{
	return fs
		.readFileSync(p, {encoding: "utf8"})
		.replaceAll("$", "__DOLLARSIGN__")
		.replaceAll('\\', '\\\\')
		.replaceAll('`', '\\`')
}
const maincode = fs.readFileSync("./src/runPython.js", {encoding: "utf8"})
const workercode = parseFile("./src/skulpt.worker.js")
const skulptcode = parseFile("./src/external/Skulpt/Skulpt.min.worker.js")
const stdlibcode = parseFile("./src/external/Skulpt/skulpt-stdlib-worker.js")

const maincodeOut = maincode
	.replace(`"__SKULPTMIN__"`, "`"+skulptcode+"`")
	.replace(`"__SKULPTSTDLIB__"`, "`"+stdlibcode+"`")
	.replace(`"__MYWORKERCODE__"`, "`"+workercode+"`")
	.replaceAll("__DOLLARSIGN__", "\\$")

fs.writeFileSync("./toNPM/runPython.js", maincodeOut, {encoding: "utf8"})
fs.copyFileSync("./src/runPython.d.ts", "./toNPM/runPython.d.ts")
fs.copyFileSync("./src/skulpt.worker.d.ts", "./toNPM/skulpt.worker.d.ts")