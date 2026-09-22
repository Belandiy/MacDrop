const fs = require('fs');
const path = require('path');
const os = require('os');

function getFolderSizeSync(dirPath) {
  let total = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        total += getFolderSizeSync(full);
      } else if (entry.isFile()) {
        try {
          total += fs.statSync(full).size;
        } catch {}
      }
    }
  } catch {}
  return total;
}

async function getFolderSizeAsync(dirPath) {
  let total = 0;
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    // Process sequentially or with limited concurrency to avoid flooding the event loop
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        total += await getFolderSizeAsync(full);
      } else if (entry.isFile()) {
        try {
          const stat = await fs.promises.stat(full);
          total += stat.size;
        } catch {}
      }
    }
  } catch {}
  return total;
}

function measureLag(callback) {
  return new Promise((resolve) => {
    let maxLag = 0;
    let lastTime = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      const lag = now - lastTime - 10;
      if (lag > maxLag) maxLag = lag;
      lastTime = now;
    }, 10);

    setTimeout(async () => {
      // reset last time right before starting
      lastTime = Date.now();
      const start = process.hrtime.bigint();
      const result = await callback();
      const end = process.hrtime.bigint();

      // trigger one more check
      const finalNow = Date.now();
      const finalLag = finalNow - lastTime - 10;
      if (finalLag > maxLag) maxLag = finalLag;

      clearInterval(interval);
      resolve({
        timeMs: Number(end - start) / 1000000,
        lag: maxLag,
        result
      });
    }, 50);
  });
}

async function run() {
  const testDir = path.join(os.tmpdir(), 'macdrop_test_perf_dir_large');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir);
    for (let i = 0; i < 100; i++) {
      const subDir = path.join(testDir, `dir_${i}`);
      fs.mkdirSync(subDir);
      for (let j = 0; j < 500; j++) {
        fs.writeFileSync(path.join(subDir, `file_${j}.txt`), 'hello world');
      }
    }
  }

  console.log("Measuring Sync (Event Loop Lag)...");
  const syncStats = await measureLag(() => {
    return new Promise(resolve => {
       const res = getFolderSizeSync(testDir);
       resolve(res);
    });
  });
  console.log(`Sync size: ${syncStats.result} bytes in ${syncStats.timeMs.toFixed(2)} ms. Max Event Loop Lag: ${syncStats.lag} ms`);

  console.log("Measuring Async (Event Loop Lag)...");
  const asyncStats = await measureLag(() => getFolderSizeAsync(testDir));
  console.log(`Async size: ${asyncStats.result} bytes in ${asyncStats.timeMs.toFixed(2)} ms. Max Event Loop Lag: ${asyncStats.lag} ms`);
}

run();
