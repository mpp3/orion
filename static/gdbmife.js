console.log("gdbmife loaded");

class ProgramState {
    constructor(sourceCode, db) {
        this.sourceCode = sourceCode;
        this.execState = "stopped";
        this.lineNum = 0;
        this.frames = {};
        this.heap = [];
        this.output = "";
    }

    minMemoryAddress(allocations) {
        let min = Infinity;
        for (allocation of allocations) {
            let address = parseInt(allocation.address, 16);
            if (address < min) {
                min = address;
            }
        }
        return min;
    }

    maxMemoryAddress(allocations) {
        let max = Infinity;
        for (allocation of allocations) {
            let address = parseInt(allocation.address, 16);
            if (address > max) {
                max = address;
            }
        }
        return max;
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
    url: "http://localhost:5000",
    // 
    startDebugger: "/start",
    loadProgramRunAndBreakInMain: "/code",
    command: "/command",
    getOutput: "/output",
    getMemory: "/memory",
    killDebugger: "/close"
};

/**
 * Represents an interface to a debugger run by a web server
 * that implements the API 'webDebuggerAPI'
 */

/**
 * Should this be a thin interface or should it assume some logic?
 */

class webDebugger {
    constructor() {
        this.commandTokenGenerator = new TokenGenerator;
        this.sessionToken = -1;
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
    }

    async command(command) {
        if (command !== '') {
            var requestUrl = webDebuggerAPI.url + webDebuggerAPI.command
                + "?sessionToken=" + this.sessionToken
                + "&command=" + command;
            const response = await fetch(encodeURI(requestUrl));
            return await response.json();
        }
        else {
            return null;
        }
    }

