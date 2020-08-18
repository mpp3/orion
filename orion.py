# Version 0.3.1

import time

import sys
import os
import json
import subprocess
import shutil

from pygdbmi import gdbmiparser
from pygdbmi.gdbcontroller import GdbController

from pprint import pprint

from flask import Flask, flash, redirect, url_for
from flask import request, jsonify
from werkzeug.utils import secure_filename


class Timer:
    def __init__(self, logFilename):
        self.logFilename = logFilename

    def start(self):
        self.startTime = time.time()
        self.startProcessTime = time.process_time()

    def stop(self, labels):
        self.elapsed = time.process_time() - self.startProcessTime
        self.endTime = time.time()
        with open(self.logFilename, 'a') as logFile:
            logFile.write(f'{self.startTime},{self.endTime},{self.elapsed}')
            for label in labels:
                logFile.write(f',{label}')
            logFile.write('\n')


with open('orionconf.json') as orionconfFile:
    orionconfContents = orionconfFile.read()

orionconf = json.loads(orionconfContents)

gdbpath = orionconf['gdbpath']
homedir = orionconf['homedir']
logFileName = 'log.txt'
workdir = os.path.join(homedir, 'workdir')
includedir = os.path.join(homedir, 'include')
outObjName = 'a.out'
memFileName = 'mem.txt'
outputFileName = 'output.txt'


def produceObj(filename, sessionToken):
    compileCommand = f'/usr/bin/x86_64-linux-gnu-g++-7 -g -std=c++11 -I{includedir} {os.path.join(workdir, sessionToken, filename)} -o {os.path.join(workdir, sessionToken, outObjName)}'
    with open(logFileName, 'a') as logfile:
        logfile.write(compileCommand)
        logfile.write('\n')
        myenv = os.environ.copy()
        path = '/usr/bin:/usr/sbin:/sbin/bin:/home/ubuntu/.local/bin:/usr/local/bin:/usr/local/sbin' 
        myenv['PATH'] = path + myenv['PATH']
        subprocess.run(args=compileCommand, shell=True,check=True,stderr=logfile,env=myenv)


def processFile(path, filename, sessionToken):
    destFolder = os.path.join(workdir, sessionToken)
    with open(logFileName, 'a') as logfile:
        logfile.write(f'Processing file {filename}.\n')
        logfile.write(f'Current directory is {os.getcwd()}.\n')
        logfile.write(f'Destination folder is {destFolder}.\n')
        logfile.write(f'Create file {os.path.join(workdir, sessionToken, memFileName)}.\n')
    print('Filename is ', filename)
    if os.path.exists(destFolder):
        shutil.rmtree(destFolder)
    os.mkdir(destFolder)
    with open(os.path.join(workdir, sessionToken, memFileName), 'a') as memfile:
        pass
    os.replace(os.path.join(path, filename), os.path.join(workdir, sessionToken, filename))
#    os.system(f'touch {os.path.join(workdir, sessionToken, memFileName)}')
#    os.system(
#        f'mv {os.path.join(path, filename)} {os.path.join(workdir, sessionToken, filename)}'
#    )
    produceObj(filename, sessionToken)


class SessionTokenGenerator():
    def __init__(self):
        self.nextSessionToken = 0

    def generateSessionToken(self):
        self.nextSessionToken = self.nextSessionToken + 1
        return self.nextSessionToken


timer = Timer(logFileName)

UPLOAD_FOLDER = workdir

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

sessionTokenGenerator = SessionTokenGenerator()
gdbmis = dict()

#/ ProgramState
#/ sourceCode: source code of the program being run
#/ execState: string representing the execution state of the program; one of:
#/ - stopped
#/ - running
#/ lineNum: next line to be executed?
#/ frames: list of objects representing the frames. Every frame is an object with members:
#/ - frameInfo: an object with these fields (all fields are strings):
#/   * addr: string with starting address of the frame as an hex number
#/   * file: name of the file with the source code of the function this frame belongs to
#/   * fullname: absolute path to the source file including the file name.
#/   * func: name of the function this frame belongs to.
#/   * level: level of the frame in the call stack.
#/   * line: current line being executed.
#/ - variables: array in which each element is an object representing a variable with members (all members are strings):
#/   * name
#/   * value
#/   * type


