import { getAppPath, convertJsonToResponseFormat, getConfiguration, getToolList, getToolData } from './system.js';
import fs from 'fs';

async function leaveLog({ callMode, data }) {
    const trackLog = await getConfiguration('trackLog');
    if (!trackLog) return;
    if (false) {
        const aiLogFolder = getAppPath('logs');
        if (!fs.existsSync(aiLogFolder)) fs.mkdirSync(aiLogFolder);
        const date = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Date.now();
        let contentToLeave = `## callMode: ${callMode}\n\n`;
        {
            fs.writeFileSync(`${aiLogFolder}/${date}.json`, JSON.stringify(data));
            let messages = data.messages;
            for (let i = 0; i < messages.length; i++) {
                contentToLeave += `${'-'.repeat(800)}\n## ${messages[i].role} ##\n${messages[i].content}\n\n`;
            }
            fs.writeFileSync(`${aiLogFolder}/${date}.txt`, contentToLeave);
        }
    } else {
        const aiLogFolder = getAppPath('logs');
        if (!fs.existsSync(aiLogFolder)) fs.mkdirSync(aiLogFolder);
        const date = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Date.now();
        data = JSON.parse(JSON.stringify(data));
        data.callMode = callMode;
        fs.writeFileSync(`${aiLogFolder}/${date}.json`, JSON.stringify(data, undefined, 3));
    }
}
export async function getModel() {
    const llm = await getConfiguration('llm');
    const model = llm === 'claude'
        ? await getConfiguration('model')
        : llm === 'deepseek'
            ? await getConfiguration('deepseekModel')
            : llm === 'openai'
                ? await getConfiguration('openaiModel')
                : null;
    return model;
}
export async function chatCompletion(systemPrompt, promptList, callMode) {
    async function requestChatCompletion(systemPrompt, promptList, model) {
        const llm = await getConfiguration('llm');
        let claudeApiKey = await getConfiguration('claudeApiKey');
        let deepseekApiKey = await getConfiguration('deepseekApiKey');
        let openaiApiKey = await getConfiguration('openaiApiKey');

        let useDocker = await getConfiguration('useDocker');
        claudeApiKey = claudeApiKey.trim();
        deepseekApiKey = deepseekApiKey.trim();
        openaiApiKey = openaiApiKey.trim();

        if (!claudeApiKey) throw new Error('Claude API 키가 설정되어 있지 않습니다.');
        if (!deepseekApiKey) throw new Error('DeepSeek API 키가 설정되어 있지 않습니다.');
        if (!openaiApiKey) throw new Error('OpenAI API 키가 설정되어 있지 않습니다.');


        let tool_choice_list = {
            getRequiredPackageNames: { type: "tool", name: "npm_package_names" },
            evaluateCode: { type: "tool", name: "completion_verdict" },
            generateCode: { type: "any" }
        };
        let toolsList = {
            getRequiredPackageNames: [
                {
                    "name": "npm_package_names",
                    "description": "get the names of npm packages used in the code.",
                    "input_schema": convertJsonToResponseFormat({ npm_package_list: [""] }, { npm_package_list: "array of npm package names used in the code" }).json_schema.schema
                },
            ],
            evaluateCode: [
                {
                    "name": "completion_verdict",
                    "description": "verdict whether the mission is solved.",
                    "input_schema": convertJsonToResponseFormat(
                        { evaluation: "", reason: "" },
                        { evaluation: "Respond with the result based on whether the mission was successfully completed e.g, ENDOFMISSION or NOTSOLVED or GIVEUPTHEMISSION", reason: "Explain the reason for the verdict in korean of short length" }
                    ).json_schema.schema
                },
            ],
            generateCode: [
                {
                    "name": "read_file",
                    "description": "Read a file.",
                    "input_schema": convertJsonToResponseFormat({ file_path: "" }, { file_path: "file path to read, e.g, ./program/package.json" }).json_schema.schema
                },
                {
                    "name": "list_directory",
                    "description": "List a directory.",
                    "input_schema": convertJsonToResponseFormat({ directory_path: "" }, { directory_path: "directory path to list, e.g, ./program" }).json_schema.schema
                },
                {
                    "name": "read_url",
                    "description": "Read a URL.",
                    "input_schema": convertJsonToResponseFormat({ url: "" }, { url: "url to read, e.g, https://cokac.com/robots.txt" }).json_schema.schema
                },
                {
                    "name": "rename_file_or_directory",
                    "description": "Rename a file or directory.",
                    "input_schema": convertJsonToResponseFormat({ old_path: "", new_path: "" }, { old_path: "old file or directory path to rename, e.g, ./program/package.json", new_path: "new file or directory path to rename, e.g, ./program/package2.json" }).json_schema.schema
                },
                {
                    "name": "remove_file",
                    "description": "Remove a file.",
                    "input_schema": convertJsonToResponseFormat({ file_path: "" }, { file_path: "file path to remove, e.g, ./program/package.json" }).json_schema.schema
                },
                {
                    "name": "remove_directory_recursively",
                    "description": "Remove a directory recursively.",
                    "input_schema": convertJsonToResponseFormat({ directory_path: "" }, { directory_path: "directory path to remove recursively, e.g, ./program" }).json_schema.schema
                },
                useDocker ? {
                    "name": "apt_install",
                    "description": "Install a package using apt.",
                    "input_schema": convertJsonToResponseFormat({ package_name: "" }, { package_name: "package name to install, e.g, ffmpeg" }).json_schema.schema
                } : null,
                true ? {
                    "name": "which_command",
                    "description": "Check if a command exists.",
                    "input_schema": convertJsonToResponseFormat({ command: "" }, { command: "command to check, e.g, ffmpeg" }).json_schema.schema
                } : null,
                true ? {
                    "name": "run_command",
                    "description": "Run a shell command.",
                    "input_schema": convertJsonToResponseFormat({ command: "" }, { command: "shell command to run, e.g, ls -al" }).json_schema.schema
                } : null,
                ...(await (async () => {
                    const toolList = await getToolList();
                    let toolPrompts = [];
                    for (let tool of toolList) {
                        const toolData = await getToolData(tool);
                        toolData.spec.input_schema = convertJsonToResponseFormat(...toolData.spec.input_schema).json_schema.schema;
                        toolPrompts.push(toolData.spec);
                    }
                    return toolPrompts;
                })())
            ].filter(t => t !== null),
        }
        let tools = toolsList[callMode];

        const requestAI = async (llm, callMode, data, url, headers) => {
            while (true) {
                await leaveLog({ callMode, data });
                let response;
                try {
                    response = await fetch(url, {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify(data)
                    });
                } catch (err) {
                    await leaveLog({ callMode, data: { resultError: err } });
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    continue;
                }
                let result = await response.text();
                await leaveLog({ callMode, data: { resultText: result } });
                try {
                    result = JSON.parse(result);
                } catch {
                    await leaveLog({ callMode, data: { resultErrorJSON: result } });
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    continue;
                }
                const errorMessage = result?.error?.message || '';
                if (errorMessage) {
                    if (errorMessage.includes('rate limit') || errorMessage.includes('Overloaded')) {
                        await leaveLog({ callMode, data: { resultErrorSystem: result } });
                        await new Promise(resolve => setTimeout(resolve, 5000));
                        continue;
                    }
                    throw new Error(errorMessage);
                }
                if (llm === 'claude') {
                    if (tools) {
                        try {
                            let data = result?.content?.filter(c => c.type === 'tool_use')[0];
                            if (!data) throw null;
                            return data;
                        } catch {
                            continue;
                        }
                    }
                    let text = result?.content?.[0]?.text;
                    return text || '';
                }
                if (llm === 'deepseek') {
                    if (tools) {
                        try {
                            let toolCall = result?.choices?.[0]?.message?.tool_calls?.[0];
                            if (!toolCall) throw null;
                            return {
                                type: 'tool_use',
                                name: toolCall.function.name,
                                input: JSON.parse(toolCall.function.arguments)
                            };
                        } catch {
                            continue;
                        }
                    }
                    let text = result?.choices?.[0]?.message?.content;
                    return text || '';
                }

                // New branch for OpenAI
                if (llm === 'openai') {
                    if (tools) {
                        try {
                            let toolCall = result?.choices?.[0]?.message?.tool_calls?.[0];
                            if (!toolCall) throw null;
                            return {
                                type: 'tool_use',
                                name: toolCall.function.name,
                                input: JSON.parse(toolCall.function.arguments)
                            };
                        } catch {
                            continue;
                        }
                    }
                    let text = result?.choices?.[0]?.message?.content;
                    return text || '';
                }
            }

        };


        // => Now for openai:
        if (llm === 'openai') {
            // The request URL
            const url = "https://api.openai.com/v1/chat/completions";
            const headers = {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${openaiApiKey}`
            };
            if (tools) {
                tools = JSON.parse(JSON.stringify(tools)).map(function_ => {
                    function_.parameters = function_.input_schema;
                    delete function_.input_schema;
                    return {
                        "type": "function",
                        "function": function_
                    }
                })
            }
            const data = {
                model: model,
                messages: promptList.map(p => ({
                    role: p.role === "assistant" ? "assistant" : "user",
                    content: p.content
                })),
                tools: tools,
            };
            data.messages = [
                {
                    role: "system",
                    content: systemPrompt
                },
                ...data.messages
            ];
            return await requestAI(llm, callMode, data, url, headers);
        }


        if (llm === 'deepseek') {
            const url = "https://api.deepseek.com/chat/completions";
            const headers = {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${deepseekApiKey}`
            };
            if (tools) {
                tools = JSON.parse(JSON.stringify(tools)).map(function_ => {
                    function_.parameters = function_.input_schema;
                    delete function_.input_schema;
                    return {
                        "type": "function",
                        "function": function_
                    }
                })
            }
            const data = {
                model: model,
                messages: promptList.map(p => ({
                    role: p.role === "assistant" ? "assistant" : "user",
                    content: p.content
                })),
                tools: tools,
            };
            data.messages = [
                {
                    role: "system",
                    content: systemPrompt
                },
                ...data.messages
            ];
            return await requestAI(llm, callMode, data, url, headers);
        }
        if (llm === 'claude') {
            const url = "https://api.anthropic.com/v1/messages";
            const CLAUDE_API_KEY = claudeApiKey;
            const headers = {
                "x-api-key": `${CLAUDE_API_KEY}`,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            };
            const data = {
                model: model,
                system: systemPrompt,
                messages: promptList.map(p => ({
                    role: p.role === "assistant" ? "assistant" : "user",
                    content: p.content
                })),
                max_tokens: 4096, // 토큰 수를 늘림
                tools: tools,
                tool_choice: tool_choice_list[callMode]
            };
            return await requestAI(llm, callMode, data, url, headers);
        }
    }
    const model = await getModel();
    const responseData = await requestChatCompletion(systemPrompt, promptList, model);
    return responseData;
}

