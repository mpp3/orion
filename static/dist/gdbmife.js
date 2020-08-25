// Version 0.3.2
import { createFunFrame, createFunContainer, drawFunFrame } from "./stack.js";

class Logger {
    constructor(enabled, logFunction) {
        this.enabled = enabled;
        this.logFunction = logFunction;
    }

    log(text) {
        this.logFunction(text);
    }
};

class LoggerSet {
    constructor(loggers) {
        this.loggers = loggers;
    }
    log(texts) {
        for (let key in texts)
            if (texts.hasOwnProperty(key) && this.loggers.hasOwnProperty(key) && this.loggers[key].enabled) {
                this.loggers[key].log(texts[key]);
            }
    }
}

// ProgramState
// sourceCode: source code of the program being run
// execState: string representing the execution state of the program; one of:
// - stopped
// - running
// lineNum: next line to be executed?
// frames: list of objects representing the frames. Every frame is an object with members:
// - frameInfo: an object with these fields (all fields are strings):
//   * addr: string with starting address of the frame as an hex number
//   * file: name of the file with the source code of the function this frame belongs to
//   * fullname: absolute path to the source file including the file name.
//   * func: name of the function this frame belongs to.
//   * level: level of the frame in the call stack.
//   * line: current line being executed.
// - variables: list in which each element is an object representing a variable with members (all members are strings):
//   * name
//   * value
//   * type

class ProgramState {
    constructor(sourceCode, db) {
        this.sourceCode = sourceCode;
        this.execState = "stopped";
        this.lineNum = 0;
        this.frames = {};
        this.heap = new Array();
        this.output = "";
    }

    loadFromJSON(jsonObject) {
        this.execState = jsonObject.execState;
        this.lineNum = jsonObject.lineNum;
        this.frames = jsonObject.frames;
        this.heap = jsonObject.heap;
        this.output = jsonObject.output;
    }

    minMemoryAddress() {
        let min = Infinity;
        for (const allocation of this.heap) {
            let address = parseInt(allocation.address, 16);
            if (address < min) {
                min = address;
            }
        }
        return min;
    }

    maxMemoryAddress() {
        let max = -Infinity;
        for (const allocation of this.heap) {
            let address = parseInt(allocation.address, 16);
            if (address > max) {
                max = address;
            }
        }
        return max;
    }

    print() {
        console.log("execState: " + this.execState);
        console.log("lineNum: " + this.lineNum);
        console.log("heap allocations:");
        for (const allocation of this.heap) {
            console.log(allocation.address + ": " + allocation.size);
        }
        console.log("heap first address: " + this.minMemoryAddress());
        console.log("heap last address:" + this.maxMemoryAddress());
    }

    asText() {
        let heapText = "";
        for (const allocation of this.heap) {
            heapText += allocation.address + ": " + allocation.size;
        }
        return "execState," + this.execState + "\n"
            + "lineNum," + this.lineNum + "\n"
            + "heap," + heapText + "\n";
    }
}

/**
 * API to a web service capable of running multiple debugger instances.
 * Different instances are identified by a token, which is a positive integer.
 * 
 * Endpoints:
 * 
 * 'startDebugger': 
 * Creates a new debugger instance and returns a token to identify it.
 * Request arguments: none.
 * Returns JSON '{"sessionToken": token}' with the token for the instance.
 * 
 * 'loadProgramRunAndBreakInMain':
 * Accepts a POST request with fields 'sessionToken' and 'code' (with the source code).
 * Runs this debugger commands:
 * - loads the file and symbols for the source code given;
 * - skip standard libraries and "dyno.h";
 * - insert break point in main();
 * - run the program.
 * Response: {"sessionToken": token, "response": debugger process output}.
 * 
 * 'command':
 * Sends a command to the debugger process.
 * Request arguments: 'sessionToken', 'command'.
 * Response: [debugger process output].
 *
 * 'output':
 * Gets the standard output from the debugged program.
 * Request arguments: "sessionToken".
 * Response: {"sessionToken": token, "output": output}.
 *  
 * 'memory':
 * Gets the dynamic memory allocations owned by the debugged program.
 * Request arguments: "sessionToken".
 * Response: {"sessionToken": token, "memory": [{"address", "size"}]}
 * 
 * 'close':
 * Kills the debugger instance with given token and cleans up.
 * Accepts a POST request with field: "sessionToken".
 * Response: "" on success, error message on failure.
 * 
 */
