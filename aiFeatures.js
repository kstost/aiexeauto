import { config } from './config.js';
import { getAppPath, convertJsonToResponseFormat } from './system.js';
import fs from 'fs';

async function leaveLog({ callMode, data }) {
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
}
export async function chatCompletion(systemPrompt, promptList, callMode) {
    async function requestChatCompletion(systemPrompt, promptList, model) {
        const llm = config.llm;
        if (llm === 'openai') {
            const url = "https://api.openai.com/v1/chat/completions";
            const OPENAI_API_KEY = config.openaiApiKey;
            const headers = {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json"
            };
            const data = {
                model: model,
                messages: [{ role: "system", content: systemPrompt }, ...promptList],
            };
            await leaveLog({ callMode, data });
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(data)
            });
            const result = await response.json();
            // console.log(result);
            try {
                return result.choices[0].message.content;
            } catch (e) {
                throw new Error(result?.error?.message);
            }
        } else if (llm === 'claude') {
            const url = "https://api.anthropic.com/v1/messages";
            const CLAUDE_API_KEY = config.claudeApiKey;
            const headers = {
                "x-api-key": `${CLAUDE_API_KEY}`,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            };
            let tool_choice_list = {
                evaluateCode: { type: "tool", name: "evaluate_mission" },
                generateCode: { type: "tool", name: "generate_code" }
            };
            let toolName = {
                evaluateCode: 'evaluation',
                generateCode: 'nodejs_code'
            };
            let toolsList = {
                evaluateCode: [
                    {
                        "name": "evaluate_mission",
                        "description": "미션 완수 여부를 판단.",
                        "input_schema": convertJsonToResponseFormat({ evaluation: "" }, { evaluation: "ENDOFMISSION or NOTSOLVED" }).json_schema.schema
                    }
                ],
                generateCode: [
                    {
                        "name": "generate_code",
                        "description": "코드를 생성.",
                        "input_schema": convertJsonToResponseFormat({ nodejs_code: "" }, { nodejs_code: "nodejs code for the only one task" }).json_schema.schema
                    }
                ]
            }
            let tools = toolsList[callMode];
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
            while (true) {
                await leaveLog({ callMode, data });
                const response = await fetch(url, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                const errorMessage = result?.error?.message || '';
                if (errorMessage) {
                    if (errorMessage.includes('rate limit')) {
                        await new Promise(resolve => setTimeout(resolve, 5000));
                        continue;
                    }
                    throw new Error(errorMessage);
                }
                if (false && tools) console.log(JSON.stringify(result, undefined, 3));
                if (false) console.log(JSON.stringify(result, undefined, 3));
                if (toolName[callMode]) {
                    try {
                        let data = result?.content?.filter(c => c.type === 'tool_use')[0]?.input[toolName[callMode]];
                        if (!data) throw null;
                        return data;
                    } catch {
                        continue;
                    }
                }
                let text = result?.content?.[0]?.text;
                return text || '';
            }
        } else if (llm === 'groq') {
            let code = '';
            while (true) {
                const url = "https://api.groq.com/openai/v1/chat/completions";
                const GROQ_API_KEY = config.groqApiKey;
                const headers = {
                    "Authorization": `Bearer ${GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                };
                const data = {
                    model: model,
                    messages: [{ role: "system", content: systemPrompt }, ...promptList],
                };
                const response = await fetch(url, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                code = result?.choices?.[0]?.message?.content;
                if (!code) code = '';
                if (code) break;
                if (!code) {
                    const message = (result?.error?.message);
                    let waitTime = 60000;
                    if (message) {
                        if (message.includes('Please try again in')) {
                            const extractTime = (str) => {
                                let totalMilliseconds = 0;
                                let milliseconds = str.match(/(\d+)ms/);
                                if (milliseconds) totalMilliseconds += parseInt(milliseconds[1], 10);
                                let minutes = str.match(/(\d+)m(?!s)/);
                                if (minutes) totalMilliseconds += parseInt(minutes[1], 10) * 60000;
                                let seconds = str.match(/(\d+\.?\d*)s/);
                                if (seconds) totalMilliseconds += parseFloat(seconds[1]) * 1000;
                                return totalMilliseconds;
                            }
                            const timeStr = message.split('Please try again in ')[1];
                            const extractedTime = extractTime(timeStr);
                            waitTime = extractedTime || waitTime;
                        } else {
                            throw new Error(message);
                        }
                    }
                    if (message) console.log(message, waitTime);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
            return code;
        } else if (llm === 'gemini') {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.geminiApiKey}`;
            const headers = { 'Content-Type': 'application/json' };
            const messages = [
                { role: "user", parts: [{ text: systemPrompt }] },
                { role: "model", parts: [{ text: "I understand. I will help you." }] },
                ...promptList.map(p => {
                    if (p.role === 'system') {
                        return { role: 'user', parts: [{ text: p.content }] };
                    } else if (p.role === 'assistant') {
                        return { role: 'model', parts: [{ text: p.content }] };
                    }
                    return { role: p.role, parts: [{ text: p.content }] };
                })
            ];
            const data = {
                contents: messages,
                generationConfig: {
                    responseMimeType: "text/plain"
                }
            };
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                if (result?.error?.message) throw new Error('Google API 오류: ' + result.error.message);
                if (!result?.candidates?.[0]?.content?.parts?.[0]?.text) {
                    throw new Error('응답 데이터 형식이 올바르지 않습니다');
                }
                return result.candidates[0].content.parts[0].text;
            } catch (error) {
                throw error;
            }
        }
    }
    const responseData = await requestChatCompletion(systemPrompt, promptList, config.model);
    return responseData;
}

