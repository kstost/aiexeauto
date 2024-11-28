import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { spawn, spawnSync } from 'child_process';
import { getAbsolutePath, getAppPath, isWindows, getConfiguration } from './system.js';

export async function executeInContainer(containerId, command) {
    if (isWindows()) throw new Error('Windows에서는 지원하지 않습니다.');
    if (command.includes('"')) {
        return {
            output: '',
            stdout: '',
            stderr: '쌍따옴표는 허용되지 않습니다',
            code: 1,
            error: new Error('쌍따옴표는 허용되지 않습니다')
        };
    }
    return await executeCommand('docker exec "' + containerId + '" /bin/sh -c "' + command + '"')
}

function parseCommandLine(cmdline) {
    if (isWindows()) throw new Error('Windows에서는 지원하지 않습니다.');
    let args = [];
    let currentArg = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let escapeNext = false;

    for (let i = 0; i < cmdline.length; i++) {
        let c = cmdline[i];

        if (escapeNext) {
            currentArg += c;
            escapeNext = false;
        } else if (c === '\\' && !inSingleQuote) {
            escapeNext = true;
        } else if (c === "'" && !inDoubleQuote) {
            inSingleQuote = !inSingleQuote;
            // Do not include the quote in the argument
        } else if (c === '"' && !inSingleQuote) {
            inDoubleQuote = !inDoubleQuote;
            // Do not include the quote in the argument
        } else if (/\s/.test(c) && !inSingleQuote && !inDoubleQuote) {
            if (currentArg.length > 0) {
                args.push(currentArg);
                currentArg = '';
            }
        } else {
            currentArg += c;
        }
    }

    if (escapeNext) {
        throw new Error('Invalid command line: Ends with a single backslash');
    }

    if (inSingleQuote || inDoubleQuote) {
        throw new Error('Invalid command line: Mismatched quotes');
    }

    if (currentArg.length > 0) {
        args.push(currentArg);
    }

    if (args.length === 0) {
        throw new Error('No command found');
    }

    let command = args.shift();
    return { command, args };
}

export function executeCommandSync(command, args = []) {
    if (isWindows()) throw new Error('Windows에서는 지원하지 않습니다.');
    const result = spawnSync(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        encoding: 'utf-8',
        shell: true
    });

    return {
        output: result.stderr + '\n\n' + result.stdout,
        stdout: result.stdout,
        stderr: result.stderr,
        code: result.status,
        error: result.error
    };
}

export async function executeCommand(command, args = []) {
    const khongLog = true;
    if (isWindows()) throw new Error('Windows에서는 지원하지 않습니다.');
    return new Promise((resolve, reject) => {
        const result = parseCommandLine(command);
        const child = spawn(result.command, result.args, {
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: false
        });

        let stdout = '';
        let stderr = '';
        let output = '';

        child.stdout.on('data', (data) => {
            if (!khongLog) console.log('execution_stdout', data.toString());
            const str = data.toString();
            stdout += str;
            output += str;
        });

        child.stderr.on('data', (data) => {
            if (!khongLog) console.log('execution_stderr', data.toString());
            const str = data.toString();
            stderr += str;
            output += str;
        });

        child.on('error', (error) => {
            if (!khongLog) console.log('execution_error', error);
            reject(error);
        });
        child.on('exit', (code) => {
            if (!khongLog) console.log('execution_exit', code);
        });

        child.on('close', (code) => {
            if (!khongLog) console.log('execution_close', code);
            resolve({
                stdout,
                stderr,
                output,
                code,
                error: code !== 0 ? new Error('Command failed') : null
            });
        });
    });
}

export async function importToDocker(containerId, workDir, inputDir) {
    let result = await executeInContainer(containerId, 'mkdir -p ' + workDir);
    if (result.code !== 0) throw new Error('작업 디렉토리 생성 실패');

    result = await executeCommand('docker cp "' + inputDir + '/." "' + containerId + ':' + workDir + '"');
    if (result.code !== 0) throw new Error('input 폴더 복사 실패');
}

