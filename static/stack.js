function drawVariableLabel(fWidth, variable, index, funFBox, conf) {
    let varLabelWidth = fWidth * (conf.funFrameBoxWidth - 2 * conf.frameHMargin);
    let labelY = conf.frameHeaderHeight + conf.frameVMargin + index * (conf.varLabelHeight + conf.varLabelSep);
    let name = new Label({
        text: variable.name,
        size: 20
    });
    let value = new Label({
        text: variable.value,
        size: 20
    });
    let type = new Label({
        text: variable.type,
        size: 10
    });
    let label = new Container({
    })
        .addTo(funFBox)
        .loc(fWidth * conf.frameHMargin, labelY);
    new Button({
        width: 0.30 * varLabelWidth,
        height: conf.varLabelHeight,
        label: type,
        backgroundColor: conf.canvasBackgroundColor,
        shadowColor: -1,
        corner: 0
    })
        .addTo(label)
        .loc(0, 0);
    new Button({
        width: 0.30 * varLabelWidth,
        height: conf.varLabelHeight,
        label: name,
        backgroundColor: conf.varNameBackgroundColor[index % conf.varNameBackgroundColor.length],
        corner: 5
    })
        .addTo(label)
        .loc(0.30 * varLabelWidth, 0);
    new Button({
        width: 0.40 * varLabelWidth,
        height: conf.varLabelHeight,
        label: value,
        backgroundColor: white,
        borderColor: conf.varNameBackgroundColor[index % conf.varNameBackgroundColor.length],
        corner: 5
    })
        .addTo(label)
        .loc(0.60 * varLabelWidth, 0);
    return label;
}

function drawVariableBox(fWidth, variable, index, firstAddress, stackFBox, conf) {
    let value = new Label({
        text: variable.value,
        size: 10
    });
    let memY = -(firstAddress - variable.address) * conf.pixelsPerByte;
    let box = new Button({
        width: fWidth * conf.stackFrameBoxWidth,
        label: value,
        height: conf.pixelsPerByte * variable.size,
        backgroundColor: conf.varNameBackgroundColor[index % conf.varNameBackgroundColor.length],
        corner: 0
    })
        .addTo(stackFBox)
        .loc(0, memY);
    return box;
}

var wireColors = [red, orange, brown, grey];

function drawWire(container, fWidth, variableLabel, variableBox, funFBox, stackFBox, index, xoffset, conf) {
    let wireX = fWidth * (conf.leftMargin + conf.funFrameBoxWidth + conf.funStackFramesSep / 2);
    let wireY = (funFBox.y + variableLabel.y + stackFBox.y + variableBox.y) / 2;
    let wireTop = stackFBox.y + variableBox.y - wireY + conf.pixelsPerByte / 2;
    let wireBottom = funFBox.y + conf.varLabelHeight / 2 + variableLabel.y - wireY;
    let wireHalfHeight = (wireTop - wireBottom) / 4;
    let wire = new Squiggle({
        thickness: 2,
        points: [
            [fWidth * (-conf.funStackFramesSep / 2 - conf.frameHMargin), funFBox.y + conf.varLabelHeight / 2 + variableLabel.y - wireY, 0, 0, 0, 0, 0.017 * fWidth, 0],
            [xoffset, 0, 0, 0, 0, -wireHalfHeight, 0, wireHalfHeight],
            [fWidth * (conf.funStackFramesSep / 2), stackFBox.y + variableBox.y - wireY + conf.pixelsPerByte / 2, 0, 0, -0.017 * fWidth, 0, 0, 0]],
        showControls: false,
        lockControls: true,
        color: conf.varNameBackgroundColor[index % conf.varNameBackgroundColor.length],
    })
        .loc(wireX, wireY)
        .addTo(container);
    return wire;
}

