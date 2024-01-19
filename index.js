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

        const cookieButton = await page.waitForSelector(".cc-nb-okagree");
        await cookieButton.click();
        
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

        let doctors = [];
        let currentPageNumber = 0;
        let hasNextPage = true;

        while (hasNextPage) {
            const doctorsFromPage = await getDoctorsFromPage(page);
            doctors = [...doctors, ...doctorsFromPage];
            hasNextPage = await goToNextPage(page, currentPageNumber);
            await verifyCaptcha(page);
            currentPageNumber++;
        }

        console.log(doctors);

		// Close the browser
		await browser.close();
	} catch (error) {
		console.error("An error occurred:", error);
	}
})();

async function getDoctorsFromPage(page) {
    const result = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll(".seznam-lekaru > .item:not(.table-head)"));
        return items.map(item => {
            const anchor = item.querySelector("a");
            return {
                name: anchor.innerText,
                link: anchor.href
            };
        });
    });
    return result;
}

async function goToNextPage(page, currentPageNumber) {
    const nextPageNumber = currentPageNumber + 1;
    const nextPageLinkSelector = `a[href="/seznam-lekaru?paging.pageNo=${nextPageNumber}"]`;

    console.log(`Checking for next page link: ${nextPageLinkSelector}`);

    // Check if the next page link exists
    const nextPageLink = await page.$(nextPageLinkSelector);

    console.log(`Next page link: ${nextPageLink}`);

    if (nextPageLink) {
        // If the next page link exists, click it and wait for navigation
        await Promise.all([
            nextPageLink.click(),
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
        ]);
        return true;
    } else {
        // If the next page link does not exist, return false
        return false;
    }
}

async function verifyCaptcha(page) {
    const doctorList = await page.$(".seznam-lekaru");
    if(doctorList) {
        return;
    }

    const searchButton = await page.$(".btn-submit");
    await searchButton.click();

    await page.waitForNavigation();
}