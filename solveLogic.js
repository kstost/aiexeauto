import puppeteer from 'puppeteer';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { highlight } from 'cli-highlight';
import ora from 'ora';
import boxen from 'boxen';

import { importData, exportData } from './dataHandler.js';
import { chatCompletion } from './aifeatures.js';
import { checkValidSyntaxJavascript, stripFencedCodeBlocks, runCode, getRequiredPackageNames } from './codeExecution.js';
import { getLastDirectoryName } from './dataHandler.js';
import { config } from './config.js';
import { getDockerInfo, runDockerContainer, killDockerContainer, runDockerContainerDemon, importToDocker, exportFromDocker, runNodeJSCode, doesDockerImageExist } from './docker.js';
import fs from 'fs';

// Setting __dirname (In ESM, you need to set it manually)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let containerId;
let spinners = {};

// Collecting prompts in one place
const prompts = {
    initialPlan: (mission) => [
        '미션:',
        config.threeBackticks,
        `${mission}`,
        config.threeBackticks,
        '',
        '주어진 미션을 NodeJS 코드를 이용해서 완수하기 위해 필요한 논리적인 단계를 나열해 주세요.',
        '소스 코드는 포함하지 마세요.',
        '논리적으로 단계별로 생각해 보세요.',
    ].join('\n').trim(),

    systemPrompt: (mission, dataSourcePath) => [
        '당신은 프로그래머입니다.',
        '주어진 미션을 완수하기 위한 완전한 Node.js 코드를 작성하세요.',
        '',
        '검증 및 로깅 요구사항:',
        '- 각 단계마다 성공 또는 실패를 로깅하세요.',
        '- 필요한 파일의 존재 여부를 확인하고 로깅하세요.',
        '- 파일 내용과 데이터 타입을 검증하세요.',
        '- 검증 실패 시 상세한 오류 메시지를 출력하세요.',
        '- 중간 결과와 최종 상태를 출력하여 검증하세요.',
        '- 가독성을 위해 출력 길이를 제한하세요.',
        '',
        '데이터 처리 요구사항:',
        '- 각 단계에서 데이터 구조를 로깅하고 검사하세요.',
        '- 변환 전후의 데이터 샘플을 출력하세요.',
        '- 데이터 타입과 형식을 지속적으로 검증하세요.',
        '- 데이터 상태 변화를 이해하기 쉬운 형식으로 보여주세요.',
        '- 데이터 크기와 내용 변화를 추적하세요.',
        '- 이상 현상을 조사하고 분석하세요.',
        '',
        '이전 실행 분석:',
        '- 이전 실행의 성공 또는 실패 요인을 식별하세요.',
        '- 발견된 문제를 해결하세요.',
        '- 개선된 검증 로직을 구현하세요.',
        '',
        '코드 작성 지침:',
        '- 코드는 검증 단계와 명확한 증거 출력을 포함해야 합니다.',
        '- 다음 단계로 진행하기 전에 각 단계의 완료를 확인하세요.',
        '- 각 변환 후 `console.log`를 사용하여 데이터 상태를 출력하세요.',
        '- 이전 결과에 문제가 있다면 수정하는 코드를 작성하세요.',
        '- 특별히 작업 폴더가 지정되어있지 않다면 ./ 경로를 작업경로로 지정.',
        config.useDocker ? '- 필요하다면 child_process로 Ubuntu Linux에 명령을 내릴수 있다.' : '- Linux shell script 사용 금지',
        config.useDocker ? '- sudo 명령어는 사용할 수 없는 시스템이다.' : '- 코드는 매우 제한된 micro computer environment of Ubuntu 22.04 LTS에서 실행되므로 의존성이 높은 패키지는 사용하지 마세요.',
        '- 시각화가 필요한 미션의 경우라면 **반드시** HTML, CSS, JavaScript, D3.js, Chart.js, Highcharts, ECharts, Plotly.js, Vis.js, Three.js, Vega/Vega-Lite, ApexCharts, NVD3, Cytoscape.js, Sigma.js, p5.js, Paper.js, Raphaël, ZingChart 등의 시각화 라이브러리, Bootstrap, Tailwind CSS, Foundation, Materialize 등의 CSS 프레임워크, PapaParse, axios, JSONPlaceholder, Lodash, Moment.js 등의 데이터 처리 도구, JSON, CSV, Excel2JSON, Google Sheets API 등의 데이터 포맷 및 처리 도구, SVG, Canvas API, WebGL 등의 렌더링 기술, GitHub Pages, Netlify, Glitch, CodePen 등의 배포 도구를 활용하여 웹 페이지 형태의 결과물을 생성하고 .html 파일로 저장하세요.',
        '',
        '출력 형식:',
        '- 설명 없이 소스 코드만 반환하세요.',
        '- 코드는 유효한 JavaScript 문법이어야 합니다.',
        '- 마크다운 코드 블록을 사용하지 마세요.',
        '- 자연어 텍스트를 포함하지 마세요.',
        '',
        '미션:',
        config.threeBackticks,
        `${mission}`,
        config.threeBackticks,
        '',
    ].join('\n'),

    packageNamesPrompt: [
        '주어진 Node.js 코드를 실행하기 위해 필요한 패키지들을 나열하세요.',
        '',
        '출력 형식:',
        '- 설명 없이 패키지 이름만 JSON 배열로 반환하세요.',
        '- 마크다운 코드 블록을 사용하지 마세요.',
        '- 자연어 텍스트를 포함하지 마세요.',
        '',
        '예시 출력:',
        '["패키지명1", "패키지명2", ...]',
    ].join('\n'),

    evaluationPrompt_backup: (outputPreview, endSign, solution) => [
        '코드 실행 결과가 미션 완료를 나타내는지 평가하고 다음 작업을 수행할 코드를 작성해 주세요.',
        '',
        '코드 실행 결과:',
        '```shell',
        `$ node code.js`,
        `${outputPreview}`,
        '```',
        '',
        '평가 결과에 따라 다음을 수행하세요:',
        `- **평가 근거가 불충분하면**, 추가 증거를 수집하고 검증을 위해 출력 길이를 제한한 코드를 작성하세요.`,
        `- **미션이 실패했다고 판단되면**, 오류를 발생시킨 방법을 사용하지 말고 새로운 방법으로 미션을 완수하는 새로운 코드를 작성하세요.`,
        '',
        '코드 수행 지침:',
        '- 코드는 단일 JavaScript 파일로 완전하고 실행 가능해야 합니다.',
        '- 진행 단계마다 `console.log`를 사용하여 상태값과 진행상황을 출력하세요.',
        '- 이전 결과에 문제가 있다면 수정하는 코드를 작성하세요.',
        '- 추가 증거를 수집할 때는 분석을 위해 출력 길이를 제한하세요.',
        '- 시각화를 하는 미션의 경우는 시각화된 결과물인 html 파일의 존재유무를 중점으로 확인.',
        '',
        '오류 수정 지침:',
        '- 출력된 결과를 분석하고 오류를 수정하세요.',
        '- 수행실패가 연속적으로 이어진다면 방법을 완전히 새롭게 변경.',
        '- 처리할 파일이나 폴더를 찾지 못하는 경우 있을수 있는 모든 방법으로 다방면으로 파일의 존재를 검색하라.',
        '',
        !solution ? '' : `다음 진행을 위한 참고지침:`,
        !solution ? '' : `${solution}`,
        '',
        '미션 완수 선고 지침:',
        `- 선고는 보수적으로 논리적으로 판단하고 판단의 근거가 충분할 때에 내리세요.`,
        `- 미션이 완료되었다고 판단되면, 정확히 '${endSign}'를 출력하는 console.log('${endSign}') 코드 한줄만 작성하세요.`,
        '',
    ].join('\n').trim(),
    evaluationPrompt: (outputPreview, endSign, solution) => [
        '네가 제공해준 코드를 실행했다!!',
        '코드 실행 결과가 미션 완료를 나타내는지 평가하고 다음 작업을 수행할 코드를 작성해 주세요.',
        '코드 실행 결과를 면밀히 분석하고 결과에서 의미를 찾고 그 의미에 따라서 다음 작업을 수행할 코드를 작성해.',
        '',
        '',
        `**평가 근거가 불충분하면**, 추가 증거를 수집하여 출력하는 코드 작성해.`,
        `**미션이 실패했다고 판단되면**, 올바르게 미션을 완수하는 새로운 코드를 작성해.`,
        '',
        !solution ? '' : `다음 진행을 위한 참고지침:`,
        !solution ? '' : `${solution}`,
        '',
        'INSTRUCTION:',
        '- 앞선 코드의 수행에 따른 결과 누적되어있음을 반드시 명심해서 코드를 작성해.',
        '- 이전 과정과 동일한 일을 수행하는 코드 생성 금지',
        `- 미션이 완료되었다고 판단되면, 정확히 '${endSign}'를 출력하는 console.log('${endSign}') 코드 한줄만 작성하세요.`,
        '',
        '코드 실행 결과:',
        '```shell',
        `$ node code.js`,
        `${outputPreview}`,
        '```',
        '',
        '코드 실행 결과를 면밀히 분석하고 결과에서 의미를 찾고 그 의미에 따라서 다음 작업을 수행할 코드를 작성해.',

    ].join('\n').trim(),
};

