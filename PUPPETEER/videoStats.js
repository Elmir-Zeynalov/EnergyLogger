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

    // Capture requests when a video chunk starts downloading
    client.on('Network.responseReceived', (event) => {
        if (event.response.url.includes(".googlevideo.com/") && event.response.url.includes("videoplayback")) {
            requestSizes[event.requestId] = { url: event.response.url, timestamp: new Date().toISOString() };
        }
    });

    // Capture actual data size when the chunk finishes downloading
    client.on('Network.loadingFinished', async (event) => {
        if (requestSizes[event.requestId]) {
            const { url, timestamp } = requestSizes[event.requestId];
            const bytesReceived = event.encodedDataLength; // The ACTUAL size of the downloaded chunk
         
            let resolution = "Unknown";
            let fps = "Unknown";
            let codecs = "Unknown";
            let connectionSpeed = "Unknown";
            let networkActivity = "Unknown";
            let bufferHealth = "Unknown";
            try {
                const videoStats = await page.evaluate(() => {
                    const video = document.querySelector('video');
                    if(!video) return null;

                    return {
                        resolution: `${video.videoWidth}x${video.videoHeight}`,
                        fps: video.getVideoPlaybackQuality ? video.getVideoPlaybackQuality().totalVideoFrames / video.getVideoPlaybackQuality().totalVideoFrames : "Unknown",
                        framesDropped: video.getVideoPlaybackQuality ? video.getVideoPlaybackQuality().droppedVideoFrames : "Unknown",
                        codecs: video.canPlayType("video/webm; codecs=vp9") ? "VP9" : video.canPlayType("video/mp4; codecs=avc1") ? "H.264" : "Unknown",
                        connectionSpeed: document.querySelector('.ytp-stat-speed') ? document.querySelector('.ytp-stat-speed').innerText : "Unknown",
                        networkActivity: document.querySelector('.ytp-stat-network') ? document.querySelector('.ytp-stat-network').innerText : "Unknown",
                        bufferHealth: document.querySelector('.ytp-stat-buffer') ? document.querySelector('.ytp-stat-buffer').innerText : "Unknown"
                    };
                });

                if (videoStats) {
                    resolution = videoStats.resolution;
                    fps = videoStats.fps;
                    framesDropped = videoStats.framesDropped;
                    codecs = videoStats.codecs;
                    connectionSpeed = videoStats.connectionSpeed;
                    networkActivity = videoStats.networkActivity;
                    bufferHealth = videoStats.bufferHealth;
                }

            }catch(error){
                console.log(`[ERROR] Could not get the video resolution. Error: ${error}`);
            }

            /*
            try{
                resolution = await page.evaluate(() => {
		            const video = document.querySelector('video');
		            return video ? `${video.videoWidth} x ${video.videoHeight}` : "Unknown";
	            });
            }catch(error){
		        console.log(`[ERROR] Could not get the video resolution. Error: ${error}`);
	        }
	        console.log(`Resolution: ${resolution}`);
            */

            // Format timestamp in UTC
            const utcTimestamp = new Date().toISOString();
            console.log(`[${utcTimestamp}] VIDEO CHUNK: ${bytesReceived} bytes | Resolution: ${resolution} | FPS: ${fps} | Frames Dropped: ${framesDropped} | Codecs: ${codecs} | Connection Speed: ${connectionSpeed} | Network Activity: ${networkActivity} | Buffer Health: ${bufferHealth} | URL: ${url}`);

            //console.log(`[${timestamp}] VIDEO CHUNK: ${bytesReceived} bytes from ${url}`);
            logBuffer.push(`${timestamp},${bytesReceived},${url}`);

            delete requestSizes[event.requestId]; // Free up memory
        }
    });

    // Write to file every 5 seconds (instead of every chunk)
    setInterval(() => {
        if (logBuffer.length > 0) {
            fs.appendFileSync("youtube_network_log.csv", logBuffer.join("\n") + "\n");
            logBuffer = [];
        }
    }, 5000);

})();