const webDebuggerAPI = {
    url: config.server,
    // 
    startDebugger: "/start",
    loadProgramRunAndBreakInMain: "/code",
    command: "/command",
    getVariable: "/variable",
    getOutput: "/output",
    getMemory: "/memory",
    killDebugger: "/close",
    step: "/step"
};

/**
 * Represents an interface to a debugger run by a web server
 * that implements the API 'webDebuggerAPI'
 */

/**
 * Should this be a thin interface or should it assume some logic?
 */

class webDebugger {
    constructor(logger) {
        this.commandTokenGenerator = new TokenGenerator;
        this.sessionToken = -1;
        this.logger = logger;
    }

    async startDebugger(callBack) {
        const response = await fetch(webDebuggerAPI.url + webDebuggerAPI.startDebugger);
        const jsonResult = await response.json();
        this.sessionToken = jsonResult.sessionToken;
        this.programState = new ProgramState();
        callBack.bind(this)();
    }

    updateState(commandResponse) {
        for (let record of commandResponse) {
            if (record.message === "stopped") {
                if (record.payload.hasOwnProperty("frame")) {
                    this.programState.lineNum = record.payload.frame.line;
                }
                if (record.payload.hasOwnProperty("reason")) {
                    if (record.payload.reason === "exited-normally") {
                        this.programState.execState = "exited-normally";
                    }
                    else if (record.payload.reason === "exited") {
                        this.programState.execState = "exited";
                    }
                    else {
                        this.programState.execState = "stopped";
                    }
                }
            }
            else if (record.message === "done" && record.hasOwnProperty("payload") && record.payload && record.payload.hasOwnProperty("bkpt")) {
                this.programState.lineNum = record.payload.bkpt.line;
                this.programState.execState = "stopped";
            }
        }
        this.logger.log({ "ProgramState": this.programState.asText() });
    }

    async command(command) {
        let n = Date.now();
        let t = performance.now();
        if (command !== '') {
            var requestUrl = webDebuggerAPI.url + webDebuggerAPI.command
                + "?sessionToken=" + this.sessionToken
                + "&command=" + command;
            const response = await fetch(encodeURI(requestUrl));
            let et = performance.now() - t;
            this.logger.log({ "time": [command, n, et] });
            return await response.json();
        }
        else {
            return null;
        }
    }

    async getVariable(frame, variableName) {
        let n = Date.now();
        let t = performance.now();
        var requestUrl = webDebuggerAPI.url + webDebuggerAPI.getVariable
            + "?sessionToken=" + this.sessionToken
            + "&frame=" + frame
            + "&name=" + variableName;
        const response = await fetch(encodeURI(requestUrl));
        let et = performance.now() - t;
        this.logger.log({ "time": ["getVariable " + variableName, n, et] });
        return await response.json();
    }

