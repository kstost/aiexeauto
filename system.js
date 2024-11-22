import path from 'path';
import net from 'net';
import chalk from 'chalk';
import fs from 'fs';
import { config } from './config.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export function getAppPath(itemPath) {
    return getAbsolutePath(path.join(__dirname, itemPath));
}
function isPortAvailable(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', () => resolve(false));
        server.once('listening', () => {
            server.close();
            resolve(true);
        });
        server.listen(port);
    });
}
export async function findAvailablePort(startPort) {

    let port = startPort;
    while (!(await isPortAvailable(port))) {
        port++;
        if (port > 65535) {
            throw new Error('No available ports found.');
        }
    }
    return port;
}
export function getAbsolutePath(itemPath) {
    if (!path.isAbsolute(itemPath)) {
        return path.join(process.cwd(), itemPath);
    }
    return itemPath;
}

export function validatePath(path, pathType) {
    const invalidChars = ['"', "'", ' ', '\\'];
    if (invalidChars.some(char => path.includes(char))) {
        console.log(chalk.red(`${pathType}에 공백(" "), 작은따옴표('), 큰따옴표("), 역슬래시(\\)를 포함할 수 없습니다.`));
        process.exit(1);
    }
}
export async function prepareOutputDir(outputDir) {
    // 끝의 모든 슬래시 제거
    let baseDir = outputDir;
    while (baseDir.endsWith('/')) {
        baseDir = baseDir.slice(0, -1).trim();
    }

    // 사용 가능한 디렉토리명 찾기
    let targetDir = baseDir;
    if (!config.overwriteOutputDir) {
        let suffix = 1;

        while (fs.existsSync(targetDir)) {
            targetDir = `${baseDir}_${suffix++}`;
        }

        // 디렉토리 생성
        await fs.promises.mkdir(targetDir, { recursive: true });
        return targetDir;
    } else {
        await fs.promises.rm(targetDir, { recursive: true, force: true });
        await fs.promises.mkdir(targetDir, { recursive: true });
        return targetDir;
    }
}