function drawFunctionFrameBox(container, fWidth, vpos, frame, conf) {
    let variables = frame.variables;
    let funFrameBox = new Rectangle({
        color: "rgba(0,0,0,0)",
        borderColor: conf.frameBorderColor,
        width: fWidth * conf.funFrameBoxWidth,
        height: (conf.varLabelSep + conf.varLabelHeight) * variables.length + conf.frameHeaderHeight + conf.frameVMargin
    })
        .loc(fWidth * conf.leftMargin, conf.topMargin + vpos)
        .addTo(container);
    let frameHeader = new Rectangle({
        color: conf.frameTitleBackgroundColor,
        width: fWidth * conf.funFrameBoxWidth,
        height: conf.frameHeaderHeight
    })
        .addTo(funFrameBox);
    let functionLabel = new Label({
        text: frame.frameInfo.func,
        size: 20,
        color: white
    })
        .addTo(frameHeader);
    return funFrameBox;
}

function stackSizeInBytes(frame) {
    let variables = frame.variables;
    console.log(`max: ${maxAddress(variables)} min: ${minAddress(variables)} last: ${lastVarSize(variables)}`);
    return (variables.length > 0) ? maxAddress(variables) - minAddress(variables) + lastVarSize(variables) : 0;
}

function drawStackFrameBox(container, fWidth, topAddress, frame, conf) {
    let variables = frame.variables;
    let numOfVars = variables.length;
    let firstAddress = (numOfVars > 0) ? minAddress(variables) : null;
    let stackFrameHeight = stackSizeInBytes(frame) * conf.pixelsPerByte;
    console.log(`frame: ${frame.frameInfo.func} size: ${stackSizeInBytes(frame)} height: ${stackFrameHeight}`);
    let stackFrame = new Rectangle({
        color: "rgba(0,0,0,0)",
        borderColor: red,
        width: fWidth * conf.stackFrameBoxWidth,
        height: stackFrameHeight
    })
        .loc(fWidth * (conf.leftMargin + conf.funFrameBoxWidth + conf.funStackFramesSep),
            conf.topMargin + ((numOfVars > 0) ? (firstAddress - topAddress) * conf.pixelsPerByte : 0))
        .addTo(container);
    return stackFrame;
}

function minAddress(variables) {
    let madd = Infinity;
    if (variables.length > 0) {
        for (let variable of variables) {
            let numAddress = parseInt(variable.address, 16);
            if (numAddress < madd) {
                madd = numAddress;
            }
        }
    }
    return madd;
}

function maxAddress(variables) {
    let madd = 0;
    if (variables.length > 0) {
        for (let variable of variables) {
            let numAddress = parseInt(variable.address, 16);
            if (numAddress > madd) {
                madd = numAddress;
            }
        }
    }
    return madd;
}

function lastVarSize(variables) {
    let madd = 0;
    let lvs = 0;
    if (variables.length > 0) {
        for (let variable of variables) {
            let numAddress = parseInt(variable.address, 16);
            if (numAddress > madd) {
                madd = numAddress;
                lvs = parseInt(variable.size);
            }
        }
    }
    return lvs;
}

function drawFunFrame(container, width, vpos, topAddress, frame, conf) {
    let variables = frame.variables;
    let funFrameBox = drawFunctionFrameBox(container, width, vpos, frame, conf);
    let stackFrameBox = drawStackFrameBox(container, width, topAddress, frame, conf);
    let index = 0;
    for (let variable of variables) {
        let label = drawVariableLabel(width, variable, index, funFrameBox, conf);
        let box = drawVariableBox(width, variable, index, minAddress(variables), stackFrameBox, conf);
        let wire = drawWire(container, width, label, box, funFrameBox, stackFrameBox, index, 3 * index, conf);
        index = index + 1;
    }
    return vpos + funFrameBox.height + conf.funStackFramesVSep;
}

function createFunContainer(stage) {
    let tlc = new Container().addTo(stage);
    return tlc;
}

function createFunFrame(canvasBackgroundColor) {
    var frame = new Frame("holder", 690, 525, canvasBackgroundColor); // see docs for more options and info
    return frame;
}

export { createFunFrame, createFunContainer, drawFunFrame };