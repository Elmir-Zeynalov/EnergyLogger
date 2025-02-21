const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/chromium-browser',
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto('https://www.youtube.com', { waitUntil: 'load' });

    try {
        console.log("Checking for cookie consent banner...");

        // Wait for "Accept all" button using its aria-label
        await page.waitForSelector('button[aria-label="Accept the use of cookies and other data for the purposes described"]', { timeout: 5000 });

        // Click "Accept All"
        await page.click('button[aria-label="Accept the use of cookies and other data for the purposes described"]');
        console.log("Cookies accepted successfully.");

        // Wait to ensure YouTube processes the consent
        await page.waitForTimeout(2000);
    } catch (error) {
        console.log("No cookie banner found. Moving on...");
    }

    console.log("Proceeding with video loading...");
})();
