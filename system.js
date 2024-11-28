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
    const invalidChars = isWindows() ? ['"', "'"] : ['"', "'", ' '];
    if (invalidChars.some(char => path.includes(char))) {
        if (isWindows()) {
            console.log(chalk.red(`${pathType} 경로에는 작은따옴표('), 큰따옴표(")를 사용할 수 없습니다.`));
        } else {
            console.log(chalk.red(`${pathType} 경로에는 공백(" "), 작은따옴표('), 큰따옴표(")를 사용할 수 없습니다.`));
        }
        process.exit(1);
    }
}
export function getOS() {
    return process.platform;
}
export function isWindows() {
    return getOS() === 'win32';
}
export function getOSPathSeparator() {
    return isWindows() ? '\\' : '/';
}

export async function prepareOutputDir(outputDir) {
    // 끝의 모든 슬래시 제거
    let baseDir = outputDir;
    while (baseDir.endsWith('/') || baseDir.endsWith('\\')) {
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

// export function convertJsonToResponseFormat(struct) {
//     const getType = (value) => {
//         if (value === null) return "null";
//         if (Array.isArray(value)) return "array";
//         if (typeof value === "boolean") return "boolean";
//         if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
//         if (typeof value === "string") return "string";
//         if (typeof value === "object") return "object";
//         return "unknown";
//     };

//     const generateSchema = (data) => {
//         const dataType = getType(data);

//         if (dataType === "object") {
//             const properties = {};
//             const required = [];
//             for (const key in data) {
//                 if (data.hasOwnProperty(key)) {
//                     properties[key] = generateSchema(data[key]);
//                     required.push(key);
//                 }
//             }
//             return {
//                 type: "object",
//                 properties: properties,
//                 required: required
//             };
//         } else if (dataType === "array") {
//             if (data.length === 0) {
//                 return { type: "array", items: {} };
//             }
//             const itemSchemas = data.map(item => generateSchema(item));
//             const firstItemSchemaStr = JSON.stringify(itemSchemas[0]);
//             const allSame = itemSchemas.every(
//                 itemSchema => JSON.stringify(itemSchema) === firstItemSchemaStr
//             );
//             return {
//                 type: "array",
//                 items: allSame ? itemSchemas[0] : {}
//             };
//         } else {
//             return { type: dataType };
//         }
//     };

//     const schema = generateSchema(struct);
//     schema["$schema"] = "http://json-schema.org/draft-07/schema#";
//     schema["additionalProperties"] = false;

//     return {
//         type: "json_schema",
//         json_schema: {
//             name: "response",
//             schema: schema,
//             strict: true
//         }
//     };
// }

// // 함수 호출 예시
// // console.log(convertJsonToResponseFormat({ result: true }));















































export function convertJsonToResponseFormat(struct, descriptions = {}) {
    const getType = (value) => {
        if (value === null) return "null";
        if (Array.isArray(value)) return "array";
        if (typeof value === "boolean") return "boolean";
        if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
        if (typeof value === "string") return "string";
        if (typeof value === "object") return "object";
        return "unknown";
    };

    const generateSchema = (data, desc) => {
        const dataType = getType(data);
        let schema = {};

        if (dataType === "object") {
            const properties = {};
            const required = [];
            for (const key in data) {
                if (data.hasOwnProperty(key)) {
                    const propertyDesc = desc && desc[key] ? desc[key] : {};
                    properties[key] = generateSchema(data[key], propertyDesc);
                    required.push(key);
                }
            }
            schema = {
                type: "object",
                properties: properties,
                required: required
            };
        } else if (dataType === "array") {
            if (data.length === 0) {
                schema = { type: "array", items: {} };
            } else {
                const itemSchemas = data.map(item => generateSchema(item, desc));
                const firstItemSchemaStr = JSON.stringify(itemSchemas[0]);
                const allSame = itemSchemas.every(
                    itemSchema => JSON.stringify(itemSchema) === firstItemSchemaStr
                );
                schema = {
                    type: "array",
                    items: allSame ? itemSchemas[0] : {}
                };
            }
        } else {
            schema = { type: dataType };
        }

        // Add description if provided
        if (desc && typeof desc === 'string') {
            schema.description = desc;
        }

        return schema;
    };

    const schema = generateSchema(struct, descriptions);
    schema["$schema"] = "http://json-schema.org/draft-07/schema#";
    schema["additionalProperties"] = false;

    return {
        type: "json_schema",
        json_schema: {
            name: "response",
            schema: schema,
            strict: true
        }
    };
}

// 함수 호출 예시
// console.log(convertJsonToResponseFormat({ result: true }, { result: "description" }));
