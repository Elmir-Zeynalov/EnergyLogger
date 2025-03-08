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

    console.log("Navigating to Twitch...");
    await page.goto('https://www.twitch.tv/georgehotz', { waitUntil: 'networkidle2' });

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

    const csvFilePath = "twitch_video_stats.csv";
     if (!fs.existsSync(csvFilePath)) {
        fs.writeFileSync(csvFilePath, "UTC_Timestamp,Download_Resolution,Download_Bitrate,Bandwidth_Estimate,FPS,Skipped_Frames,Buffer_Size,Latency_To_Broadcaster,Codecs,Protocol,Latency_Mode\n");
    }



    async function logTwitchStats(){
        try{
            const utcTimestamp = Date.now();
            const stats = await page.evaluate(() => {
                let statData = {};
                document.querySelectorAll('[data-a-target="player-overlay-video-stats-row"]').forEach(row => {
                    let name = row.querySelector('td:first-child p')?.innerText;
                    let value = row.querySelector('td:last-child p')?.innerText;
                    if (name && value) {
                        statData[name] = value;
                    }
                });
                return statData;
            });
            if (!stats) {
                console.log("Failed to retrieve Twitch video stats.");
                return;
            }
            
            // Extract specific stats
            const downloadResolution = stats["Download Resolution"] || "N/A";
            const renderResolution = stats["Render Resolution"] || "N/A";
            const viewportResolution = stats["Viewport Resolution"] || "N/A";
            const fps = stats["FPS"]?.replace(/\D/g, '') || "N/A"; // Extracts only numbers
            const downloadBitrate = stats["Download Bitrate"]?.replace(/\D/g, '') || "N/A"; // Removes "Kbps"
            const bandwidthEstimate = stats["Bandwidth Estimate"]?.replace(/\D/g, '') || "N/A"; // Removes "Mbps"
            const bufferSize = stats["Buffer Size"]?.replace(/[^\d.]/g, '') || "N/A"; // Removes "sec."
            const latencyToBroadcaster = stats["Latency To Broadcaster"]?.replace(/[^\d.]/g, '') || "N/A"; // Removes "sec."
            const codec = stats["Codecs"] || "N/A";
            const latencyMode = stats["Latency Mode"] || "N/A";

            console.log(`[${utcTimestamp}] Download Res: ${downloadResolution}, Render Res: ${renderResolution}, Viewport Res: ${viewportResolution}, FPS: ${fps}, Bitrate: ${downloadBitrate} Kbps, Bandwidth: ${bandwidthEstimate} Mbps, Buffer: ${bufferSize} s, Latency: ${latencyToBroadcaster} s, Codec: ${codec}, Latency Mode: ${latencyMode}`);

            // Append to CSV
            const csvEntry = `${utcTimestamp},${downloadResolution},${renderResolution},${viewportResolution},${fps},${downloadBitrate},${bandwidthEstimate},${bufferSize},${latencyToBroadcaster},${codec},${latencyMode}\n`;
            fs.appendFile(csvFilePath, csvEntry, (err) => {
                if (err) console.error("Error writing to CSV:", err);
            });

        } catch (error) {
            console.error("Error collecting stats:", error);
        }
    }

    // Log stats every 400 milliseconds
    setInterval(logTwitchStats, 400);

    // await browser.close();
})();


