const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/chromium-browser', //setting chromium as the browser becase im working on a raspberry pi
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto('https://www.youtube.com', { waitUntil: 'load' });

    try {
        console.log("Checking for cookie consent banner...");

        // trying to find the Accept all button
        await page.waitForSelector('button[aria-label="Accept the use of cookies and other data for the purposes described"]', { timeout: 5000 });
        await page.click('button[aria-label="Accept the use of cookies and other data for the purposes described"]');
        console.log("Cookies accepted successfully.");

        // Wait to ensure YouTube processes the consent
        await page.waitForTimeout(2000);
    } catch (error) {
        console.log("No cookie banner found. Moving on...");
    }

    console.log("Proceeding with video loading...");
    console.log("Intercepting calls...");
    await page.setRequestInterception(true);

    const logFile = "youtube_network_log.csv";
    fs.writeFileSync(logFile, 'timestamp,bytes_received,url\n');

    page.on('request', request => {
        if (request.url().includes("googlevideo.com")) {
            const timestamp = new Date().toISOString();
            const url = request.url();
            const headers = request.headers();

            console.log(`URL: ${url}`);
            // Get the content-length from headers (size of the video chunk)
            let bytesReceived = headers['content-length'] ? parseInt(headers['content-length'], 10) : 0;

            console.log(`[${timestamp}] Video Chunk: ${bytesReceived} bytes from ${url}`);

            // Append to CSV file
            fs.appendFileSync(logFile, `${timestamp},${bytesReceived},${url}\n`);
        }
        request.continue();
    });

})();
