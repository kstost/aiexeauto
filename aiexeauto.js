// node server.js "make three folders named folder_0, folder_1, folder_2"

import express from 'express';
import { solveLogic } from './solveLogic.js';
import { findAvailablePort, getAbsolutePath, validatePath, prepareOutputDir, getAppPath } from './system.js';
import { validateAndCreatePaths } from './dataHandler.js';
import fs from 'fs';
import { config } from './config.js';
const app = express();
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    next();
});
app.use(express.static(getAppPath('public')));
const startPort = process.env.PORT || 8080;
let server;
let prompt = process.argv[2];
let dataSourcePath = getAbsolutePath(process.argv[3]);
let dataOutputPath = getAbsolutePath(process.argv[4]);

if (!prompt || !dataSourcePath || !dataOutputPath) {
    console.log('사용법: node server.js "<프롬프트|프롬프트를담은파일경로>" <데이터소스경로> <데이터출력경로>');
    process.exit(1);
}

validatePath(dataSourcePath, '데이터 소스 경로');
validatePath(dataOutputPath, '데이터 출력 경로');
if (config.useDocker) validatePath(config.dockerWorkDir, 'Docker 작업 경로');

(async () => {
    if (fs.existsSync(getAbsolutePath(prompt))) {
        prompt = fs.readFileSync(getAbsolutePath(prompt), 'utf8');
    }

    try {
        await validateAndCreatePaths(dataSourcePath);
        dataOutputPath = await prepareOutputDir(dataOutputPath);
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }

    try {
        const PORT = await findAvailablePort(startPort);
        server = app.listen(PORT, async () => await solveLogic({ PORT, server, multiLineMission: prompt, dataSourcePath, dataOutputPath }));
    } catch (err) {
        console.error('Error while setting up port:', err);
        process.exit(1);
    }
})();
