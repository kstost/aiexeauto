import puppeteer from 'puppeteer';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { highlight } from 'cli-highlight';
import ora from 'ora';
import boxen from 'boxen';
import axios from 'axios';

import { importData, exportData } from './dataHandler.js';
import { chatCompletion } from './aiFeatures.js';
import { isInstalledNpmPackage, installNpmPackage, checkValidSyntaxJavascript, stripFencedCodeBlocks, runCode, getRequiredPackageNames } from './codeExecution.js';
import { getLastDirectoryName } from './dataHandler.js';
import { getDockerInfo, runDockerContainer, killDockerContainer, runDockerContainerDemon, importToDocker, exportFromDocker, isInstalledNodeModule, installNodeModules, runNodeJSCode, runPythonCode, doesDockerImageExist, isInstalledPythonModule, installPythonModules } from './docker.js';
import { getToolList, getToolData } from './system.js';
import fs from 'fs';
import { getConfiguration } from './system.js';

let containerId;
let spinners = {};

// Collecting prompts in one place
const prompts = {
    systemPrompt: async (mission, whattodo, useDocker) => [
        '컴퓨터 작업 실행 에이전트로서, MAIN MISSION을 완수하기 위한 SUB MISSION을 수행하기 위해 필요한 작업을 수행합니다.',
        '',
        `- MAIN MISSION: "${mission}"`,
        `- SUB MISSION: "${whattodo}"`,
        '',
        '## INSTRUCTION',
        '- 작업 수행을 위한 도구는 다음과 같이 준비되어있으며 임무 수행에 가장 적합한 도구를 선택해서 수행하세요.',
        '',
        '## Tools',
        '   ### read_file',
        '   - 파일의 내용을 읽어옵니다.',
        '      #### INSTRUCTION',
        '      - 파일의 경로를 제공해주세요',
        '   ',
        '   ### list_directory',
        '   - 디렉토리의 파일/폴더 목록을 가져옵니다.',
        '      #### INSTRUCTION',
        '      - 디렉토리의 경로를 제공해주세요',
        '   ',
        '   ### read_url',
        '   - URL의 내용을 읽어옵니다.',
        '      #### INSTRUCTION',
        '      - URL을 제공해주세요',
        '   ',
        '   ### rename_file_or_directory',
        '   - 파일 또는 디렉토리의 이름을 변경합니다.',
        '      #### INSTRUCTION',
        '      - 변경할 파일 또는 디렉토리의 경로와 변경할 이름을 제공해주세요',
        '   ',
        '   ### remove_file',
        '   - 파일을 삭제합니다.',
        '      #### INSTRUCTION',
        '      - 삭제할 파일의 경로를 제공해주세요',
        '   ',
        '   ### remove_directory_recursively',
        '   - 디렉토리를 재귀적으로 삭제합니다.',
        '      #### INSTRUCTION',
        '      - 삭제할 디렉토리의 경로를 제공해주세요',
        '   ',
        // '   ### cdnjs_finder',
        // '   - CDN 라이브러리 URL을 찾습니다.',
        // '      #### INSTRUCTION',
        // '      - 패키지 이름을 제공해주세요',
        // '   ',
        useDocker ? '   ### apt_install' : '[REMOVE]',
        useDocker ? '   - apt 패키지를 설치합니다.' : '[REMOVE]',
        useDocker ? '      #### INSTRUCTION' : '[REMOVE]',
        useDocker ? '      - 설치할 패키지 이름을 제공해주세요' : '[REMOVE]',
        useDocker ? '   ' : '[REMOVE]',
        true ? '   ### which_command' : '[REMOVE]',
        true ? '   - 쉘 명령어가 존재하는지 확인합니다.' : '[REMOVE]',
        true ? '      #### INSTRUCTION' : '[REMOVE]',
        true ? '      - which로 확인할 쉘 명령어를 제공해주세요' : '[REMOVE]',
        true ? '   ' : '[REMOVE]',
        true ? '   ### run_command' : '[REMOVE]',
        true ? '   - 쉘 명령어를 실행합니다.' : '[REMOVE]',
        true ? '      #### INSTRUCTION' : '[REMOVE]',
        true ? '      - 실행할 쉘 명령어를 제공해주세요' : '[REMOVE]',
        true ? '   ' : '[REMOVE]',
        '   ',
        `${await (async () => {
            const toolList = await getToolList();
            let toolPrompts = [];
            for (let tool of toolList) {
                const toolData = await getToolData(tool);
                toolPrompts.push(toolData.prompt);
            }
            return toolPrompts.join('\n\t\n');
        })()}`,
    ].filter(line => line.trim() !== '[REMOVE]').join('\n'),
    systemEvaluationPrompt: (mission) => [
        '컴퓨터 작업 실행 에이전트로서, MISSION이 완전하게 완료되었는지 엄격고 논리적으로 검증하고 평가하기 위해 필요한 작업을 수행합니다.',
        '이미 검증을 위한 충분한 OUTPUT이 존재하고 미션이 완수되었다고 판단되면 ENDOFMISSION을 응답하고 그것이 아니라면 NOTSOLVED를 응답.',
        '만약 해결할 수 없는 미션이라면 GIVEUPTHEMISSION을 응답하세요.',
        '',
        `- MISSION: "${mission}"`,
        '',
    ].join('\n'),

    packageNamesPrompt: [
        '주어진 Node.js 코드를 실행하기 위해 필요한 npm 패키지들을 파악하는 역할을 합니다.',
        '코드에 사용된 모든 npm 패키지 이름을 배열로 반환해주세요.',
    ].join('\n'),
};

