const puppeteer = require('puppeteer');

(async () => {

    const browser = await puppeteer.launch({
        userDataDir: "/home/pi/.config/chromium",
        executablePath: '/usr/bin/chromium-browser',
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    console.log("Navigating to Twitch...");
    await page.goto('https://www.twitch.tv/silky', { waitUntil: 'networkidle2' });

    // Wait for settings button
    console.log("Waiting for settings button...");
    await page.waitForSelector('[data-a-target="player-settings-button"]', { timeout: 15000 });

    // Check if button exists before clicking
    const settingsButton = await page.$('[data-a-target="player-settings-button"]');
    if (!settingsButton) {
        console.log("Settings button NOT found!");
        await browser.close();
        return;
    } else {
        console.log("Settings button found!");
    }

    //
    await page.evaluate(() => {
        document.querySelector('[data-a-target="player-settings-button"]');
    });

    //click the settings button and open menu
    //await new Promise(r => setTimeout(r, 1000));
    await settingsButton.click();
    console.log("1.Clicked settings button!");


    // Allow some time for animation
    await new Promise(r => setTimeout(r, 500));

    // Step 3: Click the "Advanced" button
    await page.waitForSelector('[data-a-target="player-settings-menu-item-advanced"]', { timeout: 5000 });
    const advancedSettingsButton = await page.$('[data-a-target="player-settings-menu-item-advanced"]');
    await advancedSettingsButton.click();
    console.log("2.Clicked advanced settings button!");


    // Wait for video stats button
    console.log("Waiting for video stats toggle...");
    await page.waitForSelector('[data-a-target="player-settings-submenu-advanced-video-stats"]', { timeout: 30000 });
    await page.click('[data-a-target="player-settings-submenu-advanced-video-stats"]');
    console.log("3.Clicked video stats!");

    // Wait for stats to load
    await page.waitForSelector('[data-a-target="player-overlay-video-stats-row"]', { timeout: 10000 });

    // Extract stats
    const stats = await page.evaluate(() => {
        let statsData = {};
        document.querySelectorAll('[data-a-target="player-overlay-video-stats-row"]').forEach(row => {
            let name = row.querySelector('td:first-child p').innerText;
            let value = row.querySelector('td:last-child p').innerText;
            statsData[name] = value;
        });
        return statsData;
    });

    console.log("🎥 Extracted Video Stats:", stats);

    // Keep browser open for debugging
    // await browser.close();
})();