    async getFrames() {
        let n = Date.now();
        let t = performance.now();
        let cToken = commandTokenGenerator.generateToken();
        let framesMap = {}
        const result_1 = await this.command(`${cToken}-stack-list-frames`);
        if (result_1[0].payload.hasOwnProperty("stack")) {
            let frameList = result_1[0].payload.stack;
            for (let frame of frameList) {
                cToken = commandTokenGenerator.generateToken();
                framesMap[cToken] = {
                    'frameInfo': frame,
                    'variables': []
                };
                let result_2 = await this.command(`${cToken}-stack-list-variables --thread 1 --frame ${frame.level} --all-values`);
                let answer = result_2[0];
                framesMap[answer.token].variables = answer.payload.variables;
                let nToken = commandTokenGenerator.generateToken();
                let newResult = await this.command(`${nToken}-stack-list-variables --thread 1 --frame ${frame.level} --simple-values`);
                let newAnswer = newResult[0];
                for (let i = 0; i < newAnswer.payload.variables.length; i++) {
                    framesMap[answer.token].variables[i].type = newAnswer.payload.variables[i].type;
                    let varResponse = await this.getVariable(frame.level, framesMap[answer.token].variables[i].name);
                    framesMap[answer.token].variables[i].address = varResponse.address[0].payload.value;
                    framesMap[answer.token].variables[i].size = varResponse.size[0].payload.value;
                }
            }
        }
        let framesList = new Array(Object.keys(framesMap).length);
        if (framesList.length > 0) {
            for (var fToken of Object.keys(framesMap)) {
                framesList[parseInt(framesMap[fToken].frameInfo.level)] = framesMap[fToken];
            }
        }
        this.programState.frames = framesList;
        let et = performance.now() - t;
        this.logger.log({ "time": ["getFrames", n, et] });
    }

    async getMemory() {
        let n = Date.now();
        let t = performance.now();
        let requestUrl = webDebuggerAPI.url + webDebuggerAPI.getMemory
            + "?sessionToken=" + this.sessionToken;
        const response = await fetch(encodeURI(requestUrl));
        const result = await response.json();
        this.programState.heap = result.memory;
        let et = performance.now() - t;
        this.logger.log({ "time": ["getMemory", n, et] });
        return result;
    }

    async getOutput() {
        let n = Date.now();
        let t = performance.now();
        let requestUrl = webDebuggerAPI.url + webDebuggerAPI.getOutput
            + "?sessionToken=" + this.sessionToken;
        const response = await fetch(encodeURI(requestUrl));
        const result = await response.json();
        this.programState.output = result.output;
        let et = performance.now() - t;
        this.logger.log({ "time": ["getOutput", n, et] });
    }

    async loadProgram() { }

    async loadProgramRunAndBreakInMain(code) {
        const formData = new FormData();
        formData.append("sessionToken", this.sessionToken);
        formData.append("code", code);
        const response = await fetch(
            webDebuggerAPI.url + webDebuggerAPI.loadProgramRunAndBreakInMain,
            {
                method: 'POST',
                body: formData
            });
        const result = await response.json();
        this.updateState(result["response"]);
    }

    async runProgram() { }

    async restartProgram() {
        let cToken = this.commandTokenGenerator.generateToken();
        return this.command(`${cToken}-exec-run`)
            .then(async (response) => {
                this.updateState(response);
                let framesResult = await this.command(`-stack-list-frames`);
                this.updateState(framesResult);
                this.programState.output = "";
            });
    }

    async step() {
        let n = Date.now();
        let t = performance.now();
        let requestUrl = webDebuggerAPI.url + webDebuggerAPI.step
            + "?sessionToken=" + this.sessionToken;
        const response = await fetch(encodeURI(requestUrl))
        const result = await response.json();
        this.programState.loadFromJSON(result.programState);
        let et = performance.now() - t;
        this.logger.log({ "time": ["step", n, et] });
        return result;
    }

    async next() {
        let n = Date.now();
        let t = performance.now();
        let cToken = this.commandTokenGenerator.generateToken();
        return this.command(`${cToken}-exec-next`)
            .then(async (nextResponse) => {
                await this.getFrames();
                await this.getMemory();
                await this.getOutput();
                this.updateState(nextResponse);
                let et = performance.now() - t;
                this.logger.log({ "time": ["next", n, et] });
            });

    }

