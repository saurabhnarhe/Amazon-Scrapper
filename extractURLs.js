const puppeteer                = require("puppeteer");
const { Client }               = require("pg");
const { DB_CONNECTION_STRING } = require('./config');

const ExtractURLs = async (url) => {

  const client = await new Client({ connectionString: DB_CONNECTION_STRING });
  await client.connect();
  console.log("db connected");
  let page, browser;
  try {
    browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'], headless: true });
    page = await browser.newPage();
    console.log("browser page opend");
  } catch(e) {
    console.log("error while pupeteer  =",e);
  }
  

  const extractProductURLs = async pageURL => {
    console.log("pageURL: ", pageURL);
    await page.goto(pageURL, { waitUntil: "networkidle2" });

    const ProductURLs = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".s-access-detail-page")).map(el => {
        if (el != null) return el.href;
      })
    );
    // console.log("ProductURLs: ", ProductURLs);
    const Promises = [];
    for (let i = 0; i < ProductURLs.length; i++) {
      let ProductID = ProductURLs[i].slice(
        ProductURLs[i].split("/", 5).join("/").length + 1,
        ProductURLs[i].split("/", 6).join("/").length
      );
      ProductID = ProductID.indexOf("?") === -1 ? ProductID : ProductID.slice(0, ProductID.split("?", 1).join("?").length);
      try {
        console.log("url = ", ProductURLs[i]);
        await client.query(`INSERT INTO products (id, url, title, price, merchant, Product_Description_Para, product_description_table) VALUES ('${ProductID}', '${ProductURLs[i]}', NULL, NULL, NULL, NULL, NULL)`);
      } catch(e) {
        if (e.code === '23505')
          console.log(`Product URL already extracted with id:${ProductID}`);
        else 
          console.log(`Error in postgresql while inserting product id:${ProductID} \nError is: ${e}`);
      }
    }

    const nextUrl = await page.evaluate(() =>
        document.querySelector("a#pagnNextLink")
        ? document.querySelector("a#pagnNextLink").href
        : null
    );
    if (nextUrl != null) {
      return await extractProductURLs(nextUrl);
    } else {
      console.log("Got last Page");
      return;
    }
  };

  await extractProductURLs(url);
  browser.close();
  await client.end();
  return;
}
module.exports =  ExtractURLs;