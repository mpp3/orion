console.log("gdbmife loaded");

const apiUrl = "http://localhost:5000/";

const commandElement = document.getElementById("command");
const fileField = document.getElementById("file");
const sourceElement = document.getElementById("source");
const stateElement = document.getElementById("state");
const sourcePreElement = document.getElementById("sourcecode");
const sourcePanelElement = document.getElementById("source-panel");
const stepElement = document.getElementById("step");
const nextElement = document.getElementById("next");
const restartElement = document.getElementById("restart");
const stackElement = document.getElementById("stack");

var sessionToken = 0;
var lineNum = 0;

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

function enableExecButtons()
{
    stepElement.removeAttribute("disabled");
    nextElement.removeAttribute("disabled");
    restartElement.removeAttribute("disabled");
}

function disableExecButtons()
{
    stepElement.setAttribute("disabled", "");
    nextElement.setAttribute("disabled", "");
    restartElement.setAttribute("disabled", "");
}

function updateSourceCode(dic) {
    if (dic.message === "stopped") {
        if (dic.payload.hasOwnProperty("frame")) {
            lineNum = dic.payload.frame.line;
        }
        if (dic.payload.hasOwnProperty("reason")) {
            if (dic.payload.reason === "exited-normally") {
                stateElement.innerHTML = "exited normally";
                stateElement.classList.remove("c-button--warning");
                stateElement.classList.add("c-button--success")
            }
            else if (dic.payload.reason === "exited") {
                stateElement.innerHTML = "exited with errors";
                stateElement.classList.remove("c-button--warning");
                stateElement.classList.add("c-button--error");
            }
            else {
                stateElement.innerHTML = "running program - next line: " + lineNum;
                dataLine = sourcePreElement.setAttribute("data-line", lineNum);
                Prism.highlightElement(sourceElement);
                let lnr = document.getElementsByClassName("line-numbers-rows")[0];
                let targetLine = (lineNum > 5) ? lineNum - 5 : lineNum;
                let atLine = lnr.children[targetLine - 1];
                atLine.scrollIntoView();
            }
        }
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
    let file = fileField.files[0];
    var fr = new FileReader();
    fr.onload = function () {
        sourceElement.textContent = this.result;
        console.log(sourceElement.textContent);
        Prism.highlightElement(sourceElement);
    };
    fr.readAsText(file);
}

// Send file to debug
const fileEndpoint = "file";
function sendFile() {
    const formData = new FormData();
    formData.append("sessionToken", sessionToken)
    formData.append("file", fileField.files[0]);
    fetch(apiUrl + fileEndpoint, {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(result => {
            console.log(result);
            stateElement.innerHTML = "running program";
            stateElement.classList.add("c-button--warning");
            updatePanels(result["response"]);
            enableExecButtons();
        });
}

function loadAndSendFile() {
    let fileNameElement = document.getElementById("file-name");
    fileNameElement.innerHTML = `${fileField.files[0].name}`;
    loadFile();
    sendFile();
}

// Send command to debugger
const commandEndpoint = "command"
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
            drawFrames(framesMap);
            enableExecButtons();
        });
}

function stepButtonAction() {
    disableExecButtons();
    cToken = commandTokenGenerator.generateToken();
    sendCommand(`${cToken}-exec-step`)
        .then(result => {
            console.log(result);
            updatePanels(result);
            getFrames();
        });
}

function nextButtonAction() {
    disableExecButtons();
    cToken = commandTokenGenerator.generateToken();
    sendCommand(`${cToken}-exec-next`)
        .then(result => {
            console.log(result);
            updatePanels(result);
            getFrames();
        });
}

function restartButtonAction() {
    disableExecButtons();
    cToken = commandTokenGenerator.generateToken();
    sendCommand(`${cToken}-exec-run`)
        .then(result => {
            console.log(result);
            stateElement.innerHTML = "running program";
            stateElement.classList.remove("c-button--error");
            stateElement.classList.remove("c-button--success");
            stateElement.classList.add("c-button--warning");
            updatePanels(result);
            getFrames();
        });
}

commandElement.addEventListener("change", commandElementChange);
fileField.addEventListener("change", loadAndSendFile);
stepElement.addEventListener("click", stepButtonAction);
nextElement.addEventListener("click", nextButtonAction);
restartElement.addEventListener("click", restartButtonAction);

startGdb();
