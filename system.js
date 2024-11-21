import path from 'path';
import net from 'net';
import chalk from 'chalk';
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
    const invalidChars = ['"', "'", ' '];
    if (invalidChars.some(char => path.includes(char))) {
        console.log(chalk.red(`${pathType}에 공백이나 따옴표를 포함할 수 없습니다.`));
        process.exit(1);
    }
}
