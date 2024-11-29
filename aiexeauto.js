#!/usr/bin/env node
// node server.js "make three folders named folder_0, folder_1, folder_2"

import express from 'express';
import { solveLogic } from './solveLogic.js';
import { getCodePath, findAvailablePort, getAbsolutePath, validatePath, prepareOutputDir, getAppPath, getConfiguration, setConfiguration } from './system.js';
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
    console.log('1.0.18');
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
    if (!dataSourcePath) dataSourcePath = await prepareOutputDir(path.join(process.cwd(), 'data'), false);
    if (!dataOutputPath) {
        dataOutputPath = await prepareOutputDir(dataSourcePath, false);
        await fs.promises.rm(dataOutputPath, { recursive: true });
    }
    validatePath(dataSourcePath, '데이터 소스 경로');
    validatePath(dataOutputPath, '데이터 출력 경로');
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

        try {
            await validateAndCreatePaths(dataSourcePath);
            dataOutputPath = await prepareOutputDir(dataOutputPath, overwriteOutputDir);
        } catch (error) {
            console.error(error.message);
            process.exit(1);
        }

        try {
            const PORT = await findAvailablePort(startPort);
            console.log(boxen(prompt, {
                padding: 1,
                margin: 1,
                borderStyle: 'double',
                borderColor: 'green',
                title: '수행 미션',
                titleAlignment: 'center'
            }));
            server = app.listen(PORT, async () => await solveLogic({ PORT, server, multiLineMission: prompt, dataSourcePath, dataOutputPath }));
        } catch (err) {
            console.error('Error while setting up port:', err);
            process.exit(1);
        }
    })();
}
