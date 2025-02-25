const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {

    const browser = await puppeteer.launch({
        userDataDir: "/home/pi/.config/chromium",
        executablePath: '/usr/bin/chromium-browser',
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    const client = await page.target().createCDPSession(); // CDP for network monitoring


    console.log("Navigating to Twitch...");
    await page.goto('https://www.twitch.tv/sinatraavod', { waitUntil: 'networkidle2' });
    await client.send('Network.enable');

    const csvFilePath = "twitch_network_log.csv";
    if (!fs.existsSync(csvFilePath)) {
        fs.writeFileSync(csvFilePath, "UTC_Timestamp,Request_ID,Bytes_Received,Resolution,FPS,Bandwidth_Kbps,Network_Activity_KB,Buffer_Health_s,Frames_Dropped,Total_Frames\n");
    }

    const videoRequests = new Set(); // Stores active video request IDs


    // Wait for settings button
    console.log("Waiting for settings button...");
    await page.waitForSelector('[data-a-target="player-settings-button"]', { timeout: 15000 });

    // Check if button exists before clicking
    const settingsButton = await page.$('[data-a-target="player-settings-button"]');
    if (!settingsButton) {
        console.log("Settings button NOT found!");
        await browser.close();
        return;
    } else {
        console.log("Settings button found!");
    }

    //
    await page.evaluate(() => {
        document.querySelector('[data-a-target="player-settings-button"]');
    });

    //click the settings button and open menu
    //await new Promise(r => setTimeout(r, 1000));
    await settingsButton.click();
    console.log("1.Clicked settings button!");


    // Allow some time for animation
    await new Promise(r => setTimeout(r, 500));

    // Step 3: Click the "Advanced" button
    await page.waitForSelector('[data-a-target="player-settings-menu-item-advanced"]', { timeout: 5000 });
    const advancedSettingsButton = await page.$('[data-a-target="player-settings-menu-item-advanced"]');
    await advancedSettingsButton.click();
    console.log("2.Clicked advanced settings button!");


    // Wait for video stats button
    console.log("Waiting for video stats toggle...");
    await page.waitForSelector('[data-a-target="player-settings-submenu-advanced-video-stats"]', { timeout: 30000 });
    await page.click('[data-a-target="player-settings-submenu-advanced-video-stats"]');
    console.log("3.Clicked video stats!");

    const requestSizes = {};
    const trackedRequests = new Set();

    // Capture ALL requests (including Fetch API & WebSockets)
    client.on('Network.requestWillBeSent', (event) => {
        const url = event.request.url;
        const type = event.request.resourceType ? event.request.resourceType.toUpperCase() : "UNKNOWN"; // Fix applied here ✅

        if (
            url.includes("video-weaver") || 
            url.includes("video-edge") || 
            url.includes(".ttvnw.net") || 
            url.includes(".m3u8") || 
            url.includes(".ts") || 
            url.includes("amazon-ivs")
        ) {
            requestSizes[event.requestId] = { bytes: 0, url, type };
            trackedRequests.add(event.requestId);
            console.log(`[REQUEST] ${type} - ${url}`);
        }
    });

    // Track actual data received
    client.on('Network.dataReceived', async (event) => {
        const requestId = event.requestId;
        const utcTimestamp = Date.now();
        const bytesReceived = event.dataLength;

        if (requestSizes[requestId]) {
            requestSizes[requestId].bytes += bytesReceived;
        }

        // Log to CSV
        if (requestSizes[requestId]) {
            const logEntry = `${utcTimestamp},${requestId},${bytesReceived},${requestSizes[requestId].type},${requestSizes[requestId].url}\n`;
            fs.appendFileSync(csvFilePath, logEntry);
        }

        console.log(`[DATA] ${requestId} - ${bytesReceived} bytes`);
    });

    // Finalize logs when request is finished
    client.on('Network.loadingFinished', (event) => {
        const requestId = event.requestId;

        if (requestSizes[requestId]) {
            console.log(`[COMPLETE] ${requestId} - Total Bytes: ${requestSizes[requestId].bytes} - ${requestSizes[requestId].url}`);
            delete requestSizes[requestId]; // Cleanup to avoid memory buildup
        }
    });

    // Monitor WebSockets (Twitch may stream video over `wss://`)
    client.on('Network.webSocketCreated', (event) => {
        console.log(`[WS] WebSocket Connection Opened: ${event.url}`);
    });

    client.on('Network.webSocketFrameReceived', (event) => {
        console.log(`[WS] WebSocket Frame - ${event.response.payloadData.length} bytes`);
    });

    client.on('Network.webSocketFrameSent', (event) => {
        console.log(`[WS] WebSocket Frame Sent - ${event.response.payloadData.length} bytes`);
    });

    // client.on('Network.responseReceived', (event) => {
    //         const url = event.response.url;
    //         if (url.includes("video-weaver") || url.includes("video-edge") || url.includes(".ttvnw.net")) {
    //             if (url.includes(".ts")) { // Ensure it's a video segment
    //                 videoRequests.add(event.requestId);
    //                 requestSizes[event.requestId] = { bytes: 0, url };
    //                 console.log(`[TRACK] Video Segment Requested: ${url}`);
    //             }
    //         }
    //     });


    //     // Track bytes received for video segments
    // client.on('Network.dataReceived', async (event) => {
    //     const requestId = event.requestId;
    //     const utcTimestamp = Date.now();
    //     const bytesReceived = event.dataLength;

    //     if (!requestSizes.hasOwnProperty(requestId)) {
    //         requestSizes[requestId] = 0; // Initialize if missing
    //     }

    //     requestSizes[requestId] += bytesReceived;

    //     console.log(`[LIVE][${utcTimestamp}][id: ${requestId}][BytesReceived: ${bytesReceived}]`);

    // });

    //     // Log final total bytes when request finishes
    // client.on('Network.loadingFinished', (event) => {
    //     const requestId = event.requestId;

    //     if (videoRequests.has(requestId)) {
    //         console.log(`[FINAL] Request ${requestId} completed. Total Bytes: ${requestSizes[requestId]}`);

    //         // Cleanup
    //         videoRequests.delete(requestId);
    //         delete requestSizes[requestId];
    //     }
    // });


    // Wait for stats to load
    await page.waitForSelector('[data-a-target="player-overlay-video-stats-row"]', { timeout: 10000 });

    // Extract stats
    const stats = await page.evaluate(() => {
        let statsData = {};
        document.querySelectorAll('[data-a-target="player-overlay-video-stats-row"]').forEach(row => {
            let name = row.querySelector('td:first-child p').innerText;
            let value = row.querySelector('td:last-child p').innerText;
            statsData[name] = value;
        });
        return statsData;
    });

    console.log("🎥 Extracted Video Stats:", stats);

    // Keep browser open for debugging
    // await browser.close();
})();





//////////////////////////////////
const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({
        userDataDir: "/home/pi/.config/chromium",
        executablePath: '/usr/bin/chromium-browser',
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const client = await page.target().createCDPSession();

    console.log("Navigating to Twitch...");
    await page.goto('https://www.twitch.tv/kaicenat', { waitUntil: 'networkidle2' });

    console.log("Disabling cache...");
    await client.send('Network.setCacheDisabled', { cacheDisabled: true }); 
    await client.send('Network.enable');

    const csvFilePath = "twitch_segment_data.csv";
    if (!fs.existsSync(csvFilePath)) {
        fs.writeFileSync(csvFilePath, "Timestamp,Request_ID,Bytes_Received,Total_Bytes,URL\n");
    }

    const requestSizes = {}; 

    // 🔥 LOG WHEN A VIDEO SEGMENT REQUEST STARTS
    client.on('Network.requestWillBeSent', (event) => {
        const url = event.request.url;
        
        if (url.includes(".ttvnw.net") && url.includes(".ts")) {  // Only log Twitch video segment requests
            requestSizes[event.requestId] = { url, bytes: 0 };
            console.log(`[START] Request ID: ${event.requestId} - ${url}`);
        }
    });

    // 🔥 LOG CHUNKED DATA AS IT ARRIVES
    client.on('Network.dataReceived', (event) => {
        const requestId = event.requestId;
        const bytesReceived = event.dataLength;

        if (requestSizes[requestId]) {
            requestSizes[requestId].bytes += bytesReceived;
            console.log(`[DATA] ${requestId} - +${bytesReceived} bytes (Total: ${requestSizes[requestId].bytes})`);
            
            // Append each data chunk to CSV
            const logEntry = `${Date.now()},${requestId},${bytesReceived},${requestSizes[requestId].bytes},${requestSizes[requestId].url}\n`;
            fs.appendFileSync(csvFilePath, logEntry);
        }
    });

    // 🔥 LOG FINAL TOTAL BYTES WHEN REQUEST FINISHES
    client.on('Network.loadingFinished', (event) => {
        const requestId = event.requestId;

        if (requestSizes[requestId]) {
            console.log(`[COMPLETE] Request ID: ${requestId} - Total Bytes: ${requestSizes[requestId].bytes} - ${requestSizes[requestId].url}`);

            // Append final total to CSV
            const logEntry = `${Date.now()},${requestId},FINAL,${requestSizes[requestId].bytes},${requestSizes[requestId].url}\n`;
            fs.appendFileSync(csvFilePath, logEntry);

            delete requestSizes[requestId]; 
        }
    });

})();



////

const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({
        userDataDir: "/home/pi/.config/chromium",
        executablePath: '/usr/bin/chromium-browser',
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const client = await page.target().createCDPSession();

    console.log("Navigating to Twitch...");
    await page.goto('https://www.twitch.tv/silky', { waitUntil: 'networkidle2' });

    console.log("Disabling cache & bypassing service workers...");
    await client.send('Network.setCacheDisabled', { cacheDisabled: true });
    await page.evaluate(() => {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
            registrations.forEach((reg) => reg.unregister());
        });
    });

    console.log("Enabling Fetch API tracking...");
    await client.send('Fetch.enable', {}); // Enables deeper Fetch API tracking

    console.log("Starting network monitoring...");
    await client.send('Network.enable');

    const csvFilePath = "twitch_fetch_debug.csv";
    if (!fs.existsSync(csvFilePath)) {
        fs.writeFileSync(csvFilePath, "Timestamp,Request_ID,Event_Type,URL,Status,Content_Type,Other_Info\n");
    }

    const requestData = {}; 

    // 🔥 LOG WHEN A VIDEO SEGMENT REQUEST STARTS
    client.on('Network.requestWillBeSent', (event) => {
        const url = event.request.url;
        if (url.includes(".ttvnw.net") && url.includes(".ts")) {
            requestData[event.requestId] = { url };
            console.log(`[START] Request ID: ${event.requestId} - ${url}`);

            const logEntry = `${Date.now()},${event.requestId},REQUEST_SENT,${url},N/A,N/A,N/A\n`;
            fs.appendFileSync(csvFilePath, logEntry);
        }
    });

    // 🔥 LOG FETCH API REQUESTS
    client.on('Fetch.requestPaused', async (event) => {
        if (event.request.url.includes(".ttvnw.net") && event.request.url.includes(".ts")) {
            console.log(`[FETCH API] Caught request: ${event.request.url}`);

            const logEntry = `${Date.now()},${event.requestId},FETCH_REQUEST,${event.request.url},N/A,N/A,N/A\n`;
            fs.appendFileSync(csvFilePath, logEntry);
        }

        await client.send('Fetch.continueRequest', { requestId: event.requestId }); // Let the request continue
    });

    // 🔥 LOG RESPONSE DETAILS
    client.on('Network.responseReceived', (event) => {
        const requestId = event.requestId;
        if (requestData[requestId]) {
            const contentType = event.response.mimeType || "UNKNOWN";
            console.log(`[RESPONSE] ${requestId} - Content-Type: ${contentType}`);

            const logEntry = `${Date.now()},${requestId},RESPONSE_RECEIVED,${requestData[requestId].url},${event.response.status},${contentType},N/A\n`;
            fs.appendFileSync(csvFilePath, logEntry);
        }
    });

    // 🔥 LOG FINAL REQUEST COMPLETION
    client.on('Network.loadingFinished', (event) => {
        const requestId = event.requestId;
        if (requestData[requestId]) {
            console.log(`[COMPLETE] Request ID: ${requestId} - ${requestData[requestId].url}`);

            const logEntry = `${Date.now()},${requestId},REQUEST_COMPLETED,${requestData[requestId].url},N/A,N/A,N/A\n`;
            fs.appendFileSync(csvFilePath, logEntry);

            delete requestData[requestId];
        }
    });

})();



