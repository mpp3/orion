import os
import json

from pygdbmi import gdbmiparser
from pygdbmi.gdbcontroller import GdbController

from pprint import pprint

from flask import Flask, flash, redirect, url_for
from flask import request, jsonify
from werkzeug.utils import secure_filename

workdir = 'workdir'
outObjName = 'a.out'
memFileName = 'mem.txt'


def produceObj(filename, sessionToken):
    compileCommand = f'g++ -g -std=c++11 -I. -Iinclude {os.path.join(workdir, sessionToken, filename)} -o {os.path.join(workdir, sessionToken, outObjName)}'
    os.system(compileCommand)


def processFile(path, filename, sessionToken):
    print('Filename is ', filename)
    os.system(f'mkdir {os.path.join(workdir, sessionToken)}')
    os.system(f'touch {os.path.join(workdir, sessionToken, memFileName)}')
    os.system(
        f'mv {os.path.join(path, filename)} {os.path.join(workdir, sessionToken, filename)}'
    )
    produceObj(filename, sessionToken)


class SessionTokenGenerator():
    def __init__(self):
        self.nextSessionToken = 0

    def generateSessionToken(self):
        self.nextSessionToken = self.nextSessionToken + 1
        return self.nextSessionToken


UPLOAD_FOLDER = workdir

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

sessionTokenGenerator = SessionTokenGenerator()
gdbmis = dict()


@app.route('/start')
def start():
    sessionToken = str(sessionTokenGenerator.generateSessionToken())
    gdbmis[sessionToken] = GdbController()
    return {'sessionToken': sessionToken}

@app.route('/file', methods=['GET', 'POST'])
def index():
    if request.method == 'POST':
        sessionToken = request.form['sessionToken']
        print(f'sessionToken received by index(): {sessionToken}')
        if sessionToken == '':
            sessionToken = str(sessionTokenGenerator.generateSessionToken())
            gdbmis[sessionToken] = GdbController()
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
            response = gdbmis[sessionToken].write(f'cd {os.path.join(workdir, sessionToken)}')
            response.extend(gdbmis[sessionToken].write(
                f'-file-exec-and-symbols {outObjName}'
            ))
            response.extend(gdbmis[sessionToken].write(
                f'skip -gfi /usr/include/c++/7/bits/*.h'))
            response.extend(gdbmis[sessionToken].write(f'skip -gfi dyno.h'))
            response.extend(gdbmis[sessionToken].write(f'skip -rfu ^__.*'))
            response.extend(gdbmis[sessionToken].write(f'-break-insert main'))
            response.extend(gdbmis[sessionToken].write(f'-exec-run'))
            pprint(response)
            return {'sessionToken': sessionToken, 'response': response}
    else:
        return redirect('static/index.html')


@app.route('/hello/<name>/')
def hello_world(name):
    return f'Hello, {name}'


@app.route('/command')
def send_command():
    sessionToken = request.args.get('sessionToken')
    command = request.args.get('command')
    response = gdbmis[sessionToken].write(command,
                                          raise_error_on_timeout=False)
    return jsonify(response)


@app.route('/memory')
def get_memory():
    sessionToken = request.args.get('sessionToken')
    with open(os.path.join(workdir, sessionToken, memFileName), encoding='ascii') as memoryFile:
        memory = json.load(memoryFile)
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