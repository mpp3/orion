// SCALING OPTIONS
// scaling can have values as follows with full being the default
// "fit"		sets canvas and stage to dimensions and scales to fit inside window size
// "outside"	sets canvas and stage to dimensions and scales to fit outside window size
// "full"		sets stage to window size with no scaling
// "tagID"		add canvas to HTML tag of ID - set to dimensions if provided - no scaling

class Variable {
    constructor(name, value, type, address, size) {
        this.name = name;
        this.value = value;
        this.type = type;
        this.address = address;
        this.size = size;
    }
}

var variables = [
    new Variable("a", 1, "int", 100, 4),
    new Variable("x", "hello", "string", 108, 32),
    new Variable("other", 2.75, "double", 140, 8)
];

var funFrameConfig = {
    pixelsPerByte: 5,
    varLabelHeight: 20,
    varLabelSep: 5,
    topMargin: 10,
    leftMargin: 10,
    frameMargin: 5,
    frameHeaderHeight: 30,
    funFrameBoxWidth: 190,
    stackFrameBoxWidth: 160,
    funStackFramesSep: 20
};

function drawVariableLabel(variable, index, funFBox, conf) {
    let varLabelWidth = conf.funFrameBoxWidth - 2 * conf.frameMargin;
    let labelY = conf.frameHeaderHeight + conf.frameMargin + index * (conf.varLabelHeight + conf.varLabelSep);
    let name = new Label({
        text: variable.name,
        size: 20
    });
    let value = new Label({
        text: variable.value,
        size: 10
    });
    let type = new Label({
        text: variable.type,
        size: 10
    });
    let label = new Container({
        width: varLabelWidth,
        height: conf.varLabelHeight,
    })
        .addTo(funFBox)
        .loc(conf.frameMargin, labelY);
    new Button({
        width: 0.30 * varLabelWidth,
        height: conf.varLabelHeight,
        label: name,
        corner: 5
    })
        .addTo(label)
        .loc(0, 0);
    new Button({
        width: 0.40 * varLabelWidth,
        height: conf.varLabelHeight,
        label: value,
        backgroundColor: frame.grey,
        corner: 0
    })
        .addTo(label)
        .loc(0.30 * varLabelWidth, 0);
    new Button({
        width: 0.30 * varLabelWidth,
        height: conf.varLabelHeight,
        label: type,
        backgroundColor: frame.grey,
        corner: 0
    })
        .addTo(label)
        .loc(0.70 * varLabelWidth, 0);
    return label;
}

function drawVariableBox(variable, firstAddress, stackFBox, conf) {
    let value = new Label({
        text: variable.value,
        size: 10
    });
    let memY = (variable.address - firstAddress) * conf.pixelsPerByte;
    let box = new Button({
        width: conf.stackFrameBoxWidth,
        label: value,
        height: conf.pixelsPerByte * variable.size,
        backgroundColor: frame.grey,
        corner: 0
    })
        .addTo(stackFBox)
        .loc(0, memY);
    return box;
}

function drawWire(variableLabel, variableBox, funFBox, stackFBox, conf) {
    let wireX = conf.leftMargin + conf.funFrameBoxWidth + conf.funStackFramesSep / 2;
    let wireY = (variableLabel.y + stackFBox.y + variableBox.y) / 2;
    let wire = new Squiggle({
        thickness: 2,
        points: [
            [-conf.funStackFramesSep / 2 - conf.frameMargin, funFBox.y + conf.varLabelHeight / 2 + variableLabel.y - wireY, 0, 0, 0, 0, 30, 0],
            [conf.funStackFramesSep / 2, stackFBox.y + variableBox.y - wireY + conf.pixelsPerByte / 2, 0, 0, -30, 0, 0, 0]],
        showControls: false,
        lockControls: true,
        color: frame.grey
    })
        .loc(wireX, wireY)
        .addTo();
    return wire;
}

function drawFunctionFrameBox(variables, conf) {
    let funFrameBox = new Rectangle({
        color: "rgba(0,0,0,0)",
        borderColor: frame.red,
        width: conf.funFrameBoxWidth,
        height: (conf.varLabelSep + conf.varLabelHeight) * variables.length + conf.frameHeaderHeight + conf.frameMargin
    })
        .loc(conf.leftMargin, conf.topMargin)
        .addTo();
    let frameHeader = new Rectangle({
        color: frame.red,
        width: conf.funFrameBoxWidth,
        height: conf.frameHeaderHeight
    })
        .addTo(funFrameBox);
    let functionLabel = new Label({
        text: "main",
        size: 20,
        color: frame.white
    })
        .addTo(frameHeader);
    return funFrameBox;
}

function drawStackFrameBox(variables, conf) {
    let firstAddress = variables[0].address;
    let numOfVars = variables.length;
    let lastVar = (numOfVars > 0) ? variables[numOfVars - 1] : null;
    let stackFrameHeight = lastVar ? (lastVar.address - firstAddress + lastVar.size) * conf.pixelsPerByte : 0;
    let stackFrame = new Rectangle({
        color: "rgba(0,0,0,0)",
        borderColor: frame.red,
        width: conf.stackFrameBoxWidth,
        height: stackFrameHeight
    })
        .loc(conf.leftMargin + conf.funFrameBoxWidth + conf.funStackFramesSep, conf.topMargin)
        .addTo();
    return stackFrame;
}

function drawFunFrame(variables, conf) {
    let funFrameBox = drawFunctionFrameBox(variables, conf);
    let stackFrameBox = drawStackFrameBox(variables, conf);
    let index = 0;
    for (variable of variables) {
        let label = drawVariableLabel(variable, index, funFrameBox, conf);
        let box = drawVariableBox(variable, variables[0].address, stackFrameBox, conf);
        let wire = drawWire(label, box, funFrameBox, stackFrameBox, conf);
        index = index + 1;
    }
}

var scaling = "holder"; // use the ID of a tag to place the canvas in the tag
var width = 400; // can go higher...
var height = 368;
var color = brown; // ZIM colors now available globally
var frame = new Frame(scaling, width, height, color); // see docs for more options and info
frame.on("ready", function () {
    zog("ready from ZIM Frame");
    zog(frame.canvasID)
    var stage = frame.stage;
    drawFunFrame(variables, funFrameConfig);
    stage.update();
}); // end of ready

