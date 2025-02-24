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
	
	
    const requestSizes = {}; // Store request sizes
    let logBuffer = []; // Store log entries in memory

    //////////////////////////////////////////////
    //REAL-TIME DATA LOGGING: Logs every time data is received
    client.on('Network.dataReceived', async (event) => {

       if (requestSizes[event.requestId]) {
            const bytesReceived = event.dataLength; // Amount of data received in this instance
             console.log(`[LIVE] Bytes: ${bytesReceived} from ${url}`);
            // Capture real-time playback stats
            const videoStats = await page.evaluate(() => {
                const video = document.querySelector('video');
                const player = document.getElementById('movie_player');
                if (!video) return null;

                return {
                    resolution: `${video.videoWidth}x${video.videoHeight}`,
                    fps: `${video.getVideoPlaybackQuality().totalFrameCount / video.duration}`,
                    framesDropped: `${video.getVideoPlaybackQuality().droppedVideoFrames} / ${video.getVideoPlaybackQuality().totalVideoFrames}`,
                    codecs: `${player.getStatsForNerds().codecs}`,
                    connectionSpeed: `${player.getStatsForNerds().bandwidth_kbps}`,
                    networkActivity: `${player.getStatsForNerds().network_activity_bytes}`,
                    bufferHealth: `${player.getStatsForNerds().buffer_health_seconds}`,
                };
            });

            if (videoStats) {
                const utcTimestamp = new Date().toISOString();
                console.log(`[LIVE] [${utcTimestamp}] Bytes: ${bytesReceived} | Resolution: ${videoStats.resolution} | FPS: ${videoStats.fps} | Buffer: ${videoStats.bufferHealth}s`);
                
                // Save log entry to memory for file writing
                logBuffer.push(`${utcTimestamp},${bytesReceived},${videoStats.resolution},${videoStats.fps},${videoStats.bufferHealth}`);
            }
        }
    });

    //////////////////////////////////////////////


    //Capture requests when a video chunk starts downloading
    client.on('Network.responseReceived', (event) => {
        if (event.response.url.includes(".googlevideo.com/") && event.response.url.includes("videoplayback")) {
            requestSizes[event.requestId] = { url: event.response.url, timestamp: new Date().toISOString() };
        }
    });

    // // Capture actual data size when the chunk finishes downloading
    // client.on('Network.loadingFinished', async (event) => {
    //     if (requestSizes[event.requestId]) {
    //         const { url, timestamp } = requestSizes[event.requestId];
    //         const bytesReceived = event.encodedDataLength; // The ACTUAL size of the downloaded chunk
         
    //         let resolution = "Unknown";
    //         let fps = "Unknown";
    //         let codecs = "Unknown";
    //         let connectionSpeed = "Unknown";
    //         let networkActivity = "Unknown";
    //         let bufferHealth = "Unknown";
    //         let color = "Unknown";
    //         try {
    //             const videoStats = await page.evaluate(() => {
    //                 const video = document.querySelector('video');
    //                 const player = document.getElementById('movie_player');

    //                 if(!video) return null;

    //                 return {
    //                     resolution: `${video.videoWidth}x${video.videoHeight}`,
    //                     fps: "WHAT",
    //                     framesDropped: `${video.getVideoPlaybackQuality().droppedVideoFrames} | ${video.getVideoPlaybackQuality().totalVideoFrames}`,
    //                     codecs: `${player.getStatsForNerds().codecs}`,
    //                     connectionSpeed: `${player.getStatsForNerds().bandwidth_kbps}`,
    //                     networkActivity: `${player.getStatsForNerds().network_activity_bytes}`,
    //                     bufferHealth: `${player.getStatsForNerds().buffer_health_seconds}`,
    //                 };
    //             });

    //             if (videoStats) {
    //                 resolution = videoStats.resolution;
    //                 fps = videoStats.fps;
    //                 framesDropped = videoStats.framesDropped;
    //                 codecs = videoStats.codecs;
    //                 connectionSpeed = videoStats.connectionSpeed;
    //                 networkActivity = videoStats.networkActivity;
    //                 bufferHealth = videoStats.bufferHealth;
    //             }

    //         }catch(error){
    //             console.log(`[ERROR] Could not get the video resolution. Error: ${error}`);
    //         }

    //         // Format timestamp in UTC
    //         const utcTimestamp = new Date().toISOString();
    //         console.log(`[${utcTimestamp}] VIDEO CHUNK: ${bytesReceived} bytes | Resolution: ${resolution} | FPS: ${fps} | Frames Dropped: ${framesDropped} | Codecs: ${codecs} | Connection Speed: ${connectionSpeed} | Network Activity: ${networkActivity} | Buffer Health: ${bufferHealth} | URL: ${url}`);

    //         //console.log(`[${timestamp}] VIDEO CHUNK: ${bytesReceived} bytes from ${url}`);
    //         logBuffer.push(`${timestamp},${bytesReceived},${url}`);

    //         delete requestSizes[event.requestId]; // Free up memory
    //     }
    // });

    // Write to file every 5 seconds (instead of every chunk)
    setInterval(() => {
        if (logBuffer.length > 0) {
            fs.appendFileSync("youtube_network_log.csv", logBuffer.join("\n") + "\n");
            logBuffer = [];
        }
    }, 5000);

})();




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

    const videoRequests = new Set(); // Store only video request IDs
    let logBuffer = []; // Store log entries in memory

    // ✅ Step 1: Detect video requests (Store request IDs)
    client.on('Network.responseReceived', (event) => {
        if (event.response.url.includes(".googlevideo.com/") && event.response.url.includes("videoplayback")) {
            videoRequests.add(event.requestId); // Store only video request IDs
        }
    });

    // ✅ Step 2: Log video data in real-time (Only for video request IDs)
    client.on('Network.dataReceived', async (event) => {
        if (!videoRequests.has(event.requestId)) return; // Ignore non-video data

        const bytesReceived = event.dataLength; // Amount of data received

        // Capture real-time playback stats
        const videoStats = await page.evaluate(() => {
            const video = document.querySelector('video');
            const player = document.getElementById('movie_player');
            if (!video) return null;

            return {
                resolution: `${video.videoWidth}x${video.videoHeight}`,
                fps: `${video.getVideoPlaybackQuality().totalFrameCount / video.duration}`,
                framesDropped: `${video.getVideoPlaybackQuality().droppedVideoFrames} / ${video.getVideoPlaybackQuality().totalVideoFrames}`,
                codecs: `${player.getStatsForNerds().codecs}`,
                connectionSpeed: `${player.getStatsForNerds().bandwidth_kbps}`,
                networkActivity: `${player.getStatsForNerds().network_activity_bytes}`,
                bufferHealth: `${player.getStatsForNerds().buffer_health_seconds}`,
            };
        });

        if (videoStats) {
            const utcTimestamp = new Date().toISOString();
            console.log(`[LIVE] [${utcTimestamp}] Bytes: ${bytesReceived} | Resolution: ${videoStats.resolution} | FPS: ${videoStats.fps} | Buffer: ${videoStats.bufferHealth}s`);

            // Save log entry to memory for file writing
            logBuffer.push(`${utcTimestamp},${bytesReceived},${videoStats.resolution},${videoStats.fps},${videoStats.bufferHealth}`);
        }
    });

    // ✅ Step 3: Save logs to file every 5 seconds
    setInterval(() => {
        if (logBuffer.length > 0) {
            fs.appendFileSync("youtube_network_log.csv", logBuffer.join("\n") + "\n");
            logBuffer = [];
        }
    }, 5000);

})();











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

    const videoRequests = new Set(); // Store only video request IDs
    const requestSizes = {}; // Store total bytes per request
    let logBuffer = []; // Store log entries in memory

    // ✅ Step 1: Detect video requests (Store request IDs)
    client.on('Network.responseReceived', (event) => {
        if (event.response.url.includes(".googlevideo.com/") && event.response.url.includes("videoplayback")) {
            videoRequests.add(event.requestId); // Store request ID
            requestSizes[event.requestId] = 0; // Initialize byte counter
        }
    });

    // ✅ Step 2: Log video data in real-time (Only for video request IDs)
    client.on('Network.dataReceived', async (event) => {
        if (!videoRequests.has(event.requestId)) return; // Ignore non-video data

        const bytesReceived = event.dataLength; // Amount of data received
        requestSizes[event.requestId] += bytesReceived; // Add to total count

        // Capture real-time playback stats
        const videoStats = await page.evaluate(() => {
            const video = document.querySelector('video');
            const player = document.getElementById('movie_player');
            if (!video) return null;

            return {
                resolution: `${video.videoWidth}x${video.videoHeight}`,
                fps: `${video.getVideoPlaybackQuality().totalFrameCount / video.duration}`,
                framesDropped: `${video.getVideoPlaybackQuality().droppedVideoFrames} / ${video.getVideoPlaybackQuality().totalVideoFrames}`,
                codecs: `${player.getStatsForNerds().codecs}`,
                connectionSpeed: `${player.getStatsForNerds().bandwidth_kbps}`,
                networkActivity: `${player.getStatsForNerds().network_activity_bytes}`,
                bufferHealth: `${player.getStatsForNerds().buffer_health_seconds}`,
            };
        });

        if (videoStats) {
            const utcTimestamp = new Date().toISOString();
            console.log(`[LIVE] [${utcTimestamp}] Bytes: ${bytesReceived} | Total So Far: ${requestSizes[event.requestId]} | Resolution: ${videoStats.resolution} | FPS: ${videoStats.fps} | Buffer: ${videoStats.bufferHealth}s`);

            // Save log entry to memory for file writing
            logBuffer.push(`${utcTimestamp},${bytesReceived},${videoStats.resolution},${videoStats.fps},${videoStats.bufferHealth}`);
        }
    });

    // ✅ Step 3: Log final total bytes when request finishes
    client.on('Network.loadingFinished', (event) => {
        if (videoRequests.has(event.requestId)) {
            console.log(`[FINAL] Request ${event.requestId} completed. Total Bytes: ${requestSizes[event.requestId]}`);
            videoRequests.delete(event.requestId); // Remove from tracking
            delete requestSizes[event.requestId]; // Free up memory
        }
    });

    // ✅ Step 4: Save logs to file every 5 seconds
    setInterval(() => {
        if (logBuffer.length > 0) {
            fs.appendFileSync("youtube_network_log.csv", logBuffer.join("\n") + "\n");
            logBuffer = [];
        }
    }, 5000);

})();



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

    const videoRequests = new Set(); // Store only video request IDs
    const requestSizes = {}; // Store total bytes per request
    let logBuffer = []; // Store log entries in memory

    // ✅ Step 1: Detect video requests (Store request IDs)
    client.on('Network.responseReceived', (event) => {
        if (event.response.url.includes(".googlevideo.com/") && event.response.url.includes("videoplayback")) {
            videoRequests.add(event.requestId); // Store request ID
            requestSizes[event.requestId] = 0; // ✅ Ensure request is initialized properly
        }
    });

    // ✅ Step 2: Log video data in real-time (Only for video request IDs)
    client.on('Network.dataReceived', async (event) => {
        const requestId = event.requestId;

        // 🔥 Ensure request ID is initialized, even if `responseReceived` hasn't fired yet!
        if (!requestSizes.hasOwnProperty(requestId)) {
            requestSizes[requestId] = 0; // Initialize it if missing
        }

        const bytesReceived = event.dataLength; // Amount of data received
        requestSizes[requestId] += bytesReceived; // Add to total count

        // Capture real-time playback stats
        const videoStats = await page.evaluate(() => {
            const video = document.querySelector('video');
            const player = document.getElementById('movie_player');
            if (!video) return null;

            return {
                resolution: `${video.videoWidth}x${video.videoHeight}`,
                fps: `${video.getVideoPlaybackQuality().totalFrameCount / video.duration}`,
                framesDropped: `${video.getVideoPlaybackQuality().droppedVideoFrames} / ${video.getVideoPlaybackQuality().totalVideoFrames}`,
                codecs: `${player.getStatsForNerds().codecs}`,
                connectionSpeed: `${player.getStatsForNerds().bandwidth_kbps}`,
                networkActivity: `${player.getStatsForNerds().network_activity_bytes}`,
                bufferHealth: `${player.getStatsForNerds().buffer_health_seconds}`,
            };
        });

        if (videoStats) {
            const utcTimestamp = new Date().toISOString();
            console.log(`[LIVE] [ID:${requestId}] [${utcTimestamp}] Bytes: ${bytesReceived} | Total So Far: ${requestSizes[requestId]} | Resolution: ${videoStats.resolution} | FPS: ${videoStats.fps} | Buffer: ${videoStats.bufferHealth}s`);

            // Save log entry to memory for file writing
            logBuffer.push(`${utcTimestamp},${bytesReceived},${videoStats.resolution},${videoStats.fps},${videoStats.bufferHealth}`);
        }
    });

    // ✅ Step 3: Log final total bytes when request finishes
    client.on('Network.loadingFinished', (event) => {
        const requestId = event.requestId;

        if (videoRequests.has(requestId)) {
            console.log(`[FINAL] Request ${requestId} completed. Total Bytes: ${requestSizes[requestId]}`);

            // Cleanup
            videoRequests.delete(requestId);
            delete requestSizes[requestId];
        }
    });

    // ✅ Step 4: Save logs to file every 5 seconds
    setInterval(() => {
        if (logBuffer.length > 0) {
            fs.appendFileSync("youtube_network_log.csv", logBuffer.join("\n") + "\n");
            logBuffer = [];
        }
    }, 5000);

})();