class ProgramState:
    def __init__(self):
        self.sourceCode = ''
        self.execState = ''
        self.lineNum = 0
        self.frames = []
        self.heap = []
        self.output = ''


# Dictionary of ProgramState objects indexed by session tokens
programState = dict()

@app.route('/start')
def start():
    sessionToken = str(sessionTokenGenerator.generateSessionToken())
    gdbmis[sessionToken] = GdbController(gdb_path=gdbpath)
    programState[sessionToken] = dict()
    with open(logFileName, 'w') as logfile:
        logfile.write(f'Spawned GDB instance with token {sessionToken}.')
    return {'sessionToken': sessionToken}


@app.route('/code', methods=['GET', 'POST'])
def code():
    logfile = open(logFileName, 'a')
    if request.method == 'POST':
        sessionToken = request.form['sessionToken']
        sys.stderr.write(f'sessionToken received by code(): {sessionToken}')
        print(f'sessionToken received by index(): {sessionToken}')
        if sessionToken == '':
            sessionToken = str(sessionTokenGenerator.generateSessionToken())
            gdbmis[sessionToken] = GdbController(gdb_path=gdbpath)
            programState[sessionToken] = dict()
        if 'code' not in request.form:
            flash('No code part')
            return redirect('/static/index.html')
        code = request.form['code']
        if len(code) == 0:
            flash('Empty code')
            return redirect('/static/index.html')
        if code:
            fullFilename = os.path.join(app.config['UPLOAD_FOLDER'],
                                        sessionToken + "_upload.cpp")
            with open(fullFilename, "w") as sourcefile:
                sourcefile.write(code)
            processFile(app.config['UPLOAD_FOLDER'],
                        sessionToken + "_upload.cpp", sessionToken)
            response = gdbmis[sessionToken].write(
                f'cd {os.path.join(workdir, sessionToken)}')
            response.extend(gdbmis[sessionToken].write(
                f'-file-exec-and-symbols {outObjName}'))
            response.extend(gdbmis[sessionToken].write(
                f'skip -gfi /usr/include/c++/7/bits/*.h'))
            response.extend(gdbmis[sessionToken].write(f'skip -gfi dyno.h'))
            response.extend(gdbmis[sessionToken].write(f'skip -rfu ^__.*'))
            response.extend(gdbmis[sessionToken].write(f'-break-insert main'))
            response.extend(gdbmis[sessionToken].write(f'-exec-run'))
            logfile.close()
            return {'sessionToken': sessionToken, 'response': response}
    else:
        logfile.write('code(): I can only answer to POST requests.')
        logfile.close()
        return redirect('static/index.html')
    


@app.route('/file', methods=['GET', 'POST'])
def index():
    if request.method == 'POST':
        sessionToken = request.form['sessionToken']
        print(f'sessionToken received by index(): {sessionToken}')
        if sessionToken == '':
            sessionToken = str(sessionTokenGenerator.generateSessionToken())
            gdbmis[sessionToken] = GdbController(gdb_path=gdbpath)
            programState[sessionToken] = dict()
        if 'file' not in request.files:
            flash('No file part')
            return redirect('/static/index.html')
        file = request.files['file']
        if file.filename == '':
            flash('No selected file')
            return redirect('/static/index.html')
        if file:
            filename = secure_filename(file.filename)
            fullFilename = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(fullFilename)
            processFile(app.config['UPLOAD_FOLDER'], filename, sessionToken)
            response = gdbmis[sessionToken].write(
                f'cd {os.path.join(workdir, sessionToken)}')
            response.extend(gdbmis[sessionToken].write(
                f'-file-exec-and-symbols {outObjName}'))
            response.extend(gdbmis[sessionToken].write(
                f'skip -gfi /usr/include/c++/7/bits/*.h'))
            response.extend(gdbmis[sessionToken].write(f'skip -gfi dyno.h'))
            response.extend(gdbmis[sessionToken].write(f'skip -rfu ^__.*'))
            response.extend(gdbmis[sessionToken].write(f'-break-insert main'))
            response.extend(gdbmis[sessionToken].write(f'-exec-run'))
            # pprint(response)
            return {'sessionToken': sessionToken, 'response': response}
    else:
        return redirect('static/index.html')


