const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        headless: false,  // Set to 'true' if you don't need the UI
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto('https://www.twitch.tv/kaicenat', { waitUntil: 'networkidle2' });

    // Wait for the settings button to appear
    await page.waitForSelector('[data-a-target="player-settings-button"]');
    console.log("Found settings button. Clicking...");
    await page.click('[data-a-target="player-settings-button"]');

    // Wait for the Video Stats button inside the settings menu
    await page.waitForSelector('[data-a-target="player-settings-submenu-advanced-video-stats"]', { timeout: 5000 });
    console.log("Found Video Stats button. Clicking...");
    await page.click('[data-a-target="player-settings-submenu-advanced-video-stats"]');

    // Wait for stats to appear
    await page.waitForSelector('[data-a-target="player-overlay-video-stats-row"]', { timeout: 5000 });

    // Extract video stats
    const stats = await page.evaluate(() => {
        let statsData = {};
        document.querySelectorAll('[data-a-target="player-overlay-video-stats-row"]').forEach(row => {
            let name = row.querySelector('td:first-child p').innerText;
            let value = row.querySelector('td:last-child p').innerText;
            statsData[name] = value;
        });
        return statsData;
    });

    console.log("Extracted Video Stats:", stats);

    // Close browser or keep running for real-time updates
    // await browser.close();
})();
