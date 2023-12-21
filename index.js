import puppeteer from "puppeteer";
import fs from "fs";
import https from "https";

const getInvoices = async () => {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null
    })

    const page = await browser.newPage();

    await page.goto("https://qa.energyprint.com", {
        waitUntil: "domcontentloaded"
    });

    await page.type("#user_session_base_email", "developercandidate@energyprint.com");
    await page.type("#user_session_base_password", "Energy1234");

    await Promise.all([
        page.waitForNavigation(),
        page.click("#user_session_submit")
    ])

    const acctNums = await page.evaluate(() => {
        let tds = Array.from(document.querySelectorAll("table tr td"))
        tds = tds.filter(td => td.innerText !== "View Account");
        return tds.map(td => td.innerText);
    })
    
    const linkAddresses = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll("table tr td a"))
        return links.map(link => link.href);
    })

    for(let i = 0; i<linkAddresses.length; i++) {
        await page.goto(linkAddresses[i], {
            waitUntil: "domcontentloaded"
        });

        const fileNames = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll("table tr td a"))
            return links.map(link => link.href);
        })

        const fileData = fileNames.map(fileName => ({name: fileName}) );

        const dates = await page.evaluate(() => {
            let tds = Array.from(document.querySelectorAll("table tr td"))
            tds = tds.filter(td => td.innerText !== "View Bill");
            return tds.map(td => td.innerText);
        })  
        
        //old format M/D/YY
        //new format YYYYMMDD

        const newDates = [];

        dates.forEach( (date, idx) => {
            const [month, day, year] = date.split("/");
            const newYear = `20${year}`; 
            //this is assuming all years begin in 20, could possibly add logic to use 19 if year is over a certain number
            const newMonth = `${month < 10 ? "0" : ""}${month}`;
            const newDay = `${day < 10 ? "0" : ""}${day}`;

            fileData[idx].date = `${newYear}${newMonth}${newDay}`;
        })

        fileData.forEach( fileData => {
            https.get(fileData.name, res => {
                let stream;
                stream = fs.createWriteStream(`EnergyPrint_${acctNums[i]}_${fileData.date}.pdf`)
                res.pipe(stream);
                stream.on("finish", () => {
                    stream.close();
                })
            })
        })    
    }

    await page.goto("https://qa.energyprint.com/logout", {
        waitUntil: "domcontentloaded"
    });

    await browser.close();
}

getInvoices();