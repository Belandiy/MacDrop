const path = require('path');
const { execSync } = require('child_process');
const { rcedit } = require('rcedit');

exports.default = async function (context) {
  if (context.electronPlatformName !== 'win32') return;

  const appName = context.packager.appInfo.productFilename;
  const exePath = path.join(context.appOutDir, `${appName}.exe`);
  const iconPath = path.resolve(context.packager.projectDir, 'public/icon.ico');

  console.log(`[afterPack] Embedding Windows icon into ${exePath}...`);
  try {
    await rcedit(exePath, {
      icon: iconPath,
      'version-string': {
        FileDescription: 'MacDrop',
        ProductName: 'MacDrop',
        CompanyName: 'Belandiy',
        LegalCopyright: 'Copyright © 2026 Andrey'
      }
    });
    console.log(`[afterPack] Successfully embedded Windows icon into ${exePath}!`);
  } catch (err) {
    console.error(`[afterPack] Failed to embed icon with rcedit:`, err);
  }

  // Notify Windows Explorer to flush icon cache for this folder
  try {
    const notifyScript = `
      Add-Type -TypeDefinition @"
      using System;
      using System.Runtime.InteropServices;
      public class ShellNotify {
        [DllImport("shell32.dll")]
        public static extern void SHChangeNotify(int wEventId, int uFlags, IntPtr dwItem1, IntPtr dwItem2);
      }
"@
      [ShellNotify]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
    `;
    execSync(`powershell -NoProfile -Command "${notifyScript.replace(/\r?\n/g, ' ')}"`, { stdio: 'ignore' });
    console.log(`[afterPack] Notified Windows Shell to refresh icon cache.`);
  } catch (e) {
    // Non-fatal
  }
};