    closeSession(event) {
        const formData = new FormData();
        formData.append("sessionToken", this.sessionToken);
        let requestUrl = webDebuggerAPI.url + webDebuggerAPI.killDebugger;
        navigator.sendBeacon(requestUrl, formData);
    }

}

const apiUrl = "http://localhost:5000/";


var editor;

require.config({ paths: { 'vs': 'monaco-editor/min/vs' } });
require(['vs/editor/editor.main'], function () {
    editor = monaco.editor.create(document.getElementById('code-editor-container'), {
        value: [
            '#include <iostream>',
            '#include "dyno.h"',
            '',
            'int main() {',
            '\tstd::cout << "Hello world!";',
            '}'
        ].join('\n'),
        language: 'cpp'
    });

});

var edit = true;
const compileElement = document.getElementById("compile");
const fileButtonElement = document.getElementById("file-button");
const commandElement = document.getElementById("command");
const fileField = document.getElementById("file");
const stateElement = document.getElementById("state");
const sourcePanelElement = document.getElementById("source-panel");
const codeEditorContainerElement = document.getElementById("code-editor-container");
const sourcePreElement = document.getElementById("sourcecode");
const sourceElement = document.getElementById("source");
const stepElement = document.getElementById("step");
const nextElement = document.getElementById("next");
const restartElement = document.getElementById("restart");
const stackElement = document.getElementById("stack");
const heapElement = document.getElementById("heap");
const outputElement = document.getElementById("output");
const canvas = document.getElementById("heapCanvas");
canvas.width = heapElement.offsetWidth;
canvas.height = 0.975 * sourcePanelElement.offsetHeight;
var ctx = canvas.getContext("2d");
ctx.strokeStyle = "rgb(0, 0, 0)";
ctx.fillStyle = "rgb(255, 164, 56)";
const stackConf = {
    pixelsPerByte: 4,
    varLabelHeight: 30,
    varLabelSep: 5,
    topMargin: 10,
    leftMargin: 0.015,
    frameHMargin: 0.01,
    frameVMargin: 5,
    frameHeaderHeight: 30,
    funFrameBoxWidth: 0.65,
    stackFrameBoxWidth: 0.23,
    funStackFramesSep: 0.07,
    funStackFramesVSep: 20,
    canvasBackgroundColor: "#f9f9f9",
    frameTitleBackgroundColor: "4267ff",
    frameBorderColor: "4267ff",
    varNameBackgroundColor: ["#ff5000", "#ff7000", "#ff9000", "#ffb000", "#ffd000"]
};

const stackFrame = createFunFrame(stackConf.canvasBackgroundColor);
var stackContainer = null;
stackFrame.on("ready", () => {
    stackContainer = createFunContainer(stackFrame.stage);
    stackFrame.stage.update();
})

var sessionToken = 0;

class TokenGenerator {
    constructor() {
        this.nextToken = 0;
    }
    generateToken() {
        this.nextToken = this.nextToken + 1;
        return this.nextToken;
    }
};
var commandTokenGenerator = new TokenGenerator();

// Presenter
// This "object" acts as an intermediary between the GUI an dbugger
// For now, it manages the GUI elements directly
// I will design an interface for the GUI elements later.
// That interface will be a kind of state machine

function compileAction() {
    let sourceCode = editor.getValue();
    sourceElement.textContent = sourceCode;
    Prism.highlightElement(sourceElement);
    codeEditorContainerElement.style.height = "0px";
    codeEditorContainerElement.style.visibility = "hidden";
    sourcePreElement.style.height = "800px";
    sourcePreElement.style.visibility = "visible";
    compileElement.removeEventListener("click", compileAction);
    dbugger.loadProgramRunAndBreakInMain(sourceCode)
        .then(() => {
            compileElement.innerHTML = "Edit";
            disableUploadButton();
            compileElement.addEventListener("click", editAction);
            // updateSourceCodePanel(dbugger.programState.lineNum);
            updatePanels(dbugger.programState);
            reportExecState(
                dbugger.programState.execState,
                dbugger.line
            );
            enableExecButtons(dbugger.programState.execState);
        });
}