@app.route('/hello/<name>/')
def hello_world(name):
    return f'Hello, {name}'


@app.route('/command')
def get_command():
    logfile = open(logFileName, 'a')
    timer.start()
    sessionToken = request.args.get('sessionToken')
    command = request.args.get('command')
    response = gdbmis[sessionToken].write(command,
                                          raise_error_on_timeout=False)
    timer.stop(['gdbmis.py', command])
    logfile.write(f'Sent {command} to GDB instance {sessionToken}.\n')
    logfile.write(f'Reponse from GDB: {response}.\n')
    logfile.close()
    return jsonify(response)


@app.route('/variable')
def get_variable():
    logfile = open(logFileName, 'a')
    timer.start()
    sessionToken = request.args.get('sessionToken')
    varName = request.args.get('name')
    frame = request.args.get('frame')
    addressResponse = gdbmis[sessionToken].write(
        f'-data-evaluate-expression --thread 1 --frame {frame} &{varName}')
    sizeResponse = gdbmis[sessionToken].write(
        f'-data-evaluate-expression --thread 1 --frame {frame} sizeof({varName})'
    )
    timer.stop(['gdbmis.py', varName])
    logfile.write(f'Got info for variable {varName}\n')
    logfile.write(f'Address: {addressResponse}. Size: {sizeResponse}.\n')
    logfile.close()
    return {'address': addressResponse, 'size': sizeResponse}


@app.route('/output')
def get_output():
    timer.start()
    sessionToken = request.args.get('sessionToken')
    with open(os.path.join(workdir, sessionToken, outputFileName),
              encoding='ascii') as outputFile:
        output = outputFile.read().splitlines()
    timer.stop(['gdbmis.py', 'output'])
    return {'sessionToken': sessionToken, 'output': output}


@app.route('/memory')
def get_memory():
    timer.start()
    sessionToken = request.args.get('sessionToken')
    memory = ""
    with open(os.path.join(workdir, sessionToken, memFileName),
              encoding='ascii') as memoryFile:
        try:
            memory = json.load(memoryFile)
        except:
            print("Memory file is empty?")
    timer.stop(['gdbmis.py', 'memory'])
    return {'sessionToken': sessionToken, 'memory': memory}


@app.route('/close', methods=['GET', 'POST'])
def close_session():
    if request.method == 'POST':
        sessionToken = request.form['sessionToken']
        print(f'Closing session with token {sessionToken}')
        try:
            gdbmis[sessionToken].exit()
            del gdbmis[sessionToken]
            os.system(f'rm -rf {os.path.join(workdir, sessionToken)}')
            response = f'Session with token {sessionToken} closed.'
        except KeyError:
            response = f'Tried to close inexistent session with token: {sessionToken}'
        finally:
            print(response)
            return ""
    else:
        return ""

# This is the new code

def command(command, token, message="done"):
    logfile = open(logFileName, 'a')
    logfile.write(f'Sent command {command} to GDB instance {token}.\n')
    timer.start()
    logfile.write(f'There are {len(gdbmis)} instances.\n')
    ans = gdbmis[token].write(command, expected_message=message, raise_error_on_timeout=False)
    timer.stop(['gdbmis',command])
    logfile.write(f'Response: {ans}.\n')
    logfile.close()
    return ans

def updateState(token, response):
    for record in response:
        if record['message'] == 'stopped':
            if 'frame' in record['payload']:
                programState[token]['lineNum'] = record['payload']['frame']['line']
            if 'reason' in record['payload']:
                if record['payload']['reason'] == "exited-normally":
                    programState[token]['execState'] = "exited-normally"
                elif record['payload']['reason'] == "exited":
                    programState[token]['execState'] = "exited"
                else:
                    programState[token]['execState'] = "stopped"
        elif (record['message'] == 'done') and ('payload' in record) and ('bkpt' in record['payload']):
            programState[token]['lineNum'] = record['payload']['bkpt']['line']
            programState[token]['execState'] = "stopped"

