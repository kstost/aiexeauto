export const config = {
    openaiApiKey: "",
    groqApiKey: "",
    geminiApiKey: "",
    claudeApiKey: "",
    model: "claude-3-5-haiku-20241022",
    llm: "claude",
    maxIterations: 0,
    threeBackticks: '```',
    useFirstPlan: false,
    dockerImage: 'my-node-ubuntu',
    useDocker: false, // Docker 사용 여부 (false: 도커 아닌 웹컨테이너 사용, true: 도커 사용함) 윈도우즈에서는 도커 지원하지 않음
    useEvaluation: false,
    dockerWorkDir: '/home/ubuntu/work',
    overwriteOutputDir: false, // 덮어쓰기 여부 (false: 덮어쓰지 않음, true: 덮어씀)
}
