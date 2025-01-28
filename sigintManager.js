import { killDockerContainer } from './docker.js';
import { getContainerId, createSpinner, getSpinners } from './solveLogic.js';
process.on('SIGINT', async () => {
    const spinners = {};
    if (handlerOrder.length === 0) {
        const containerId = getContainerId();
        const spinner = getSpinners();
        Object.keys(spinner).forEach(key => {
            spinner[key].stop();
        });
        spinners.docker = createSpinner('도커 컨테이너를 종료하는 중...');
        await killDockerContainer(containerId);
        if (spinners.docker) {
            spinners.docker.succeed('도커 컨테이너가 종료되었습니다.');
        }
        process.exit(1);
    }
    if (handlerOrder.length > 0) {
        const handler = handlerOrder[0];
        await handler();
        removeFirstHandler();
    }
});
const handlerOrder = [];
export function setHandler(handler) {
    handlerOrder.push(handler);
}
export function removeHandler(handler) {
    const index = handlerOrder.indexOf(handler);
    if (index > -1) handlerOrder.splice(index, 1);
}
export function removeFirstHandler() {
    handlerOrder.shift();
}
