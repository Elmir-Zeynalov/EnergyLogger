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
    const client = await page.target().createCDPSession(); // Chrome DevTools Protocol

    console.log("Loading YouTube...");
    await page.goto('https://www.youtube.com/watch?v=8QcQ_128OIw&start=0&vq=small', { waitUntil: 'load' });

    try {
        console.log("Checking for cookie consent banner...");
        const acceptButton = await page.$('button[aria-label="Accept the use of cookies and other data for the purposes described"]');
        if (acceptButton) {
            await acceptButton.click();
            console.log("Cookies accepted successfully.");
            await page.waitForTimeout(2000);
        }
    } catch (error) {
        console.log("No cookie banner found. Moving on...");
    }

    console.log("Proceeding with video loading...");
    console.log("Listening to video network traffic...");

    await client.send('Network.enable');

    const csvFilePath = "youtube_network_log.csv";
    if (!fs.existsSync(csvFilePath)) {
        fs.writeFileSync(csvFilePath, "UTC_Timestamp,Request_ID,Bytes_Received,Resolution,FPS,Frames_Dropped,Total_Frames,Codecs,Connection_Speed,Network_Activity,Buffer_Health\n");
    }

    const videoRequests = new Set(); // Store only video request IDs
    const requestSizes = {}; // Store total bytes per request
    let logBuffer = []; // Store log entries in memory

    // Store request IDs
    client.on('Network.responseReceived', (event) => {
        if (event.response.url.includes(".googlevideo.com/") && event.response.url.includes("videoplayback")) {
            videoRequests.add(event.requestId); // Store request ID
            requestSizes[event.requestId] = 0; //Ensure request is initialized properly
        }
    });

    //Log video data in real-time (Only for video request IDs)
    client.on('Network.dataReceived', async (event) => {
        const requestId = event.requestId;
        const utcTimestamp = Date.now();
        const bytesReceived = event.dataLength; // Amount of data received

        // Ensure request ID is initialized, even if `responseReceived` hasn't fired yet!
        if (!requestSizes.hasOwnProperty(requestId)) {
            requestSizes[requestId] = 0; // Initialize it if missing
        }
        //const utcTimestamp = new Date().toISOString();
        
        requestSizes[requestId] += bytesReceived; // Add to total count

        const videoStats = await page.evaluate(() => {
            const video = document.querySelector('video');
            const player = document.getElementById('movie_player');
            if (!video) return null;
            if (!player) return null;

            return {
                resolution: `${video.videoWidth}x${video.videoHeight}`,
                fps: `NA`,
                framesDropped: `${video.getVideoPlaybackQuality().droppedVideoFrames}`,
                framesTotal : `${video.getVideoPlaybackQuality().totalVideoFrames}`,
                codecs: `${player.getStatsForNerds().codecs}`,
                connectionSpeed: `${player.getStatsForNerds().bandwidth_kbps}`,
                networkActivity: `${player.getStatsForNerds().network_activity_bytes}`,
                bufferHealth: `${player.getStatsForNerds().buffer_health_seconds}`,
            };
        });
        
        console.log(`[LIVE] [ID:${requestId}] [${utcTimestamp}] Bytes: ${bytesReceived} | Total So Far: ${requestSizes[requestId]} | Resolution: ${videoStats.resolution} | FPS: ${videoStats.fps} | Buffer: ${videoStats.bufferHealth}s | ${videoStats.totalVideoFrames}`);
        //logBuffer.push(`${utcTimestamp},${requestId},${bytesReceived},${videoStats.resolution},${videoStats.fps},${videoStats.framesDropped},${videoStats.codecs},${videoStats.connectionSpeed},${videoStats.networkActivity},${videoStats.bufferHealth}`);
        const csvEntry = `${utcTimestamp},${requestId},${bytesReceived},${videoStats.resolution},${videoStats.fps},${videoStats.framesDropped},${videoStats.framesTotal},${videoStats.codecs},${videoStats.connectionSpeed},${videoStats.networkActivity},${videoStats.bufferHealth}\n`;
        fs.appendFileSync(csvFilePath, csvEntry);
    });

    //Log final total bytes when request finishes
    client.on('Network.loadingFinished', (event) => {
        const requestId = event.requestId;

        if (videoRequests.has(requestId)) {
            console.log(`[FINAL] Request ${requestId} completed. Total Bytes: ${requestSizes[requestId]}`);

            // Cleanup
            videoRequests.delete(requestId);
            delete requestSizes[requestId];
        }
    });

})();