const highlightCode = (code, language) => {
    return highlight(code, {
        language: language,
        theme: {
            keyword: chalk.blue,
            string: chalk.green,
            number: chalk.yellow,
            comment: chalk.gray,
            function: chalk.magenta
        }
    });
};

// 스피너 생성 함수
const createSpinner = (text, spinnerType = 'dots') => {
    const spinner = ora({
        text,
        color: 'cyan',
        spinner: spinnerType,
        stream: process.stdout // 명시적으로 출력 스트림 지정
    }).start();

    // 기존 SIGINT 핸들러 제거 및 새로운 핸들러 등록
    process.removeAllListeners('SIGINT');
    process.on('SIGINT', async () => {
        spinner.stop();
        console.log('\n작업이 사용자에 의해 중단되었습니다.');
        if (containerId) {
            spinners.docker = createSpinner('도커 컨테이너를 종료하는 중...');
            await killDockerContainer(containerId);
            if (spinners.docker) {
                spinners.docker.succeed('도커 컨테이너가 종료되었습니다.');
            }
        }

        process.exit(1);
    });

    return spinner;
};

export function omitMiddlePart(text, length = 1024) {
    text = text.trim();
    return (text.length > length
        ? text.substring(0, length / 2) + '\n\n...(middle part omitted due to length)...\n\n' + text.substring(text.length - length / 2)
        : text).trim();
}