////


const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({
        userDataDir: "/home/pi/.config/chromium",
        executablePath: '/usr/bin/chromium-browser',
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const client = await page.target().createCDPSession();

    console.log("Navigating to Twitch...");
    await page.goto('https://www.twitch.tv/kaicenat', { waitUntil: 'networkidle2' });

    console.log("Disabling cache & bypassing service workers...");
    await client.send('Network.setCacheDisabled', { cacheDisabled: true });
    await page.evaluate(() => {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
            registrations.forEach((reg) => reg.unregister());
        });
    });

    console.log("Enabling Fetch API tracking...");
    await client.send('Fetch.enable', {}); // Enables deeper Fetch API tracking

    console.log("Starting network monitoring...");
    await client.send('Network.enable');

    const csvFilePath = "twitch_fetch_debug.csv";
    if (!fs.existsSync(csvFilePath)) {
        fs.writeFileSync(csvFilePath, "Timestamp,Request_ID,Event_Type,URL,Status,Content_Type,Bytes_Received,Total_Bytes\n");
    }

    const requestData = {}; // Store active requests

    // 🔥 LOG WHEN A VIDEO SEGMENT REQUEST STARTS
    client.on('Network.requestWillBeSent', (event) => {
        const url = event.request.url;
        if (url.includes(".ttvnw.net") && url.includes(".ts")) {
            requestData[event.requestId] = { url, bytes: 0 };
            console.log(`[START] Request ID: ${event.requestId} - ${url}`);

            const logEntry = `${Date.now()},${event.requestId},REQUEST_SENT,${url},N/A,N/A,0,0\n`;
            fs.appendFileSync(csvFilePath, logEntry);
        }
    });

    // 🔥 LOG FETCH API REQUESTS
    client.on('Fetch.requestPaused', async (event) => {
        if (event.request.url.includes(".ttvnw.net") && event.request.url.includes(".ts")) {
            console.log(`[FETCH API] Caught request: ${event.request.url}`);

            const logEntry = `${Date.now()},${event.requestId},FETCH_REQUEST,${event.request.url},N/A,N/A,0,0\n`;
            fs.appendFileSync(csvFilePath, logEntry);
        }

        await client.send('Fetch.continueRequest', { requestId: event.requestId }); // Let the request continue
    });

    // 🔥 LOG RESPONSE DETAILS & TRY TO DETECT CONTENT TYPE
    client.on('Network.responseReceived', (event) => {
        const requestId = event.requestId;
        if (requestData[requestId]) {
            const contentType = event.response.mimeType || event.response.headers['content-type'] || "UNKNOWN";
            requestData[requestId].contentType = contentType;

            console.log(`[RESPONSE] ${requestId} - Content-Type: ${contentType}`);

            const logEntry = `${Date.now()},${requestId},RESPONSE_RECEIVED,${requestData[requestId].url},${event.response.status},${contentType},0,0\n`;
            fs.appendFileSync(csvFilePath, logEntry);
        }
    });

    // 🔥 LOG EVERY BYTE RECEIVED
    client.on('Network.dataReceived', (event) => {
        const requestId = event.requestId;
        const bytesReceived = event.dataLength;

        if (requestData[requestId]) {
            requestData[requestId].bytes += bytesReceived;
            console.log(`[DATA] ${requestId} - +${bytesReceived} bytes (Total: ${requestData[requestId].bytes})`);

            const logEntry = `${Date.now()},${requestId},DATA_RECEIVED,${requestData[requestId].url},N/A,${requestData[requestId].contentType || "UNKNOWN"},${bytesReceived},${requestData[requestId].bytes}\n`;
            fs.appendFileSync(csvFilePath, logEntry);
        }
    });

    // 🔥 LOG FINAL REQUEST COMPLETION & TOTAL BYTES
    client.on('Network.loadingFinished', (event) => {
        const requestId = event.requestId;
        if (requestData[requestId]) {
            console.log(`[COMPLETE] Request ID: ${requestId} - Total Bytes: ${requestData[requestId].bytes} - ${requestData[requestId].url}`);

            const logEntry = `${Date.now()},${requestId},REQUEST_COMPLETED,${requestData[requestId].url},N/A,${requestData[requestId].contentType || "UNKNOWN"},FINAL,${requestData[requestId].bytes}\n`;
            fs.appendFileSync(csvFilePath, logEntry);

            delete requestData[requestId];
        }
    });

})();