function loadFile() {
    let fileNameElement = document.getElementById("file-name");
    fileNameElement.innerHTML = `${fileField.files[0].name}`;
    let file = fileField.files[0];
    var fileReader = new FileReader();
    fileReader.onload = function () {
        editor.setValue(this.result);
    };
    fileReader.readAsText(file);
}

function nextAction() {
    disableExecButtons();
    reportExecState("running");
    dbugger.next()
        .then(() => {
            updatePanels(dbugger.programState);
            reportExecState(
                dbugger.programState.execState,
                dbugger.lineNum);
            enableExecButtons(dbugger.programState.execState);
        });
}

function stepAction() {
    disableExecButtons();
    reportExecState("running");
    dbugger.step()
        .then(() => {
            updatePanels(dbugger.programState);
            reportExecState(
                dbugger.programState.execState,
                dbugger.lineNum);
            enableExecButtons(dbugger.programState.execState);
        });
}

function restartAction() {
    disableExecButtons();
    reportExecState("running");
    dbugger.restartProgram()
        .then(() => {
            updatePanels(dbugger.programState);
            reportExecState("stopped");
            enableExecButtons(dbugger.programState.execState);
        });
}

function editAction() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    compileElement.innerHTML = "Compile & Run";
    compileElement.removeEventListener("click", editAction);
    compileElement.addEventListener("click", compileAction);
    codeEditorContainerElement.style.height = "800px";
    codeEditorContainerElement.style.visibility = "visible";
    document.getElementById("source-card").scroll(0, 0);
    sourcePreElement.style.height = "0px";
    sourcePreElement.style.visibility = "hidden";
    updatePanels(dbugger.programState);
    disableExecButtons();
    enableUploadButton();
    reportExecState("edit");
    outputElement.innerHTML = "";
}

function closeSessionAction(event) {
    dbugger.closeSession(event);
}

// Presenter ends here

// View
// Functions accept as arguments the minimum information possible

function enableUploadButton() {
    fileButtonElement.removeAttribute("disabled");
    fileField.removeAttribute("disabled");
}

function disableUploadButton() {
    fileButtonElement.setAttribute("disabled", "");
    fileField.setAttribute("disabled", "");
}

function enableExecButtons(state) {
    if (state === "stopped") {
        stepElement.removeAttribute("disabled");
        nextElement.removeAttribute("disabled");
    }
    restartElement.removeAttribute("disabled");
}

function disableExecButtons() {
    stepElement.setAttribute("disabled", "");
    nextElement.setAttribute("disabled", "");
    restartElement.setAttribute("disabled", "");
}

const stateElementClass = "u-large c-button";

function reportExecState(state, line) {
    switch (state) {
        case "edit":
            stateElement.innerHTML = "No program loaded";
            stateElement.className = stateElementClass;
            break;
        case "exited-normally":
            stateElement.innerHTML = "exited normally";
            stateElement.className = stateElementClass + " c-button--success";
            break;
        case "exited":
            stateElement.innerHTML = "exited with errors";
            stateElement.className = stateElementClass + " c-button--error";
            break;
        case "running":
            stateElement.innerHTML = "program running";
            stateElement.className = stateElementClass + " c-button--warning";
            break;
        case "stopped":
            stateElement.innerHTML = `program paused - next line: ${line}`;
            stateElement.className = stateElementClass + " c-button--info";
            break;
        default:
            stateElement.innerHTML = "unknown error";
            stateElement.className = stateElementClass + " c-button--error";
    }
}

function updatePanels(programState) {
    updateSourceCodePanel(programState.lineNum);
    updateStack(programState.frames);
    updateOutput(programState.output);
    updateHeap(programState.heap,
        programState.minMemoryAddress(),
        programState.maxMemoryAddress());
}

