const puppeteer = require("puppeteer-extra");
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

(async () => {
	try {
        // add stealth plugin and use defaults (all evasion techniques)
        puppeteer.use(StealthPlugin())
        puppeteer.use(require("puppeteer-extra-plugin-minmax")());

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

        const doctorDetails = [];
        for (const doctor of doctors) {
            const doctorDetail = await getDoctorDetails(page, doctor);
            doctorDetails.push(doctorDetail);
        }

        console.log(JSON.stringify(doctorDetails, null, 2));

		// Close the browser
		await browser.close();
	} catch (error) {
		console.error("An error occurred:", error);
	}
})();

async function getDoctorsFromPage(page) {
    console.log("Getting doctors from page...");
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

    // Check if the next page link exists
    const nextPageLink = await page.$(nextPageLinkSelector);

    if (nextPageLink) {
        console.log(`Navigating to page ${nextPageNumber}`);
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

    console.log("Waiting for captcha verification...");
    await page.waitForNavigation();
}

async function getDoctorDetails(page, doctor) {
    console.log(`Getting details for doctor: ${doctor.name}`)
    await page.goto(doctor.link);

    let success = await verifyCaptchaDetails(page);
    while(!success) {
        await page.goto(doctor.link);
        success = await verifyCaptchaDetails(page);
    }

    const doctorDetails = await page.evaluate(() => {
        const name = document.querySelector('.jmeno-lekare').innerText;
        const evidencniCislo = document.querySelector('.evidencni-cislo b').innerText;
        const workplacesElements = Array.from(document.querySelectorAll('.text-box-lekar'));
    
        const workplaces = workplacesElements.filter(workplace => {
            const h3 = workplace.querySelector('h3');
            return h3 && h3.innerText.includes('PRACOVIŠTĚ');
        }).map(workplace => {
            const table = workplace.querySelector('table.data');
            if (!table) return null;
            const trElements = Array.from(table.querySelectorAll('tr'));
    
            const details = trElements.map(tr => {
                const td = tr.querySelector('td:nth-child(2)');
                console.log(`td innerText: ${td.innerText}`);
                return td.innerText;
            });
    
            return {
                name: details[0],
                department: details[1],
                address: details[2]
            };
        }).filter(workplace => workplace !== null);
    
        return { name, evidencniCislo, workplaces };
    });
    
    return doctorDetails;
}

async function verifyCaptchaDetails(page) {
    const doctorDetails = await page.$(".detail-lekare");
    if(doctorDetails) {
        return true;
    }

    const searchButton = await page.$(".btn-submit");
    await searchButton.click();

    console.log("Waiting for captcha verification...");
    await page.maximize();
    await page.waitForNavigation();
    await page.minimize();
    return false;
}