///

const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        headless: false, // Set to true to run in the background
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Enable request interception
    await page.setRequestInterception(true);

    page.on('request', (request) => {
        request.continue(); // Continue the request normally
    });

    // Listen for response data
    page.on('response', async (response) => {
        const url = response.url();

        // Only capture Twitch video segment requests
        if (url.includes('.m4s') || url.includes('.ts')) {
            const buffer = await response.buffer();
            console.log(`[${new Date().toISOString()}] Downloaded ${buffer.length} bytes from ${url}`);
        }
    });

    // Open the Twitch stream (Replace URL with your desired channel)
    await page.goto('https://www.twitch.tv/YOUR_CHANNEL', { waitUntil: 'networkidle2' });

    console.log("Monitoring Twitch stream... Press CTRL+C to stop.");
})();


//
const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        userDataDir: "/home/pi/.config/chromium",
        executablePath: '/usr/bin/chromium-browser',
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000); // Set a higher timeout

    // Enable request interception
    await page.setRequestInterception(true);
    page.on('request', (request) => request.continue());

    // Listen for response data
    page.on('response', async (response) => {
        const url = response.url();

        // Only capture Twitch video segment requests
        if ((url.includes('.m4s') || url.includes('.ts')) && response.status() === 200) {
            try {
                const buffer = await response.buffer();
                console.log(`[${new Date().toISOString()}] Downloaded ${buffer.length} bytes from ${url}`);
            } catch (error) {
                console.warn(`[WARNING] Failed to get body for ${url}: ${error.message}`);
            }
        }
    });

    // Open the Twitch stream
    await page.goto('https://www.twitch.tv/YOUR_CHANNEL', { waitUntil: 'domcontentloaded' });

    console.log("Monitoring Twitch stream... Press CTRL+C to stop.");
})();

