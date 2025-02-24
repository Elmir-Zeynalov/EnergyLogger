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

    console.log("Loading Twitch Stream...");
    await page.goto('https://www.twitch.tv/YOUR_STREAMER_NAME', { waitUntil: 'load' });


        await client.send('Network.enable');
        const csvFilePath = "twitch_network_log.csv";
        if (!fs.existsSync(csvFilePath)) {
            fs.writeFileSync(csvFilePath, "UTC_Timestamp,Request_ID,Bytes_Received,Resolution,FPS,Frames_Dropped,Frames_Total\n");
        }

        const videoRequests = new Set();
        const requestSizes = {};
        
})();