import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Listen for console logs and errors
        page.on("console", lambda msg: print(f"Browser console: {msg.type}: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Browser page error: {err}"))

        # Inject a robust mock of window.macdrop
        await page.add_init_script("""
            window.macdrop = {
                onStatusUpdate: (callback) => {
                    window._onStatusUpdate = callback;
                    return () => {}; // Cleanup function
                },
                onDownloadProgress: () => () => {},
                onProgressUpdate: () => () => {},
                onConnectionRequest: () => () => {},
                onMobileTokenUpdate: (callback) => {
                    window._onMobileTokenUpdate = callback;
                    return () => {}; // Cleanup function
                },
                onFileHistoryUpdate: (callback) => {
                    window._onFileHistoryUpdate = callback;
                    return () => {}; // Cleanup function
                },
                acceptConnection: async () => {},
                rejectConnection: async () => {},
                getStatus: async () => {
                    return {
                        deviceName: "Jules PC",
                        deviceId: "pc-123",
                        isDiscoverable: true,
                        serverPort: 45000,
                        pairedDevices: [
                            {
                                id: "mobile-web",
                                deviceId: "mobile-web",
                                originalName: "Mobile (Web Drop)",
                                name: "Mobile (Web Drop)",
                                os: "unknown",
                                isConnected: true,
                                canReceive: true
                            }
                        ]
                    };
                },
                getMobileToken: async () => "test-token",
                regenerateMobileToken: async () => "new-test-token",
                toggleDiscoverability: async () => {},
                getPairedDevices: async () => [
                    {
                        id: "mobile-web",
                        deviceId: "mobile-web",
                        originalName: "Mobile (Web Drop)",
                        name: "Mobile (Web Drop)",
                        os: "unknown",
                        isConnected: true,
                        canReceive: true
                    }
                ],
                removeDevice: async () => {},
                toggleDeviceReceive: async () => {},
                getDownloadsDir: async () => "/Downloads",
                openFile: async () => {},
                openInFolder: async () => {},
                getFileHistory: async () => [],
                clearFileHistory: async () => {},
                chooseFiles: async () => {},
                chooseFolder: async () => {},
                getConfig: async () => ({ deviceName: "Jules PC", targetFolder: "/Downloads", deviceId: "pc-123", autoStart: false, notifications: true }),
                updateConfig: async () => {},
                onConfigUpdate: (callback) => {
                    window._onConfigUpdate = callback;
                    return () => {};
                },
                getNetworkStatus: async () => ({ ip: "192.168.1.100", activeInterface: "en0" }),
                getPlatform: async () => "darwin",
                sendItem: async () => {},
                cancelTransfer: async () => {}
            };
        """)

        print("Navigating to http://localhost:4173")
        await page.goto("http://localhost:4173")

        # Wait for something to render
        await page.wait_for_timeout(2000)

        # Trigger a state update just in case React needs it to render
        await page.evaluate("""
            if (window._onConfigUpdate) {
                window._onConfigUpdate({ deviceName: "Jules PC", targetFolder: "/Downloads", deviceId: "pc-123", autoStart: false, notifications: true });
            }
            if (window._onStatusUpdate) {
                window._onStatusUpdate({
                    deviceName: "Jules PC",
                    deviceId: "pc-123",
                    isDiscoverable: true,
                    serverPort: 45000,
                    pairedDevices: [
                        {
                            id: "mobile-web",
                            deviceId: "mobile-web",
                            originalName: "Mobile (Web Drop)",
                            name: "Mobile (Web Drop)",
                            os: "unknown",
                            isConnected: true,
                            canReceive: true
                        }
                    ]
                });
            }
        """)

        await page.wait_for_timeout(1000)

        print("Taking screenshot...")
        await page.screenshot(path="verification_ui.png")
        print("Clicking on the mobile device...")

        # Click on the device to show detail view
        try:
            await page.click("text=Mobile (Web Drop)", timeout=2000)
            await page.wait_for_timeout(1000)
            await page.screenshot(path="verification_detail.png")
        except Exception as e:
            print(f"Could not click: {e}")

        print("Done.")

        await browser.close()

asyncio.run(main())