///idk anymore
const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        userDataDir: "/home/pi/.config/chromium",
        executablePath: '/usr/bin/chromium-browser',
        headless: false,  // Set to true if you want it to run in background
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000); // Prevents timeout issues

    // Enable request interception
    await page.setRequestInterception(true);
    page.on('request', (request) => request.continue());

    // Monitor network responses
    page.on('response', async (response) => {
        const url = response.url();

        // Only capture Twitch HLS video segment requests (".ts")
        if (url.includes('.ts') && response.status() === 200) {
            try {
                const buffer = await response.buffer();
                console.log(`[${new Date().toISOString()}] Downloaded ${buffer.length} bytes from ${url}`);
            } catch (error) {
                console.warn(`[WARNING] Could not fetch response body for ${url}: ${error.message}`);
            }
        }
    });

    // Open Twitch stream (replace with your target stream)
    await page.goto('https://www.twitch.tv/kaicenat', { waitUntil: 'domcontentloaded' });

    console.log("Monitoring Twitch stream... Press CTRL+C to stop.");
})();


//
(async () => {
    const browser = await puppeteer.launch({
        userDataDir: "/home/pi/.config/chromium",
        executablePath: '/usr/bin/chromium-browser',
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000);

    // Intercept every request and log it
    page.on('request', (request) => {
        console.log(`[REQUEST] ${request.url()} (${request.resourceType()})`);
        request.continue();
    });

    // Log every response URL
    page.on('response', (response) => {
        console.log(`[RESPONSE] ${response.url()} (Status: ${response.status()})`);
    });

    // Open Twitch stream
    await page.goto('https://www.twitch.tv/kaicenat', { waitUntil: 'domcontentloaded' });

    console.log("Monitoring Twitch stream... Press CTRL+C to stop.");
})();



//newnew
const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    await page.setRequestInterception(true);

    page.on('request', request => {
        if (request.url().includes('.ts') || request.url().includes('.m3u8')) {
            console.log(`[Request] ${request.url()}`);
        }
        request.continue();
    });

    await page.goto('https://www.twitch.tv/YOUR_STREAM_HERE');
})();
