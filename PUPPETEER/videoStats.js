const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/chromium-browser',
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const client = await page.target().createCDPSession(); // Connect to Chrome DevTools

    console.log("Loading YouTube...");
    await page.goto('https://www.youtube.com/watch?v=8QcQ_128OIw', { waitUntil: 'load' });

    try {
        console.log("Checking for cookie consent banner...");

        // Accept Cookies
        await page.waitForSelector('button[aria-label="Accept the use of cookies and other data for the purposes described"]', { timeout: 5000 });
        await page.click('button[aria-label="Accept the use of cookies and other data for the purposes described"]');
        console.log("Cookies accepted successfully.");

        await page.waitForTimeout(2000);
    } catch (error) {
        console.log("No cookie banner found. Moving on...");
    }

    await page.setBypassCSP(true);
    await page.evaluate(() => {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            for (let registration of registrations) {
                registration.unregister();
            }
        });
    });
    console.log("Bypassing cache server and unregistering...");

    console.log("Proceeding with video loading...");
    console.log("Listening to video network traffic...");

    await client.send('Network.enable');

    const requestSizes = {}; // Store request sizes
    let logBuffer = []; // Store log entries in memory

    // Track when a video chunk is requested
    client.on('Network.responseReceived', (event) => {
        const url = event.response.url;
        if (url.includes(".googlevideo.com/") && url.includes("videoplayback")) {
            requestSizes[event.requestId] = { url, timestamp: new Date().toISOString() };
        }
    });

    // Track when a video chunk finishes downloading
    client.on('Network.loadingFinished', async (event) => {
        if (requestSizes[event.requestId]) {
            const { url, timestamp } = requestSizes[event.requestId];
            const bytesReceived = event.encodedDataLength; // The actual size of the downloaded chunk

            console.log(`[${timestamp}] Video Chunk: ${bytesReceived} bytes from ${url}`);

            // Add to memory buffer instead of writing directly
            logBuffer.push(`${timestamp},${bytesReceived},${url}`);

            delete requestSizes[event.requestId]; // Clean up memory
        }
    });

    // Write to file every 5 seconds (instead of every chunk)
    setInterval(() => {
        if (logBuffer.length > 0) {
            fs.appendFileSync("youtube_network_log.csv", logBuffer.join("\n") + "\n");
            logBuffer = []; // Clear buffer after writing
        }
    }, 5000);

})();
