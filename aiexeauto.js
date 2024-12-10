#!/usr/bin/env node
// node server.js "make three folders named folder_0, folder_1, folder_2"

import express from 'express';
import { solveLogic } from './solveLogic.js';
import { getCodePath, findAvailablePort, getAbsolutePath, validatePath, prepareOutputDir, getAppPath, getConfiguration, setConfiguration, flushFolder } from './system.js';
import { validateAndCreatePaths } from './dataHandler.js';
import fs from 'fs';
import boxen from 'boxen';
import chalk from 'chalk';
import path from 'path';
const app = express();
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    next();
});
{
    const dirSource = getCodePath('public');
    const dirDestination = getAppPath('.public');
    if (!fs.existsSync(dirDestination)) fs.cpSync(dirSource, dirDestination, { recursive: true });
}
app.use(express.static(getAppPath('.public')));
const startPort = process.env.PORT || 8080;
let server;
let prompt = process.argv[2];
if (prompt === 'version') {
    console.log('1.0.29');
    process.exit(0);
} else if (prompt === 'config') {
    let configKey = process.argv[3];
    let configValue = process.argv[4];
    (async () => {
        await setConfiguration(configKey, configValue);
        console.log(`${chalk.cyan(configKey)} ${chalk.green('설정이 완료되었습니다.')}`);
        process.exit(0);
    })();
} else {
    if (!prompt) {
        console.log('사용법: aiexeauto "<프롬프트|프롬프트를담은파일경로>" <데이터소스경로> <데이터출력경로>');
        process.exit(1);
    }
    let dataSourcePath = getAbsolutePath(process.argv[3]);
    let dataOutputPath = getAbsolutePath(process.argv[4]);
    let dataSourceNotAssigned = !dataSourcePath;
    let dataOutputNotAssigned = !dataOutputPath;
    let odrPath = dataOutputPath;
    if (dataSourceNotAssigned) {
        dataSourcePath = await prepareOutputDir(path.join(getAppPath('.tempwork'), 'data'), false);
    }
    dataOutputPath = await prepareOutputDir(path.join(getAppPath('.tempwork'), 'output'), false);

    validatePath(dataSourcePath, '데이터 소스 경로');
    validatePath(dataOutputPath, '데이터 출력 경로');
    if (odrPath) validatePath(odrPath, '데이터 출력 경로');
    (async () => {
        const dockerWorkDir = await getConfiguration('dockerWorkDir');
        const llm = await getConfiguration('llm');
        const overwriteOutputDir = await getConfiguration('overwriteOutputDir');
        if (await getConfiguration('useDocker')) validatePath(dockerWorkDir, 'Docker 작업 경로');

        if (llm !== 'claude') {
            console.log('현재는 Anthropic의 Claude 모델만 지원합니다. 미안해.');
            process.exit(1);
        }
        if (fs.existsSync(getAbsolutePath(prompt))) {
            prompt = fs.readFileSync(getAbsolutePath(prompt), 'utf8');
            prompt = prompt.split('\n').filter(line => line.trim() !== '').join(' ');
        }

        try { await validateAndCreatePaths(dataSourcePath); } catch (error) { console.error(error.message); process.exit(1); }
        const nodeFiles = ['package.json', 'package-lock.json', 'node_modules'];
        for (const file of nodeFiles) {
            if (fs.existsSync(path.join(dataSourcePath, file))) {
                console.log(chalk.red(`데이터 소스 경로에 Node.js 관련 파일(${file})이 포함되어 있습니다.`));
                process.exit(1);
            }
        }
        try { await validateAndCreatePaths(dataOutputPath); } catch (error) { console.error(error.message); process.exit(1); }

        try {
            const PORT = await findAvailablePort(startPort);
            server = app.listen(PORT, async () => {
                await solveLogic({ PORT, server, multiLineMission: prompt, dataSourcePath, dataOutputPath });
                if (dataSourceNotAssigned) await flushFolder([dataSourcePath]);
                if (dataOutputNotAssigned) await flushFolder([dataOutputPath]);
                if (fs.existsSync(dataOutputPath)) {
                    let outputCandidate;
                    let over = false;
                    if (odrPath) {
                        outputCandidate = odrPath
                        over = overwriteOutputDir;
                    } else {
                        if (dataSourceNotAssigned) {
                            outputCandidate = path.join(process.cwd(), 'output')
                        } else {
                            outputCandidate = dataSourcePath
                        }
                    }
                    let outputPath = await prepareOutputDir(outputCandidate, over, true);
                    try {
                        await fs.promises.rename(dataOutputPath, outputPath);
                    } catch (err) {
                        if (err.code === 'EXDEV') {
                            // 다른 디바이스/파티션간 이동시 복사 후 삭제 방식 사용
                            await fs.promises.cp(dataOutputPath, outputPath, { recursive: true });
                            await fs.promises.rm(dataOutputPath, { recursive: true });
                        } else {
                            throw err;
                        }
                    }
                    console.log(chalk.green(`결과물이 저장된 경로: ${chalk.bold(outputPath)}`));
                }
            });
        } catch (err) {
            console.error('Error while setting up port:', err);
            process.exit(1);
        }
    })();
}
