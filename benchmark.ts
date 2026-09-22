async function checkPeerPing(host: string, port: number) {
    return new Promise(resolve => setTimeout(() => resolve(false), 700));
}

async function runSequential(devices: any[]) {
    const start = Date.now();
    for (const peer of devices) {
        await checkPeerPing(peer.ip, 8384);
        await checkPeerPing(peer.remoteIp, 8384);
    }
    console.log('Sequential took', Date.now() - start, 'ms');
}

async function runConcurrent(devices: any[]) {
    const start = Date.now();
    await Promise.all(devices.map(async (peer) => {
        const isLocal = await checkPeerPing(peer.ip, 8384);
        if (isLocal) return;
        const isRemote = await checkPeerPing(peer.remoteIp, 8384);
        if (isRemote) return;
    }));
    console.log('Concurrent took', Date.now() - start, 'ms');
}

const devices = Array.from({length: 10}).map((_, i) => ({
    ip: `192.168.1.${i}`,
    remoteIp: `10.0.0.${i}`
}));

(async () => {
    await runSequential(devices);
    await runConcurrent(devices);
})();