function updateSourceCodePanel(currentLine) {
    let dataLine = sourcePreElement.setAttribute("data-line", currentLine);
    Prism.highlightElement(sourceElement);
    let lineNumbersElement = document.getElementsByClassName("line-numbers-rows")[0];
    let lineToScroll = (currentLine > 5) ? currentLine - 5 : currentLine;
    let lineToScrollElement = lineNumbersElement.children[lineToScroll - 1];
    if (lineToScrollElement) {
        lineToScrollElement.scrollIntoView();
    }
}

function updateStack(framesList) {
    stackContainer.removeAllChildren();
    let topAddress = lowAddress(framesList).address;
    if (framesList.length > 0) {
        let vpos = 0;
        for (var frame of framesList) {
            let isInCurrentFrame = frame.frameInfo.level === "0";
            vpos = drawFunFrame(stackContainer, stackFrame.width, vpos, topAddress, frame, stackConf);
        }
    }
    stackFrame.update();
}

function updateOutput(output) {
    outputElement.innerHTML = "";
    for (let line of output) {
        outputElement.innerHTML += line + "<br>";
    }
}

function lowAddress(frames) {
    let bottomAddress = Infinity;
    let bottomvar = 'none';
    let bottomsize = 0;
    if (frames.length > 0) {
        for (var frame of frames) {
            for (var variable of frame.variables) {
                let address = parseInt(variable.address, 16);
                if (address < bottomAddress) {
                    bottomAddress = address;
                    bottomvar = variable.name;
                    bottomsize = parseInt(variable.size);
                }
            }
        }
    }
    let bottom = { 'address': bottomAddress, 'size': bottomsize }
    return bottom;
}

function randomInt(from, to) {
    return Math.floor(Math.random() * (to - from) + from);
}

function randomColor() {
    return `rgb(${randomInt(0, 255)}, ${randomInt(0, 255)}, ${randomInt(0, 255)})`;
}

const heapMargin = 0.05;
const minAddressRange = 200;

function updateHeap(heap, firstAddress, lastAddress) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let heapRange = heapAutoZoom(heap, firstAddress, lastAddress);
    for (var i = 0; i < heap.length; i++) {
        heapDrawAlloc(heap[i], heapRange);
    }
}

function heapAutoZoom(heap, firstAddress, lastAddress) {
    let addressRange = lastAddress - firstAddress;
    if (addressRange < minAddressRange) {
        lastAddress = firstAddress + minAddressRange;
    }
    return {
        start: firstAddress,
        end: lastAddress
    };
}

function heapDrawAlloc(allocation, heapRange) {
    let vScale = canvas.height / (heapRange.end - heapRange.start);
    let firstAddress = parseInt(allocation.address, 16);
    let startOffset = firstAddress - heapRange.start;
    let topLeftCoord = startOffset * vScale;
    let width = canvas.width * 0.95;
    let height = vScale * allocation.size;
    ctx.fillRect(0, topLeftCoord, width, height * 0.95);
    ctx.strokeRect(0, topLeftCoord, width, height);
}

var startTime = performance.now();
function executingAt() {
    return (performance.now() - startTime) / 1000;
}
function elapsedTime(from) {
    return performance.now() - from;
}

var logger = new LoggerSet({
    "ProgramState": new Logger(false, text => console.log("ProgramState," + text)),
    "command": new Logger(false, text => console.log("command" + text)),
    "time": new Logger(true, text => {
        console.log(`${text[0]},${text[1]},${text[2]}`);
    })
});

var dbugger = new webDebugger(logger);

dbugger.startDebugger(() => {
    compileElement.addEventListener("click", compileAction);
    fileField.addEventListener("change", loadFile);
    nextElement.addEventListener("click", nextAction);
    stepElement.addEventListener("click", stepAction);
    restartElement.addEventListener("click", restartAction);
    window.addEventListener("beforeunload", closeSessionAction);
});
