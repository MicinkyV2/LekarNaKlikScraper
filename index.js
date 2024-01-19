const puppeteer = require("puppeteer-extra");
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

(async () => {
	try {
        // add stealth plugin and use defaults (all evasion techniques)
        puppeteer.use(StealthPlugin())

		// Launch the browser
		const browser = await puppeteer.launch({
            headless: false,
        });

		// Create a new page
		const page = await browser.newPage();

		// Navigate to a URL
		await page.goto("https://www.lkcr.cz/seznam-lekaru");

        await page.waitForSelector("#filterObor");
        
        // select gastroenterologie in #filterObor
        await page.select("#filterObor", "37");

        await page.waitForNavigation({
            timeout: 0,
        });

        await page.select("#filterKrajId", "6");

        await page.waitForNavigation({
            timeout: 0,
        });

        // get doctor names from all <a> elements in .item
        await page.waitForSelector(".item");

        const doctorDetails = await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll(".seznam-lekaru > .item:not(.table-head)"));
            return items.map(item => {
                const anchor = item.querySelector("a");
                return {
                    name: anchor.innerText,
                    link: anchor.href
                };
            });
        });

        console.log(doctorDetails);

		// Close the browser
		await browser.close();
	} catch (error) {
		console.error("An error occurred:", error);
	}
})();
