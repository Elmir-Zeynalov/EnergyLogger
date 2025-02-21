const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/chromium-browser',
        headless: false
    });

    const page = await browser.newPage();
    await page.goto('https://www.youtube.com/watch?v=YOUR_VIDEO_ID', { waitUntil: 'load' });

    // Try to click the "Accept All" button
    try {
        await page.waitForSelector('button[aria-label="Accept all"]', { timeout: 5000 });
        await page.click('button[aria-label="Accept all"]');
        console.log("✅ Accepted cookies.");
    } catch (error) {
        console.log("❌ No cookie banner found.");
    }

    // Now monitor network requests
    await page.setRequestInterception(true);
    page.on('request', request => {
        if (request.url().includes("googlevideo.com")) {
            console.log(`Video Request: ${request.url()}`);
        }
        request.continue();
    });

})();

