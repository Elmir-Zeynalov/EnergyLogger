const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/chromium-browser', // Path to Chromium
        headless: false // Set to true if you don’t want a visible window
    });

    const page = await browser.newPage();
    await page.goto('https://www.youtube.com/watch?v=YOUR_VIDEO_ID');

    // Monitor network requests
    await page.setRequestInterception(true);
    page.on('request', request => {
        if (request.url().includes("googlevideo.com")) {
            console.log(`Video Request: ${request.url()}`);
        }
        request.continue();
    });

})();
