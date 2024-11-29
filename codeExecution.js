import { chatCompletion } from './aiFeatures.js';

export function checkValidSyntaxJavascript(code) {
    try {
        new Function(code);
        return {
            isValid: true,
            error: null
        };
    } catch (err) {
        return {
            isValid: false,
            error: {
                name: err.name,
                message: err.message,
                line: err.lineNumber,
                column: err.columnNumber
            }
        };
    }
}

export function stripFencedCodeBlocks(content) {
    const lines = content.split('\n');
    let inCodeBlock = false;
    let code = '';
    let hasCodeBlocks = false;

    for (let line of lines) {
        if (line.startsWith('```')) {
            inCodeBlock = !inCodeBlock; // inCodeBlock 상태를 토글합니다.
            hasCodeBlocks = true; // 펜스 코드 블록이 있음을 표시합니다.
            continue; // ```가 있는 라인은 건너뜁니다.
        }

        if (inCodeBlock) {
            code += line + '\n'; // 코드를 누적합니다.
        }
    }

    if (!hasCodeBlocks) {
        // 펜스 코드 블록이 없는 경우 전체 내용을 코드로 취급합니다.
        code = content;
    }

    return code.trim(); // 앞뒤 공백을 제거합니다.
}


const installHistory = {};
let npmInit = false;
export function isInstalledNpmPackage(packageName) {
    return !!installHistory[packageName];
}
export async function installNpmPackage(page, packageName) {
    const result = await page.evaluate(async (packageName, npmInit, installHistory) => {
        if (!npmInit) {
            await window._electrons.spawn('npm', ['init', '-y']);
            npmInit = true;
        }
        if (!installHistory[packageName]) {
            await window._electrons.spawn('npm', ['install', packageName]);
            installHistory[packageName] = true;
        }
        return { npmInit, installHistory };
    }, packageName, npmInit, installHistory);
    Object.keys(result.installHistory).forEach(name => installHistory[name] = true);
    npmInit = result.npmInit;
}
export async function runCode(page, code, requiredPackageNames) {
    const result = await page.evaluate(async (code, requiredPackageNames) => {
        for (let packageName of requiredPackageNames) await installNpmPackage(page, packageName);
        const operation = `
        try{
            {
                const fs = require('fs');
                const path = require('path');
                const prefixName = 'AIEXE-data-handling-';
                const tempFiles = fs.readdirSync('.');
                for (const file of tempFiles) {
                    if (file.startsWith(prefixName)) {
                        fs.unlinkSync(file);
                    }
                }
            }
            ${code}
        }catch(err){
            console.error(err.name+'::: '+err.message);
            process.exit(1);
        }`;
        await window._electrons.mount('AIEXE-data-handling-operation.js', operation);
        return await window._electrons.spawn('node', ['AIEXE-data-handling-operation.js']);
    }, code, requiredPackageNames);
    return result;
}

export async function getRequiredPackageNames(javascriptCode, prompts) {
    let requiredPackageNames = [];
    const packageNamesResponse = await chatCompletion(
        prompts.packageNamesPrompt,
        [{ role: "user", content: javascriptCode }],
        'getRequiredPackageNames'
    );
    let npmList = packageNamesResponse?.input?.npm_package_list;
    if (!npmList) npmList = [];
    if (npmList.constructor !== Array) npmList = [];
    try {
        requiredPackageNames = npmList.filter(name => typeof name === 'string' && name.trim() !== '');
    } catch (e) {
        requiredPackageNames = [];
    }
    return requiredPackageNames;
}