    async getFrames() {
        console.log("getting frames...");
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
                }
            }
        }
        let framesList = new Array(Object.keys(framesMap).lenth);
        if (framesList.length > 0) {
            for (var fToken of Object.keys(framesMap)) {
                framesList[parseInt(framesMap[fToken].frameInfo.level)] = framesMap[fToken];
            }
        }
        this.programState.frames = framesList;
        console.log(framesList);
    }

    async getMemory() {
        console.log("getting memory...");
        let requestUrl = webDebuggerAPI.url + webDebuggerAPI.getMemory
            + "?sessionToken=" + this.sessionToken;
        const response = await fetch(encodeURI(requestUrl));
        const result = await response.json();
        this.programState.heap = result.memory;
    }

    async getOutput() {
        console.log("getting output...");
        let requestUrl = webDebuggerAPI.url + webDebuggerAPI.getOutput
            + "?sessionToken=" + this.sessionToken;
        const response = await fetch(encodeURI(requestUrl));
        const result = await response.json();
        this.programState.output = result.output;
    }

    async loadProgram() { }

    async loadProgramRunAndBreakInMain(code) {
        console.log(executingAt(), "loading program...");
        const formData = new FormData();
        formData.append("sessionToken", this.sessionToken);
        formData.append("code", code);
        const response = await fetch(webDebuggerAPI.url + webDebuggerAPI.loadProgramRunAndBreakInMain, {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        console.log(result["response"]);
        this.updateState(result["response"]);
        console.log("...", executingAt());
    }

    async runProgram() { }

    async restartProgram() {
        let cToken = this.commandTokenGenerator.generateToken();
        this.command(`${cToken}-exec-run`)
            .then(async () => {
                let framesResult = await this.command(`-stack-list-frames`);
                this.updateState(framesResult);
            });
    }

    async step() {
        console.log(executingAt(), "stepping...");
        let cToken = this.commandTokenGenerator.generateToken();
        this.command(`${cToken}-exec-step`)
            .then(async (stepResponse) => {
                await this.getFrames();
                await this.getMemory();
                await this.getOutput();
                this.updateState(stepResponse);
                console.log("...", executingAt());
            });

    }

    async next() {
        console.log(executingAt(), "nexting...");
        let cToken = this.commandTokenGenerator.generateToken();
        this.command(`${cToken}-exec-next`)
            .then(async (nextResponse) => {
                await this.getFrames();
                await this.getMemory();
                await this.getOutput();
                this.updateState(nextResponse);
                console.log("...", executingAt());
            });

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

var sessionToken = 0;
var lineNum = 0;

const heapMargin = 0.05;
var heap = { memory: [], sessionToken: 0 };
var heapRange = { start: 0, end: 0 };
const minAddressRange = 200;

function heapAutoZoom() {
    let firstAddress = minAddress();
    let lastAddress = maxAddress();
    let addressRange = lastAddress - firstAddress;
    if (addressRange < minAddressRange) {
        lastAddress = firstAddress + minAddressRange;
    }
    console.log("Heap length: ", heap.memory.length);
    console.log("Heap address range: ", firstAddress, " - ", lastAddress);
    return {
        start: firstAddress,
        end: lastAddress
    };
}

function minAddress() {
    let min = Infinity;
    for (var i = 0; i < heap.memory.length; i++) {
        let addressNum = parseInt(heap.memory[i].address, 16);
        if (addressNum < min) {
            min = addressNum;
        }
    }
    return min;
}

function maxAddress() {
    let max = -Infinity;
    let maxPos = 0;
    for (var i = 0; i < heap.memory.length; i++) {
        let addressNum = parseInt(heap.memory[i].address, 16);
        if (addressNum > max) {
            max = addressNum;
            maxPos = i;
        }
    }
    return max + ((heap.memory.length > 0) ? heap.memory[maxPos].size : 0);
}

function updateHeap() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let heapRange = heapAutoZoom();
    console.log("Heap range: ", heapRange.start, " - ", heapRange.end);
    for (var i = 0; i < heap.memory.length; i++) {
        heapDrawAlloc(heap.memory[i], heapRange);
    }
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
    console.log(`Allocation coordinates: (0, ${topLeftCoord}) - (${width}, ${topLeftCoord + height})`);
}

function updateOutput(output) {
    outputElement.innerHTML = "";
    for (line of output["output"]) {
        outputElement.innerHTML += line + "<br>";
    }
}

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

function enableExecButtons() {
    stepElement.removeAttribute("disabled");
    nextElement.removeAttribute("disabled");
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

function updateSourceCode(dic) {
    if (dic.message === "stopped") {
        if (dic.payload.hasOwnProperty("frame")) {
            lineNum = dic.payload.frame.line;
        }
        if (dic.payload.hasOwnProperty("reason")) {
            if (dic.payload.reason === "exited-normally") {
                reportExecState("exited-normally");
            }
            else if (dic.payload.reason === "exited") {
                reportExecState("exited");
            }
            else {
                reportExecState("stopped", lineNum);
                dataLine = sourcePreElement.setAttribute("data-line", lineNum);
                Prism.highlightElement(sourceElement);
                let lnr = document.getElementsByClassName("line-numbers-rows")[0];
                let targetLine = (lineNum > 5) ? lineNum - 5 : lineNum;
                let atLine = lnr.children[targetLine - 1];
                if (atLine) {
                    atLine.scrollIntoView();
                }
            }
        }
    }
    if (dic.message === "done" && dic.hasOwnProperty("payload") && dic.payload && dic.payload.hasOwnProperty("bkpt")) {
        lineNum = dic.payload.bkpt.line;
        reportExecState("stopped", lineNum);
        dataLine = sourcePreElement.setAttribute("data-line", lineNum);
        Prism.highlightElement(sourceElement);
        let lnr = document.getElementsByClassName("line-numbers-rows")[0];
        let targetLine = (lineNum > 5) ? lineNum - 5 : lineNum;
        let atLine = lnr.children[targetLine - 1];
        atLine.scrollIntoView();
    }
}

const framePreVariable = `
                <tr class="c-table__row">`;
const framePostVariable = `
                </tr>`;
const framePostFrame = `
            </tbody>
        </table>
    </section>
</div>`;

function variableNameStyle(isInCurrentFrame) {
    let html = "u-text--mono u-large";
    html += (isInCurrentFrame) ? " u-text--loud" : " u-text--quiet";
    return html;
}

function variableValueStyle(isInCurrentFrame) {
    let html = "u-text--mono u-large";
    html += (isInCurrentFrame) ? "" : " u-text--quiet";
    return html;
}

function variableTypeStyle(isInCurrentFrame) {
    let html = "u-text--mono";
    html += (isInCurrentFrame) ? "" : " u-text--quiet";
    return html;
}

function variableHTML(variable, isInCurrentFrame) {
    let html = framePreVariable;
    html += `
    <td class="c-table__cell" style="width: 20%">
        <span class="${variableNameStyle(isInCurrentFrame)}">
            ${variable.name}
        </span>
    </td>`;
    html += `
    <td class="c-table__cell" width="50%">
        <span class="${variableValueStyle(isInCurrentFrame)}">
            ${variable.value}
        </span>
    </td>`;
    html += `
    <td class="c-table__cell" width="30%">
        <span class="${variableTypeStyle(isInCurrentFrame)}">
            ${variable.type}
        </span>
    </td>`;
    html += framePostVariable;
    return html;
}

function framePreHeading(isInCurrentFrame) {
    return `
    <div class="c-card">
        <div role="separator" class="c-card__item
        ${isInCurrentFrame ? " c-card__item--brand" : " c-card__item--divider"}">`;
}

function framePostHeading(isInCurrentFrame) {
    return `
    </div>
    <section class="c-card__item
    ${isInCurrentFrame ? " c-card__item--warning" : ""}">
        <table class="c-table">
            <tbody class="c-table__body">`;
}

function frameFunctionNameStyle(isInCurrentFrame) {
    let html = "u-text--mono u-xlarge";
    html += (isInCurrentFrame) ? " u-text--loud" : " u-text--quiet";
    return html;
}

function framePCStyle(isInCurrentFrame) {
    let html = "c-badge c-badge--rounded u-large";
    html += (isInCurrentFrame) ? " c-badge--warning" : " c-badge--ghost";
    return html;
}

function frameHTML(frame, isInCurrentFrame) {
    let html = "";
    html += framePreHeading(isInCurrentFrame);
    html += `
        <span class="${framePCStyle(isInCurrentFrame)}">
            ${frame.frameInfo.line}
        </span>
        <span class="${frameFunctionNameStyle(isInCurrentFrame)}">
            ${frame.frameInfo.func}
        </span>
        `;
    html += framePostHeading(isInCurrentFrame);
    return html;
}

function drawFrames(framesMap) {
    framesList = new Array(Object.keys(framesMap).length);
    let stackContents = "";
    if (framesList.length > 0) {
        for (var fToken of Object.keys(framesMap)) {
            framesList[parseInt(framesMap[fToken].frameInfo.level)] = framesMap[fToken];
        }
        for (var frame of framesList) {
            let isInCurrentFrame = frame.frameInfo.level === "0";
            stackContents += frameHTML(frame, isInCurrentFrame);
            for (var variable of frame.variables) {
                stackContents += variableHTML(variable, isInCurrentFrame);
            }
            stackContents += framePostFrame;
        }
    }
    stackElement.innerHTML = stackContents;
}

function updatePanels(response) {
    for (dic of response) {
        updateSourceCode(dic);
    }
}

// Start Gdb instance and get sessionToken
const startEndpoint = "start"
function startGdb() {
    fetch(apiUrl + startEndpoint)
        .then(response => response.json())
        .then(result => {
            sessionToken = result.sessionToken;
            console.log("sessionToken: ", sessionToken)
        });
}

// Load source file
function loadFile() {
    let fileNameElement = document.getElementById("file-name");
    fileNameElement.innerHTML = `${fileField.files[0].name}`;
    let file = fileField.files[0];
    var fr = new FileReader();
    fr.onload = function () {
        sourceElement.textContent = this.result;
        console.log(sourceElement.textContent);
        Prism.highlightElement(sourceElement);
        editor.setValue(this.result);
    };
    fr.readAsText(file);
}

// Load source code from editor
function loadCode(code) {
    sourceElement.textContent = code;
    Prism.highlightElement(sourceElement);
}

// Send file to debug
const fileEndpoint = "file";
function sendFile() {
    const formData = new FormData();
    formData.append("sessionToken", sessionToken);
    formData.append("file", fileField.files[0]);
    fetch(apiUrl + fileEndpoint, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(result => {
            console.log(result);
            updatePanels(result["response"]);
            enableExecButtons();
        });
}

function compileAndRun() {
    compileElement.innerHTML = "Edit";
    compileElement.removeEventListener("click", compileAndRun);
    compileElement.addEventListener("click", editAction);
    codeEditorContainerElement.style.height = "0px";
    codeEditorContainerElement.style.visibility = "hidden";
    sourcePreElement.style.height = "800px";
    sourcePreElement.style.visibility = "visible";
    sendCode();
}

const codeEndpoint = "code";
function sendCode() {
    const formData = new FormData();
    formData.append("sessionToken", sessionToken);
    code = editor.getValue();
    loadCode(code);
    formData.append("code", code);
    fetch(apiUrl + codeEndpoint, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(result => {
            console.log(result);
            updatePanels(result["response"]);
            enableExecButtons();
        })
}

function editAction() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    compileElement.innerHTML = "Compile & Run";
    compileElement.removeEventListener("click", editAction);
    compileElement.addEventListener("click", compileAndRun);
    codeEditorContainerElement.style.height = "800px";
    codeEditorContainerElement.style.visibility = "visible";
    document.getElementById("source-card").scroll(0, 0);
    sourcePreElement.style.height = "0px";
    sourcePreElement.style.visibility = "hidden";
    disableExecButtons();
    reportExecState("edit");
    outputElement.innerHTML = "";
    stackElement.innerHTML = "";
}

function loadAndSendFile() {
    loadFile();
    sendFile();
}

// Send command to debugger
const commandEndpoint = "command";
function sendCommand(command) {
    if (command !== '') {
        console.log("Command: ", command);
        var requestUrl = apiUrl + commandEndpoint
            + "?sessionToken=" + sessionToken
            + "&command=" + command;
        return fetch(encodeURI(requestUrl))
            .then(response => response.json());
    }
    else {
        return null;
    }
}

// const memoryEndpoint = "memory";
// function getMemory() {
//     console.log(`getMemory: ${sessionToken}`);
//     let requestUrl = apiUrl + memoryEndpoint
//         + "?sessionToken=" + sessionToken;
//     return fetch(encodeURI(requestUrl))
//         .then(response => response.json());
// }

const outputEndpoint = "output";
function getOutput() {
    console.log(`getOutput: ${sessionToken}`);
    let requestUrl = apiUrl + outputEndpoint
        + "?sessionToken=" + sessionToken;
    return fetch(encodeURI(requestUrl))
        .then(response => response.json());
}

function commandElementChange(event) {
    disableExecButtons();
    sendCommand(event.target.value)
        .then(result => {
            console.log(result);
            updatePanels(result);
            getFrames();
            commandElement.value = '';
            enableExecButtons();
        });
}


function getFrames() {
    cToken = commandTokenGenerator.generateToken();
    framesMap = {}
    sendCommand(`${cToken}-stack-list-frames`)
        .then(async (result) => {
            console.log(result);
            if (result[0].payload.hasOwnProperty("stack")) {
                let frameList = result[0].payload.stack
                for (frame of frameList) {
                    cToken = commandTokenGenerator.generateToken();
                    framesMap[cToken] = {
                        'frameInfo': frame,
                        'variables': []
                    };
                    let result = await sendCommand(`${cToken}-stack-list-variables --thread 1 --frame ${frame.level} --all-values`);
                    console.log(result);
                    let answer = result[0];
                    framesMap[answer.token].variables = answer.payload.variables;
                    let nToken = commandTokenGenerator.generateToken();
                    let newResult = await sendCommand(`${nToken}-stack-list-variables --thread 1 --frame ${frame.level} --simple-values`);
                    console.log(newResult);
                    let newAnswer = newResult[0];
                    for (let i = 0; i < newAnswer.payload.variables.length; i++) {
                        framesMap[answer.token].variables[i].type = newAnswer.payload.variables[i].type;
                    }
                }
            }
            drawFrames(framesMap);
            enableExecButtons();
        });
}

function stepButtonAction() {
    disableExecButtons();
    reportExecState("running");
    cToken = commandTokenGenerator.generateToken();
    sendCommand(`${cToken}-exec-step`)
        .then(async (result) => {
            console.log(result);
            updatePanels(result);
            getFrames();
            heap = await getMemory();
            console.log(heap.memory);
            updateHeap(heap.memory);
            output = await getOutput();
            console.log(output);
            updateOutput(output);
        });
}

function nextButtonAction() {
    disableExecButtons();
    reportExecState("running");
    cToken = commandTokenGenerator.generateToken();
    sendCommand(`${cToken}-exec-next`)
        .then(async (result) => {
            console.log(result);
            updatePanels(result);
            getFrames();
            heap = await getMemory();
            console.log(heap.memory);
            updateHeap(heap.memory);
            output = await getOutput();
            console.log(output);
            updateOutput(output);
        });
}

function restartButtonAction() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    disableExecButtons();
    reportExecState("running");
    outputElement.innerHTML = "";
    cToken = commandTokenGenerator.generateToken();
    sendCommand(`${cToken}-exec-run`)
        .then(async (result) => {
            console.log(result);
            let framesResult = await sendCommand(`-stack-list-frames`);
            updatePanels(framesResult);
            getFrames();
        });
}

const closeEndpoint = "close";
function closeSession(event) {
    const formData = new FormData();
    formData.append("sessionToken", sessionToken);
    let requestUrl = apiUrl + closeEndpoint;
    navigator.sendBeacon(requestUrl, formData);
}

// Presenter
// This "object" acts as an intermediary between the GUI an dbugger
// For now, it manages the GUI elements directly
// I will design an interface for the GUI elements later.
// That interface will be a kind of state machine

function compileAction() {
    sourceElement.textContent = code;
    Prism.highlightElement(sourceElement);
    codeEditorContainerElement.style.height = "0px";
    codeEditorContainerElement.style.visibility = "hidden";
    sourcePreElement.style.height = "800px";
    sourcePreElement.style.visibility = "visible";
    compileElement.removeEventListener("click", compileAction);
    dbugger.loadProgramRunAndBreakInMain(editor.getValue())
        .then(() => {
            console.log("Line: ", dbugger.programState.lineNum);
            console.log("execState: ", dbugger.programState.execState);
            compileElement.innerHTML = "Edit";
            compileElement.addEventListener("click", editAction);
            updatePanels(dbugger.programState);
            enableExecButtons();
        });
}

function nextAction() {

}

// Presenter ends here

// Test new code

startTime = performance.now();
function executingAt() {
    return (performance.now() - startTime) / 1000;
}

var dbugger = new webDebugger();

dbugger.startDebugger(() => {
    console.log(dbugger.sessionToken);
    console.log("starting debugger... ", executingAt())
    compileElement.addEventListener("click", compileAction);
});

// Test new code ends here

commandElement.addEventListener("change", commandElementChange);
fileField.addEventListener("change", loadFile);
stepElement.addEventListener("click", stepButtonAction);
nextElement.addEventListener("click", nextButtonAction);
restartElement.addEventListener("click", restartButtonAction);
window.addEventListener("unload", closeSession);

// startGdb();

