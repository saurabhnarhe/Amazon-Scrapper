const puppeteer = require("puppeteer");
const { Client } = require("pg");
const { DB_CONNECTION_STRING } = require("./config");

const extractDesc = async () => {
  const client = await new Client({ connectionString: DB_CONNECTION_STRING });
  await client.connect();
  let page, browser;
  try {
    browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: true
    });
    page = await browser.newPage();
    console.log("browser page opend");
  } catch (e) {
    console.log("error while pupeteer  =", e);
  }

  const extractProductDescription = async pageURL => {
    console.log("pageURL: ", pageURL);
    await page.goto(pageURL, { waitUntil: "networkidle2" });

    const Product_Description_Table = [];
    const {
      Product_Description_Para,
      PDT,
      ProductTitle,
      Price,
      Merchant
    } = await page.evaluate(() => {
      const Product_Description_Para = document.querySelector(
        "#productDescription"
      )
        ? document
            .querySelector("#productDescription")
            .innerText.replace(new RegExp("'", "g"), "''")
        : null;
      const PDT = Array.from(
        document.querySelectorAll("#technical-details-table td").length === 0
          ? document.querySelectorAll(".pdTab table td").length === 0
            ? null
            : document.querySelectorAll(".pdTab table td")
          : document.querySelectorAll("#technical-details-table td")
      ).map(el => el.innerText);
      const ProductTitle = document.querySelector("#title")
        ? document
            .querySelector("#title")
            .innerText.replace(new RegExp("'", "g"), "''")
        : null;
      const Price = document.querySelector("#priceblock_dealprice")
        ? document.querySelector("#priceblock_dealprice").innerText
        : document.querySelector("#priceblock_ourprice")
        ? document.querySelector("#priceblock_ourprice").innerText
        : document.querySelector("#priceblock_saleprice")
        ? document.querySelector("#priceblock_saleprice").innerText
        : null;
      const Merchant = document.querySelector("#merchant-info > a")
        ? document
            .querySelector("#merchant-info > a")
            .innerText.replace(new RegExp("'", "g"), "''")
        : null;
      return { Product_Description_Para, PDT, ProductTitle, Price, Merchant };
    });

    for (let i = 0; i < PDT.length; i += 2)
      Product_Description_Table.push({ prop: PDT[i], value: PDT[i + 1] });

    try {
      await client.query(`UPDATE "products" SET
            "title" = '${JSON.stringify({ title: ProductTitle })}',
            "price" = '${Price}',
            "merchant" = '${JSON.stringify({ merchant: Merchant })}',
            "product_description_para" = '${JSON.stringify({
              para: Product_Description_Para
            })}',
            "product_description_table" = '${JSON.stringify({
              table: Product_Description_Table
            })}'
    WHERE "url" = '${pageURL}'`);
      await client.query(
        `UPDATE "products" SET "desc" = '1' WHERE "url" = '${pageURL}'`
      );
    } catch (e) {
      console.log("Error in postgre: ", e);
    }
    return;
  };

  const res = await client.query(
    `SELECT url FROM "products" where "desc"='0' LIMIT 50`
  );
  console.log("urls = ", res.rows.length);
  for (let i = 0; i < res.rows.length; i++) {
    await extractProductDescription(res.rows[i].url);
    console.log("Extracted desc no. ", i);
  }
  browser.close();
  await client.end();
};
module.exports = extractDesc;