export async function exportFromDocker(containerId, workDir, outputDir) {
    const prefixName = 'AIEXE-data-handling-';
    const removeList = [
        'node_modules', '.git', '.vscode',
        'AIEXE-data-handling-tmpfile.tar',
        'AIEXE-data-handling-exportData.js',
        'AIEXE-data-handling-operation.js',
        'package-lock.json', 'package.json'
    ];

    let result;

    for (const item of removeList) {
        result = await executeInContainer(containerId, `rm -rf ${workDir}/${item}`);
        if (result.code !== 0) throw new Error(`${item} 삭제 실패`);
    }

    result = await executeInContainer(containerId, `rm -rf ${workDir}/${prefixName}*`);
    if (result.code !== 0) throw new Error('임시 파일 삭제 실패');


    result = await executeCommand('docker cp "' + containerId + ':' + workDir + '/." "' + outputDir + '"');
    if (result.code !== 0) throw new Error('output 폴더로 복사 실패');
}

export async function initNodeProject(containerId, workDir) {
    let result = await executeInContainer(containerId, 'cd ' + workDir + ' && npm init -y');
}

export async function installNodeModules(containerId, workDir, moduleName) {
    let result = await executeInContainer(containerId, 'cd ' + workDir + ' && npm install ' + moduleName);
}

export async function runNodeJSCode(containerId, workDir, code, requiredPackageNames = []) {
    {
        if (requiredPackageNames.length > 0) {
            for (const packageName of requiredPackageNames) {
                await installNodeModules(containerId, workDir, packageName);
            }
        }

    }
    const tmpJsFile = getAppPath('.code_' + Math.random() + '.js');
    const jsFileName = 'AIEXE-data-handling-operation.js';

    code = [
        `{`,
        `const fs = require('fs');`,
        `fs.rmSync('${jsFileName}', { recursive: true, force: true });`,
        `}`,
        code
    ].join('\n');

    await fs.promises.writeFile(tmpJsFile, code);

    {
        let result = await executeCommand('docker cp "' + tmpJsFile + '" "' + containerId + ':' + workDir + '/' + jsFileName + '"');

        if (result.code !== 0) throw new Error('임시 JS 파일 복사 실패');
    }
    await fs.promises.rm(tmpJsFile);


    let result = await executeInContainer(containerId, 'cd ' + workDir + ' && node ' + jsFileName);
    result.output = `${result.stderr}\n\n${result.stdout}`;
    return result;
}
export async function killDockerContainer(containerId) {
    await executeCommand(`docker kill "${containerId}"`);
}
export async function runDockerContainerDemon(dockerImage) {
    let result = await executeCommand(`docker run -d --rm "${dockerImage}" tail -f /dev/null`);
    if (result.code !== 0) throw new Error('컨테이너 시작 실패');
    return result.stdout.trim();
}

export async function runDockerContainer(dockerImage, inputDir, outputDir) {
    const containerId = await runDockerContainerDemon(dockerImage);
    const dockerWorkDir = await getConfiguration('dockerWorkDir');
    const workDir = dockerWorkDir;

    try {
        await importToDocker(containerId, workDir, inputDir);
        await initNodeProject(containerId, workDir);
        await installNodeModules(containerId, workDir, 'express');
        await runNodeJSCode(containerId, workDir, `console.log('Hello, World!');`);
        await exportFromDocker(containerId, workDir, outputDir);
    } finally {
        await killDockerContainer(containerId);
    }
}


export async function doesDockerImageExist(imageName) {
    try {
        if (!imageName) return false;
        if (imageName.includes('"')) return false;
        const result = await executeCommand(`docker images --format '{{json .}}'`);
        if (result.code !== 0) return false;
        const images = result.stdout.split('\n')
            .filter(line => line.trim())
            .map(line => JSON.parse(line));

        return images.some(image => image.Repository === imageName);
    } catch (err) {
        return false;
    }
}





































export async function getDockerInfo() {
    if (isWindows()) throw new Error('Windows에서는 지원하지 않습니다.');
    try {
        const execAsync = promisify(exec);
        const command = "docker info --format '{{json .}}' 2>/dev/null";
        const { stdout } = await execAsync(command);
        if (!stdout) {
            throw new Error('도커 정보를 가져올 수 없습니다.');
        }
        const dockerInfo = JSON.parse(stdout);
        const isRunning = !dockerInfo.ServerErrors || dockerInfo.ServerErrors.length === 0;
        return {
            ...dockerInfo,
            isRunning
        };
    } catch (error) {
        console.error('도커 정보 조회 실패:', error.message);
        return {
            isRunning: false,
            error: error.message
        };
    }
}