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
    //await page.goto('https://www.youtube.com/watch?v=8QcQ_128OIw&start=0&vq=small', { waitUntil: 'load' });
    await page.goto('https://www.youtube.com/watch?v=-qjE8JkIVoQ', { waitUntil: 'load' });

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

    const csvFilePath = "youtube_network_log.csv";
    if (!fs.existsSync(csvFilePath)) {
        fs.writeFileSync(csvFilePath, "UTC_Timestamp,Resolution,FPS,Codecs,Bandwidth_kbps,Network_Activity_KB,Buffer_Health_s,Live_Latency_s,Latency_Mode\n");
    }


    async function logNerdStats(){
        const utcTimestamp = Date.now();
        
        const videoStats = await page.evaluate(() => {
            const video = document.querySelector('video');
            const player = document.getElementById('movie_player');
            
            if(!video || !player) return null;

            const nerdStats = player.getStatsForNerds();
            if(!nerdStats) return null;

            return {
                resolution: `${video.videoWidth}x${video.videoHeight}`,
                fps: `${nerdStats.resolution.split("@")[1].split(" ")[0]}`,
                codecs: `${nerdStats.codecs}`,
                bandwidth_kbps: nerdStats.bandwidth_kbps.replace(/\D/g, ''),
                networkActivity: nerdStats.network_activity_bytes.replace(/\D/g, ''),
                bufferHealth: nerdStats.buffer_health_seconds.replace(/[^\d.]/g, ''),
                
                //youtube live fields
                liveLatency: nerdStats.live_latency_secs?.replace(/[^\d.]/g, '') ?? null,
                liveMode: nerdStats.live_mode ?? null,
            };

        });

        if (videoStats) {
            console.log(`[${utcTimestamp}] Resolution: ${videoStats.resolution}, FPS: ${videoStats.fps}, Codec: ${videoStats.codecs}, Bandwidth: ${videoStats.bandwidth_kbps} kbps, Network Activity: ${videoStats.networkActivity} KB, Buffer Health: ${videoStats.bufferHealth} s, Live Latency: ${videoStats.liveLatency} s, Latency Mode: ${videoStats.liveMode}`);
            
            const csvEntry = `${utcTimestamp},${videoStats.resolution},${videoStats.fps},${videoStats.codecs},${videoStats.bandwidth_kbps},${videoStats.networkActivity},${videoStats.bufferHealth},${videoStats.liveLatency},${videoStats.liveMode}\n`;
            fs.appendFileSync(csvFilePath, csvEntry);
        } else {
            console.log("Failed to retrieve nerd stats.");
        }
    }
    setInterval(logNerdStats, 1000);
    
})();