const highlightCode = (code) => {
    return highlight(code, {
        language: 'javascript',
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

export async function solveLogic({ PORT, server, multiLineMission, dataSourcePath, dataOutputPath }) {
    const promptList = [];
    const endSign = 'ENDOFMISSION';
    const maxIterations = 10;
    let iterationCount = 0;

    try {
        if (config.useDocker) {
            const { isRunning } = await getDockerInfo();
            if (!isRunning) {
                throw new Error('도커가 실행중이지 않습니다.');
            }
            if (!(await doesDockerImageExist(config.dockerImage))) {
                throw new Error(`도커 이미지 ${config.dockerImage}가 존재하지 않습니다.`);
            }
            containerId = await runDockerContainerDemon(config.dockerImage);
        }
        if (false && config.log) {
            const aiLogFolder = './log.ai';
            fs.rmSync(aiLogFolder, { recursive: true, force: true });
        }
        let browser, page;

        // 브라우저 시작 스피너
        if (!config.useDocker) {
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

        // 데이터 임포트 스피너
        spinners.import = createSpinner('데이터를 가져오는 중...');
        if (config.useDocker) {
            await importToDocker(containerId, config.dockerWorkDir, dataSourcePath);
        } else {
            await importData(page, dataSourcePath);
        }
        if (spinners.import) {
            spinners.import.succeed('데이터를 성공적으로 가져왔습니다.');
        }

        // AI 계획 수립 스피너
        let firstPlan = '';
        if (config.useFirstPlan) {
            spinners.plan = createSpinner('AI가 해결 계획을 수립하는 중...');
            const howToSummarize = await chatCompletion(
                prompts.initialPlan(multiLineMission),
                [
                    {
                        role: "user",
                        content: [
                            '미션:',
                            config.threeBackticks,
                            `${multiLineMission}`,
                            config.threeBackticks,
                            '',
                            `미션을 완수하기 위한 단계를 논리적으로 설명해 주세요.`,
                            '',
                            'Let\'s think step by step.',
                        ].join('\n'),
                    },
                ],
                'initialPlan'
            );
            if (spinners.plan) {
                spinners.plan.succeed('AI가 해결 계획을 수립했습니다.');
            }
            console.log(boxen(chalk.cyan(howToSummarize), {
                title: chalk.bold.cyan('Planning'),
                titleAlignment: 'center',
                padding: 1,
                margin: 1,
                borderStyle: 'double',
                borderColor: 'cyan'
            }));
            firstPlan = howToSummarize;
        }
        let historyForEvaluation = [];
        let solution = '';

        while (iterationCount < config.maxIterations || !config.maxIterations) {
            iterationCount++;

            // 코드 생성
            spinners.iter = createSpinner(`실행 시도 #${iterationCount}...`);
            spinners.iter.text = 'AI가 코드를 생성하는 중...';
            let realPromptList = [];
            if (historyForEvaluation.length > 0) {
                realPromptList = [
                    {
                        role: "user",
                        content: [
                            '미션:',
                            config.threeBackticks,
                            `${multiLineMission}`,
                            config.threeBackticks,
                            '',
                            '미션을 완수하기 위한 Node.js 코드를 작성해 주세요.',
                            ``,
                            !firstPlan ? '' : `해결 계획:`,
                            !firstPlan ? '' : firstPlan,
                        ].join('\n'),
                    },
                    ...promptList,
                ];
                realPromptList = JSON.parse(JSON.stringify(realPromptList));
                for (let i = 1; i < realPromptList.length; i++) {
                    if (realPromptList[i].role === 'user') {
                        realPromptList[i].content = realPromptList[i].content.length > 1024 ?
                            realPromptList[i].content.substring(0, 1024) + '\n\n...(prompt is too long)' :
                            realPromptList[i].content;
                    }
                }

                let lastResult = realPromptList[realPromptList.length - 1];
                lastResult.content = prompts.evaluationPrompt(lastResult.content, endSign, solution);
                for (let i = 1; i < realPromptList.length - 1; i++) {
                    if (realPromptList[i].role === 'user') {
                        realPromptList[i].content = [
                            '코드 실행 결과:',
                            '```shell',
                            `$ node code.js`,
                            realPromptList[i].content,
                            '```',
                        ].join('\n');
                    }
                }
            } else {
                realPromptList = [
                    {
                        role: "user",
                        content: [
                            '미션:',
                            config.threeBackticks,
                            `${multiLineMission}`,
                            config.threeBackticks,
                            '',
                            '미션을 완수하기 위한 Node.js 코드를 작성해 주세요.',
                            ``,
                            !firstPlan ? '' : `해결 계획:`,
                            !firstPlan ? '' : firstPlan,
                        ].join('\n'),
                    },
                ];
            }
            let javascriptCode = await chatCompletion(
                prompts.systemPrompt(multiLineMission, dataSourcePath),
                realPromptList,
                'generateCode'
            );
            if (spinners.iter) {
                spinners.iter.succeed('AI가 코드 생성을 완료했습니다');
            }
            spinners.iter = createSpinner('코드 실행을 준비하는 중...');
            javascriptCode = stripFencedCodeBlocks(javascriptCode);

            // 패키지 설치
            // spinners.iter = createSpinner('필요한 패키지를 찾는 중...');
            const requiredPackageNames = await getRequiredPackageNames(javascriptCode, prompts);
            if (spinners.iter) {
                spinners.iter.succeed('코드 실행을 준비했습니다.');
            }
            console.log(boxen(highlightCode(javascriptCode), {
                title: chalk.bold.cyan('Generated Code'),
                titleAlignment: 'center',
                padding: 1,
                margin: 1,
                borderStyle: 'double',
                borderColor: 'cyan'
            }));
            spinners.iter = createSpinner('코드를 실행하는 중...', 'line');
            let result;
            if (config.useDocker) {
                result = await runNodeJSCode(containerId, config.dockerWorkDir, javascriptCode, requiredPackageNames);
            } else {
                result = await runCode(page, javascriptCode, requiredPackageNames);
            }

            if (spinners.iter) {
                spinners.iter.succeed(`실행 #${iterationCount}차 완료`);
            }

            promptList.push({
                role: "assistant",
                content: javascriptCode,
            });

            // 결과 출력 및 평가
            result.output = result.output.replace(/\x1b\[[0-9;]*m/g, '');
            console.log('');
            historyForEvaluation.push([
                `# ${iterationCount} 회차`,
                `코드:`,
                `${config.threeBackticks}javascript`,
                javascriptCode,
                `${config.threeBackticks}`,
                `결과:`,
                `${config.threeBackticks}shell`,
                result.output,
                `${config.threeBackticks}`,
            ].join('\n'));

            // 실행 결과를 boxen으로 감싸기
            const outputPreview = result.output.length > 1024
                ? result.output.substring(0, 1024) + '...(output is too long)'
                : result.output;

            console.log(chalk.bold.yellowBright(outputPreview));
            console.log('');

            // Check for mission completion
            const lastOutputLine = result.output.trim().split('\n').pop().trim();
            const lastCodeLine = javascriptCode.trim().split('\n').pop().trim();

            if (lastOutputLine === endSign || lastCodeLine === endSign || result.output.indexOf(endSign) > -1) {
                break;
            }
            if (config.useEvaluation) {
                let evaluateStatement = await chatCompletion(
                    [
                        'Assistant는 문제 해결 전문가이다.',
                        '',
                        '미션:',
                        config.threeBackticks,
                        `${multiLineMission}`,
                        config.threeBackticks,
                        '',
                        '미션 수행을 위한 Node.js 코드 수행 진행상황을 평가하고 다음 진행을 위한 참고지침을 작성해 주세요.',
                    ].join('\n'),
                    [
                        {
                            role: "user",
                            content: [
                                '',
                                '미션:',
                                config.threeBackticks,
                                `${multiLineMission}`,
                                config.threeBackticks,
                                '',
                                `미션을 수행해야한다.`,
                                `지금까지의 코드와 사용자가 제시하는 코드의 실행결과를 확인하고 문제점이 있다면 문제를 해결하기 위한 방법을 안내해줘.`,
                                ``,
                                `지금까지의 코드의 실행 결과:`,
                                historyForEvaluation.join('\n---\n'),

                                `INSTRUCTION:`,
                                `- 해결방안을 중점으로 설명`,
                                `- 코드를 **절대로** 포함하지 말아줘.`,
                            ].join('\n'),
                        },
                    ],
                    'evaluateSolution'
                );
                console.log(boxen(evaluateStatement, {
                    title: chalk.bold.cyan('Evaluation'),
                    titleAlignment: 'center',
                    padding: 1,
                    margin: 1,
                    borderStyle: 'double',
                    borderColor: 'cyan'
                }));
                solution = evaluateStatement;
            }

            // Update prompt list with evaluation request
            if (false) {
                promptList.push({
                    role: "user",
                    content: prompts.evaluationPrompt(outputPreview, endSign, solution),
                });
            } else {
                promptList.push({
                    role: "user",
                    content: [
                        result.output,
                    ].join('\n'),
                });
            }
        }

        console.log('Mission solved');

        // 데이터 내보내기 스피너
        spinners.export = createSpinner('결과를 저장하는 중...');
        if (config.useDocker) {
            await exportFromDocker(containerId, config.dockerWorkDir, dataOutputPath);
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
            console.log(chalk.green(`결과물이 저장된 경로: ${chalk.bold(dataOutputPath)}`));            
        }
    } catch (err) {
        // 현재 실행 중인 모든 스피너 중지
        Object.values(spinners).forEach(spinner => {
            if (spinner && spinner.isSpinning) {
                spinner.fail('작업이 중단되었습니다.');
            }
        });
        // console.error('오류가 발생했습니다:', err);
        console.error('오류가 발생했습니다:', err.message);
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
