const { performance } = require('perf_hooks');

const NUM_DEVICES = 100;
const ITERATIONS = 1_000_000;

const devices = [];
const deviceMap = new Map();

for (let i = 0; i < NUM_DEVICES; i++) {
  const device = { id: `device-${i}`, name: `Device ${i}` };
  devices.push(device);
  deviceMap.set(device.id, device);
}

const targetId = `device-${NUM_DEVICES - 1}`;

console.log(`Benchmarking with ${NUM_DEVICES} devices, ${ITERATIONS} iterations...`);

const startFind = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  devices.find(d => d.id === targetId);
}
const endFind = performance.now();
const timeFind = endFind - startFind;

const startMap = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  deviceMap.get(targetId);
}
const endMap = performance.now();
const timeMap = endMap - startMap;

console.log(`Array.find(): ${timeFind.toFixed(2)} ms`);
console.log(`Map.get():    ${timeMap.toFixed(2)} ms`);
console.log(`Improvement:  ${(timeFind / timeMap).toFixed(2)}x faster`);
