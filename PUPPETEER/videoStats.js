/* const puppeteer = require('puppeteer');

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

*/

const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/chromium-browser',
        headless: false,  // Set to true if you want a background process
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto('https://www.youtube.com', { waitUntil: 'load' });

    try {
        console.log("Checking for cookie consent banner...");

        // Wait for "Accept All" button
        await page.waitForSelector('button:nth-of-type(2)', { timeout: 5000 });

        // Click "Accept All"
        await page.click('button:nth-of-type(2)');
        console.log("Cookies accepted successfully.");
        
        // Short wait to ensure changes take effect
        await page.waitForTimeout(2000);
    } catch (error) {
        console.log("No cookie banner found. Moving on...");
    }

    console.log("Proceeding with video loading...");
})();