export async function solveLogic({ PORT, server, multiLineMission, dataSourcePath, dataOutputPath }) {
    const processTransactions = [];
    function makeRealTransaction(multiLineMission, type, whatdidwedo, whattodo, evaluationText) {
        let realTransactions = [];
        for (let i = 0; i < processTransactions.length; i++) {
            const role = processTransactions[i].class === 'output' ? 'user' : 'assistant';
            const code = processTransactions[i].class === 'code' ? processTransactions[i].data : null;
            let output = processTransactions[i].class === 'output' ? processTransactions[i].data : null;
            if (output) {
                output = omitMiddlePart(output);
                output = output.trim();
            }

            let data = {
                role,
                content: (role === 'user' ? (output ? [
                    'Output of the Execution',
                    '```shell',
                    `$ node code.js`,
                    output,
                    '```',
                ] : [
                    'No output. The execution completed without any output.',
                    '```shell',
                    `$ node code.js`,
                    `$`,
                    '```',
                ]) : [
                    'Code to execute',
                    '```javascript',
                    code,
                    '```',
                ]).join('\n'),
            };
            realTransactions.push(data);
        }
        if (realTransactions.length === 0) throw new Error('No transactions found');
        if (realTransactions[realTransactions.length - 1].role !== 'user') throw new Error('Last transaction is not user');
        if (realTransactions.length > 1) realTransactions[0].content = 'make the first code to do';
        realTransactions[realTransactions.length - 1] = makeCodePrompt(multiLineMission, type, whatdidwedo, whattodo, evaluationText);
        return realTransactions;
    }
    function makeCodePrompt(mission, type, whatdidwedo, whattodo, evaluationText) {

        let output = processTransactions.at(-1).data;
        if (output) {
            output = omitMiddlePart(output);
        }

        const last = (
            processTransactions.at(-1).data !== null ?
                (output ? [
                    'Output of the Execution',
                    '```shell',
                    `$ node code.js`,
                    output,
                    '```',
                ] : [
                    'Process ends without any outputs.',
                    '```shell',
                    `$ node code.js`,
                    `$`,
                    '```',
                ]) : []
        );
        if (type === 'coding') {
            return {
                role: "user",
                content: [
                    '',
                    ...last,
                    '',
                    'EVALUATION OF THE PREVIOUS TASKS:',
                    evaluationText,
                    '',
                    `DID SO FAR:`,
                    `${whatdidwedo}`,
                    '',
                    `TASK TO DO NEXT STEP:`,
                    `${whattodo.split('\n').join(' ')}`,
                    '',
                    'To do this, choose proper action.',
                ].join('\n'),
            };
        } else if (type === 'evaluation') {
            return {
                role: "user",
                content: [
                    ...last,
                    '',
                    'Does the progress so far and current output indicate mission completion?',
                    'Judge what to do to complete the mission by the Output of the Execution and the history we did so far',
                    // 'Judge what to do in among verdict or generate_validation_code or give_up_the_mission for the mission by Output of the Execution, We we did so far',
                    '',
                    `MISSION: "${mission}"`,
                    '',
                ].join('\n'),
            };
        } else if (type === 'whatdidwedo') {
            return {
                role: "user",
                content: [
                    ...last,
                    '',
                    `MISSION: "${mission}"`,
                    '',
                    '인공지능 에이전트로써 지금까지 수행한 작업을 요약해서 알려줘.',
                    '',
                    '작성 지침:',
                    '- 핵심적인 내용만 짧게 작성해.',
                    '- 핵심적 담백한 표현만 사용해.',
                    '- 코드는 포함하지 마세요.',
                ].join('\n'),
            };
        } else if (type === 'whattodo') {
            return {
                role: "user",
                content: [
                    '바로 직후 다음으로 수행할 **오직 절대로 딱 하나의** 작업이 무엇인지 말해!',
                    '',
                    '',
                    ...last,
                    '',
                    `MISSION: "${mission}"`,
                    '',
                    'INSTRUCTION:',
                    '- 미션과 지금까지의 진행 상황을 고려하여 다음으로 해야 할 단 한 가지 작업만 제공하세요.',
                    '- 해야할 일을 논리적으로 판단하세요.',
                    '- 선택적인 작업은 생략합니다.',
                    '- 코드 포함하지 마세요.',
                    '- 한국어로 한 문장만 응답하세요.',
                    '',
                    'OUTPUT',
                    '...를 할게요.',
                ].join('\n'),
            };
        }
    }
    let iterationCount = 0;

    try {
        if (await getConfiguration('useDocker')) {
            const dockerImage = await getConfiguration('dockerImage');
            const { isRunning } = await getDockerInfo();
            if (!isRunning) {
                throw new Error('도커가 실행중이지 않습니다.');
            }
            if (!(await doesDockerImageExist(dockerImage))) {
                throw new Error(`도커 이미지 ${dockerImage}가 존재하지 않습니다.`);
            }
            containerId = await runDockerContainerDemon(dockerImage);
        }
        let browser, page;

        console.log(boxen(multiLineMission, {
            padding: 0,
            margin: 0,
            borderStyle: 'double',
            borderColor: 'green',
            title: '수행 미션',
            titleAlignment: 'center'
        }));

        // 브라우저 시작 스피너
        if (!await getConfiguration('useDocker')) {
            spinners.browser = createSpinner('브라우저를 시작하는 중...');
            browser = await puppeteer.launch({
                headless: "new",
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            });
            if (spinners.browser) {
                spinners.browser.succeed('브라우저가 시작되었습니다.');
            }

            // 페이지 로드 스피너
            spinners.page = createSpinner('웹 컨테이너를 초기화하는 중...');
            page = await browser.newPage();
            await page.goto(`http://localhost:${PORT}`);
            await page.waitForFunction(() => window.appReady === true, { timeout: 60000 });
            await page.evaluate(async () => await window._electrons.boot());
            if (spinners.page) {
                spinners.page.succeed('웹 컨테이너가 준비되었습니다.');
            }
        }
        const dockerWorkDir = await getConfiguration('dockerWorkDir');
        const maxIterations = await getConfiguration('maxIterations');
        const useDocker = await getConfiguration('useDocker');

        // 데이터 임포트 스피너
        spinners.import = createSpinner('데이터를 가져오는 중...');
        if (await getConfiguration('useDocker')) {
            await importToDocker(containerId, dockerWorkDir, dataSourcePath);
        } else {
            await importData(page, dataSourcePath);
        }
        if (spinners.import) {
            spinners.import.succeed('데이터를 성공적으로 가져왔습니다.');
        }
        let nextCodeForValidation;
        let evaluationText = '';
        while (iterationCount < maxIterations || !maxIterations) {
            iterationCount++;
            let javascriptCode = '';
            let javascriptCodeBack = '';
            let pythonCode = '';
            let requiredPackageNames;
            let whatdidwedo = '';
            let whattodo = '';
            let validationMode = nextCodeForValidation ? true : false;

            if (!validationMode) {
                processTransactions.length === 0 && processTransactions.push({ class: 'output', data: null });
                if (processTransactions.length > 1) {
                    spinners.iter = createSpinner('작업 회고 중...');
                    whatdidwedo = await chatCompletion(
                        'As an AI agent, analyze what has been done so far',
                        makeRealTransaction(multiLineMission, 'whatdidwedo'),
                        'whatDidWeDo'
                    );
                    if (whatdidwedo) whatdidwedo = whatdidwedo.split('\n').map(a => a.trim()).filter(Boolean).join('\n');
                    if (spinners.iter) spinners.iter.succeed('작업 회고 완료.');
                }
                spinners.iter = createSpinner('다음 계획수립 중...');
                whattodo = await chatCompletion(
                    "당신은 미션 완수를 위해 다음으로 해야 할 단 한 가지의 작업만을 제공하는 AI 비서입니다. 지금까지의 진행 상황과 이전 작업의 결과를 고려하세요. 코드나 불필요한 내용은 제외하고, 한국어로 한 문장만 응답하세요. 선택적인 작업은 생략합니다.",
                    makeRealTransaction(multiLineMission, 'whattodo'),
                    'whatToDo'
                );
                if (spinners.iter) spinners.iter.succeed('다음 계획수립 완료.');
                if (whattodo) whattodo = whattodo.split('\n').map(a => a.trim()).filter(Boolean).join('\n');
                if (whatdidwedo) console.log(chalk.bold.cyan(`📃${whatdidwedo}`));
                console.log(chalk.bold.yellowBright(`📌${whattodo}`));
                spinners.iter = createSpinner('AI가 코드를 생성하는 중...');
                let actData = await chatCompletion(
                    await prompts.systemPrompt(multiLineMission, whattodo, useDocker),
                    makeRealTransaction(multiLineMission, 'coding', whatdidwedo, whattodo, evaluationText),
                    'generateCode'
                );
                if (spinners.iter) spinners.iter.succeed(`AI가 코드 생성을 완료(${actData.name})했습니다`);
                if (actData.name === 'generate_nodejs_code') {
                    javascriptCode = actData.input.nodejs_code;
                    requiredPackageNames = actData.input.npm_package_list;
                } else if (actData.name === 'generate_nodejs_code_for_puppeteer') {
                    javascriptCode = actData.input.nodejs_code;
                    requiredPackageNames = actData.input.npm_package_list;
                } else if (actData.name === 'generate_python_code') {
                    pythonCode = actData.input.python_code;
                    requiredPackageNames = actData.input.pip_package_list;
                } else if (actData.name === 'list_directory') {
                    javascriptCode = [
                        `const listDirectory = require('listDirectory');`,
                        `console.log(await listDirectory('${actData.input.directory_path}'));`,
                    ].join('\n');
                    javascriptCodeBack = [
                        `const fs = require('fs');`,
                        `const exists = fs.existsSync('${actData.input.directory_path}');`,
                        `if(!exists){console.error('❌ ${actData.input.directory_path} 조회할 디렉토리가 존재하지 않습니다');process.exit(1);}`,
                        `let result = fs.readdirSync('${actData.input.directory_path}');`,
                        `result = result.filter(item => !['node_modules', 'package.json', 'package-lock.json'].includes(item));`,
                        `console.log('## Directory Contents of ${actData.input.directory_path}');`,
                        `if(result.length === 0){console.log('⚠️ 디렉토리가 비어있습니다');process.exit(0);}`,
                        `// 폴더 먼저 출력`,
                        `for(let item of result) {`,
                        `    const isDirectory = fs.statSync('${actData.input.directory_path}/'+item).isDirectory();`,
                        `    if(isDirectory) console.log('📁 ' + '${actData.input.directory_path}/'+item+'/');`,
                        `}`,
                        `// 파일 출력`,
                        `for(let item of result) {`,
                        `    const isDirectory = fs.statSync('${actData.input.directory_path}/'+item).isDirectory();`,
                        `    if(!isDirectory) console.log('📄 ' + '${actData.input.directory_path}/'+item);`,
                        `}`,
                    ].join('\n');
                } else if (actData.name === 'apt_install') {
                    javascriptCode = [
                        `const aptInstall = require('aptInstall');`,
                        `console.log(await aptInstall('${actData.input.package_name}'));`,
                    ].join('\n');
                    javascriptCodeBack = [
                        `const { spawnSync } = require('child_process');`,
                        `const result = spawnSync('apt', ['install', '-y', '${actData.input.package_name}'], { stdio: ['pipe', 'pipe', 'pipe'], shell: true, encoding: 'utf-8' });`,
                        `const output = result.stderr.toString() + result.stdout.toString();`,
                        `const outputExists = output.trim().length>0;`,
                        `if (result.status === 0) console.log(outputExists?output:'(출력결과는 없지만 문제없이 설치되었습니다)');`,
                        `if (result.status !== 0) console.error('❌ 설치수행 실행 실패'+(outputExists?String.fromCharCode(10)+output:''));`,
                        `process.exit(result.status);`,
                    ].join('\n');
                } else if (actData.name === 'which_command') {
                    javascriptCode = [
                        `const whichCommand = require('whichCommand');`,
                        `console.log(await whichCommand('${actData.input.command}'));`,
                    ].join('\n');
                    javascriptCodeBack = [
                        `const { spawnSync } = require('child_process');`,
                        `const result = spawnSync('which', ['${actData.input.command}'], { stdio: ['pipe', 'pipe', 'pipe'], shell: true, encoding: 'utf-8' });`,
                        `const output = result.stderr.toString() + result.stdout.toString();`,
                        `const outputExists = output.trim().length>0;`,
                        `const notFound = '(❌ ${actData.input.command} 명령어가 존재하지 않습니다)';`,
                        `if (result.status === 0) console.log(outputExists?'${actData.input.command} 명령어가 존재합니다.'+String.fromCharCode(10)+'명령어의 경로: '+output:notFound);`,
                        `if (result.status !== 0) console.error('❌ which 명령어 실행 실패'+(outputExists?String.fromCharCode(10)+output:''));`,
                        `process.exit(result.status);`,
                    ].join('\n');
                } else if (actData.name === 'run_command') {
                    javascriptCode = [
                        `const runCommand = require('runCommand');`,
                        `console.log(await runCommand('${actData.input.command}'));`,
                    ].join('\n');
                    javascriptCodeBack = [
                        `const { spawnSync } = require('child_process');`,
                        `const result = spawnSync('${actData.input.command}', [], { stdio: ['pipe', 'pipe', 'pipe'], shell: true, encoding: 'utf-8' });`,
                        `const output = result.stderr.toString() + result.stdout.toString();`,
                        `const outputExists = output.trim().length>0;`,
                        `if (result.status === 0) console.log(outputExists?output:'(출력결과는 없지만 문제없이 실행되었습니다)');`,
                        `if (result.status !== 0) console.error(output);`,
                        `process.exit(result.status);`,
                    ].join('\n');
                } else if (actData.name === 'read_file') {
                    javascriptCode = [
                        `const readFile = require('readFile');`,
                        `console.log(await readFile('${actData.input.file_path}'));`,
                    ].join('\n');
                    javascriptCodeBack = [
                        `const fs = require('fs');`,
                        `const exists = fs.existsSync('${actData.input.file_path}');`,
                        `if(!exists){console.error('❌ ${actData.input.file_path} 읽을 파일이 존재하지 않습니다');process.exit(1);}`,
                        `const result = fs.readFileSync('${actData.input.file_path}', 'utf8');`,
                        `const trimmed = result.trim();`,
                        `if (trimmed.length === 0||fs.statSync('${actData.input.file_path}').size === 0) {`,
                        `    console.log('⚠️ ${actData.input.file_path} 파일이 비어있습니다 (0 bytes)');`,
                        `    process.exit(0);`,
                        `}`,
                        `console.log('📄 Contents of ${actData.input.file_path}');`,
                        `console.log(result);`,
                    ].join('\n');
                } else if (actData.name === 'remove_file') {
                    javascriptCode = [
                        `const removeFile = require('removeFile');`,
                        `console.log(await removeFile('${actData.input.file_path}'));`,
                    ].join('\n');
                    javascriptCodeBack = [
                        `const fs = require('fs');`,
                        `const exists = fs.existsSync('${actData.input.file_path}');`,
                        `if(!exists){console.error('❌ ${actData.input.file_path} 삭제할 파일이 존재하지 않습니다');process.exit(1);}`,
                        `fs.unlinkSync('${actData.input.file_path}');`,
                        `const result = fs.existsSync('${actData.input.file_path}');`,
                        `if (result) {`,
                        `    console.error('❌ 파일이 여전히 존재합니다: ${actData.input.file_path}');`,
                        `    process.exit(1);`,
                        `} else {`,
                        `    console.log('✅ 파일이 성공적으로 삭제되었습니다');`,
                        `}`,
                    ].join('\n');
                } else if (actData.name === 'remove_directory_recursively') {
                    javascriptCode = [
                        `const removeDirectory = require('removeDirectory');`,
                        `console.log(await removeDirectory('${actData.input.file_path}'));`,
                    ].join('\n');
                    javascriptCodeBack = [
                        `const fs = require('fs');`,
                        `const exists = fs.existsSync('${actData.input.directory_path}');`,
                        `if(!exists){console.error('❌ ${actData.input.directory_path} 삭제할 디렉토리가 존재하지 않습니다');process.exit(1);}`,
                        `fs.rmSync('${actData.input.directory_path}', { recursive: true, force: true });`,
                        `const result = fs.existsSync('${actData.input.directory_path}');`,
                        `if (result) {`,
                        `    console.error('❌ 디렉토리가 여전히 존재합니다: ${actData.input.directory_path}');`,
                        `    process.exit(1);`,
                        `} else {`,
                        `    console.log('✅ 디렉토리가 성공적으로 삭제되었습니다');`,
                        `}`,
                    ].join('\n');
                } else if (actData.name === 'rename_file_or_directory') {
                    javascriptCode = [
                        `const renameFileOrDirectory = require('renameFileOrDirectory');`,
                        `console.log(await renameFileOrDirectory('${actData.input.old_path}', '${actData.input.new_path}'));`,
                    ].join('\n');
                    javascriptCodeBack = [
                        `const fs = require('fs');`,
                        `const exists = fs.existsSync('${actData.input.old_path}');`,
                        `if(!exists){console.error('❌ ${actData.input.old_path} 이름을 변경할 파일 또는 디렉토리가 존재하지 않습니다');process.exit(1);}`,
                        `fs.renameSync('${actData.input.old_path}', '${actData.input.new_path}');`,
                        `const result = fs.existsSync('${actData.input.new_path}');`,
                        `if (result) {`,
                        `    console.log('✅ 파일 또는 디렉토리가 성공적으로 이름이 변경되었습니다');`,
                        `} else {`,
                        `    console.error('❌ 파일 또는 디렉토리가 이름 변경에 실패했습니다');`,
                        `    process.exit(1);`,
                        `}`,
                    ].join('\n');
                } else if (actData.name === 'read_url') {
                    const url = actData.input.url;
                    const result = await axios.get(url);
                    let data = result.data;
                    if (typeof data !== 'string') data = JSON.stringify(data);
                    let ob = { data };
                    javascriptCode = [
                        `const axios = require('axios');`,
                        `const result = await axios.get('${url}');`,
                        `console.log('🌏 Contents of ${url}');`,
                        `console.log(result.data);`,
                    ].join('\n');
                    javascriptCodeBack = [
                        `console.log('🌏 Contents of ${url}');`,
                        `console.log((${JSON.stringify(ob)}).data);`,
                    ].join('\n');
                } else if (actData.name === 'cdnjs_finder') {
                    const packageName = actData.input.package_name;
                    const result = await axios.get('https://api.cdnjs.com/libraries?search=' + packageName + '&fields=description,version');
                    let data = result.data;
                    if (typeof data === 'string') data = JSON.parse(data);
                    let url_list1 = data.results.filter(packageInfo => packageInfo.latest.includes('.umd.') && packageInfo.latest.endsWith('.js'))
                    let sum = [...url_list1];
                    let printData = sum.map(a => `${a.name} - ${a.latest}`).join('\n');
                    if (sum.length === 0) printData = 'NOT FOUND';
                    javascriptCode = [
                        `const cdnjsFinder = require('cdnjsFinder');`,
                        `const cdnLibraryURL = await cdnjsFinder('${actData.input.package_name}');`,
                        `console.log('🌏 CDN Library URL of ${actData.input.package_name}');`,
                        `console.log(cdnLibraryURL);`,
                    ].join('\n');
                    javascriptCodeBack = [
                        `console.log('🌏 CDN Library URL of ${actData.input.package_name}');`,
                        `console.log((${JSON.stringify({ printData })}).printData);`,
                    ].join('\n');
                }
                if (!pythonCode && javascriptCode) {
                    console.log(boxen(highlightCode(javascriptCode, 'javascript'), {
                        title: chalk.bold.cyan('Generated Code'),
                        titleAlignment: 'center',
                        padding: 1,
                        margin: 0,
                        borderStyle: 'double',
                        borderColor: 'cyan'
                    }));
                } else if (!javascriptCode && pythonCode) {
                    console.log(boxen(highlightCode(pythonCode, 'python'), {
                        title: chalk.bold.cyan('Generated Code'),
                        titleAlignment: 'center',
                        padding: 1,
                        margin: 0,
                        borderStyle: 'double',
                        borderColor: 'cyan'
                    }));
                }

            } else {
                javascriptCode = nextCodeForValidation;
                nextCodeForValidation = null;
            }
            javascriptCode = stripFencedCodeBlocks(javascriptCode);
            if (!requiredPackageNames) requiredPackageNames = [];
            if (requiredPackageNames && requiredPackageNames.constructor === Array) {
                for (const packageName of requiredPackageNames) {
                    if (!pythonCode && javascriptCode) {
                        let installed = useDocker ? isInstalledNodeModule(packageName) : isInstalledNpmPackage(packageName);
                        if (!installed) {
                            spinners.iter = createSpinner(`${packageName} 설치중...`);
                            if (useDocker) {
                                await installNodeModules(containerId, dockerWorkDir, packageName);
                            } else {
                                await installNpmPackage(page, packageName);
                            }
                            if (spinners.iter) spinners.iter.succeed(`${packageName} 설치 완료`);
                        }
                    } else if (!javascriptCode && pythonCode) {
                        let installed = await isInstalledPythonModule(containerId, dockerWorkDir, packageName);
                        if (!installed) {
                            spinners.iter = createSpinner(`${packageName} 설치중...`);
                            if (useDocker) {
                                await installPythonModules(containerId, dockerWorkDir, packageName);
                            }
                            if (spinners.iter) spinners.iter.succeed(`${packageName} 설치 완료`);
                        }
                    }
                }
            }
            requiredPackageNames = [];
            if (!useDocker) spinners.iter = createSpinner('코드를 실행하는 중...', 'line');
            if (useDocker) console.log('📊 코드를 실행합니다');
            let result;
            {
                const streamGetter = (str) => useDocker && process.stdout.write(str);
                if (!pythonCode && javascriptCode) {
                    let javascriptCodeToRun = javascriptCodeBack ? javascriptCodeBack : javascriptCode;
                    if (useDocker) {
                        result = await runNodeJSCode(containerId, dockerWorkDir, javascriptCodeToRun, requiredPackageNames, streamGetter);
                    } else {
                        result = await runCode(page, javascriptCodeToRun, requiredPackageNames);
                    }
                } else if (!javascriptCode && pythonCode) {
                    if (useDocker) {
                        result = await runPythonCode(containerId, dockerWorkDir, pythonCode, requiredPackageNames, streamGetter);
                    }
                }
            }

            if (useDocker) spinners.iter = createSpinner(`실행 #${iterationCount}차 완료`);
            if (spinners.iter) spinners.iter.succeed(`실행 #${iterationCount}차 완료`);
            processTransactions.push({ class: 'code', data: javascriptCode });

            // 결과 출력 및 평가
            result.output = result.output.replace(/\x1b\[[0-9;]*m/g, '');
            console.log('');


            // 실행 결과를 boxen으로 감싸기
            if (!useDocker) {
                const outputPreview = omitMiddlePart(result.output);

                console.log(chalk.bold.yellowBright(outputPreview));
                console.log('');
            }
            if (result.output.trim().length === 0) {
                console.log(chalk.red('❌ 실행결과 출력된 내용이 존재하지 않습니다'));
            }

            processTransactions.push({ class: 'output', data: result.output });

            if (true) {
                spinners.iter = createSpinner('작업 검증중입니다.');
                let actData = await chatCompletion(
                    prompts.systemEvaluationPrompt(multiLineMission, dataSourcePath),
                    makeRealTransaction(multiLineMission, 'evaluation'),
                    'evaluateCode'
                );
                const { evaluation, reason } = actData.input;
                if ((evaluation.replace(/[^A-Z]/g, '') || '').toUpperCase().trim() === 'ENDOFMISSION') {
                    if (spinners.iter) spinners.iter.succeed(`작업완료.`);
                    console.log(chalk.bold.greenBright(reason));
                    console.log(chalk.bold.black.bgGreenBright('Mission Completed'));
                    break;
                } else if ((evaluation.replace(/[^A-Z]/g, '') || '').toUpperCase().trim() === 'GIVEUPTHEMISSION') {
                    if (spinners.iter) spinners.iter.succeed(`작업 포기.`);
                    console.log(chalk.bold.redBright(reason));
                    console.log(chalk.bold.whiteBright.bgRedBright('Mission Aborted'));
                    break;
                } else {
                    if (spinners.iter) spinners.iter.succeed(`검증완료`);
                    console.log('📃 검증결과', chalk.gray(reason));
                    evaluationText = reason;
                }
            }
        }


        // 데이터 내보내기 스피너
        spinners.export = createSpinner('결과를 저장하는 중...');
        if (await getConfiguration('useDocker')) {
            await exportFromDocker(containerId, await getConfiguration('dockerWorkDir'), dataOutputPath);
        } else {
            await exportData(page, dataSourcePath, dataOutputPath);
        }
        if (spinners.export) {
            spinners.export.succeed('결과가 성공적으로 저장되었습니다.');
        }

        // 정리 작업 스피너
        spinners.cleanup = createSpinner('정리 작업을 수행하는 중...');
        if (browser) await browser.close();
        server.close();
        if (spinners.cleanup) {
            spinners.cleanup.succeed('모든 작업이 완료되었습니다.');
            // console.log(chalk.green(`결과물이 저장된 경로: ${chalk.bold(dataOutputPath)}`));
        }
    } catch (err) {
        // 현재 실행 중인 모든 스피너 중지
        Object.values(spinners).forEach(spinner => {
            if (spinner && spinner.isSpinning) {
                spinner.fail('작업이 중단되었습니다.');
            }
        });
        // console.error('오류가 발생했습니다:', err);
        console.error(chalk.red('✖'), chalk.redBright(err.message));
        process.exit(1);
    }
    finally {
        if (containerId) {
            spinners.docker = createSpinner('도커 컨테이너를 종료하는 중...');
            await killDockerContainer(containerId);
            if (spinners.docker) {
                spinners.docker.succeed('도커 컨테이너가 종료되었습니다.');
            }
        }
    }
}