def makeStep(token):
    with open(logFileName, 'a') as logfile:
        logfile.write('This is makeStep')
        stepResponse = command('-exec-step', token, "stopped")
        logfile.write(f'Executed -exec-step, and got {stepResponse}\n')
        updateState(token, stepResponse)
        logfile.write(f'State updated for instance {token}\n')
        logfile.close()

def getVarPos(name, variables):
    counter = 0
    for var in variables:
        if var['name'] == name:
            return counter
        counter = counter + 1

def updateFrames(token):
    logfile = open(logFileName, 'a')
    framesMap = dict()
    framesList = []
    slResponse = command('-stack-list-frames', token)
    if 'stack' in slResponse[0]['payload']:
        flResponse = slResponse[0]['payload']['stack']
        for frame in flResponse:
            level = frame['level']
            framesMap[level] = {'frameInfo': frame, 'variables': []}
            
            vlResponse = command(f'-stack-list-variables --thread 1 --frame {level} --all-values', token)
            framesMap[level]['variables'] = vlResponse[0]['payload']['variables']
            vl2Response = command(f'-stack-list-variables --thread 1 --frame {level} --simple-values', token)
            pprint(vl2Response)
            for index in range(len(vl2Response[0]['payload']['variables'])):
                print(index)
                var = vl2Response[0]['payload']['variables'][index]
                framesMap[level]['variables'][index]['type'] = var['type']
                addressResponse = command(f'-data-evaluate-expression --thread 1 --frame {level} &{var["name"]}', token)
                if "value" in addressResponse[0]["payload"]:
                    framesMap[level]['variables'][index]['address'] = addressResponse[0]["payload"]["value"]
                sizeResponse = command(f'-data-evaluate-expression --thread 1 --frame {level} sizeof({var["name"]})', token)
                if "value" in sizeResponse[0]["payload"]:
                    framesMap[level]['variables'][index]['size'] = sizeResponse[0]["payload"]["value"]
    for frame in sorted(framesMap):
        framesList.append(framesMap[frame])
    programState[token]['frames'] = framesList
    logfile.write(f'Read frames from GDB instance {token}.\n')
    logfile.write(f'Frames: {framesList}\n')
    logfile.close()

def updateMemory(token):
    logfile = open(logFileName, 'a')
    memory = ''
    with open(os.path.join(workdir, token, memFileName), encoding='ascii') as memoryFile:
        try:
            memory = json.load(memoryFile)
        except:
            print('Memory file is empty')
            logfile.write('Memory file is empty\n')
    programState[token]['heap'] = memory
    logfile.write('Memory file written in programState.\n')
    logfile.write(f'Memory data: {memory}\n')
    logfile.close()

def updateOutput(token):
    output = ''
    with open(os.path.join(workdir, token, outputFileName), encoding='ascii') as outputFile:
        output = outputFile.read().splitlines()
    programState[token]['output'] = output

@app.route('/step')
def get_step():
    timer.start()
    with open(logFileName, 'a') as logfile:
        logfile.write('This is get_step()\n')
        sessionToken = request.args.get('sessionToken')
        logfile.write(f'Starting get_step() with token {sessionToken}\n')
        makeStep(sessionToken)
        logfile.write(f'makeStep({sessionToken}) executed.\n')
        updateFrames(sessionToken)
        logfile.write(f'updateFrames({sessionToken}) executed.\n')
        updateMemory(sessionToken)
        logfile.write(f'updateMemory({sessionToken}) executed.\n')
        updateOutput(sessionToken)
        logfile.write(f'updateOutput({sessionToken}) executed.\n')
        timer.stop(['gdbmis.py', 'step'])
        return {
            'sessionToken': sessionToken,
            'programState': programState[sessionToken]
        }

if __name__ == '__main__':
    app.run()
