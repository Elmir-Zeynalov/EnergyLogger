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
	    
	     try{
             resolution = await page.evaluate(() => {
		const video = document.querySelector('video');
		return video ? `${video.videoWidth} x ${video.videoHeight}` : "Unknown";
	     });
	    }catch(error){
		console.log(`[ERROR] Could not get the video resolution. Error: ${error}`);
	    }
	    console.log(`Resolution: ${resolution}`);
	    
            console.log(`[${timestamp}] VIDEO CHUNK: ${bytesReceived} bytes from ${url}`);
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
