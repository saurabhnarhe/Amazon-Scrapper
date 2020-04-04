const puppeteer                = require("puppeteer");
const { Client }               = require("pg");
const { DB_CONNECTION_STRING } = require('./config');

const ExtractQA = async () => {

  const client = await new Client({ connectionString: DB_CONNECTION_STRING });
  await client.connect();

  let page, browser;
  try {
    browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'], headless: true });
    page = await browser.newPage();
    console.log("browser page opened");
  } catch (e) {
    console.log("error in puppeteer  =", e);
  }
  
  const extractQAs = async (pageURL) => {
    await page.goto(pageURL, { waitUntil: "networkidle2" });
    const QAs = await page.evaluate(() => {
      // extractings ques
      let Qs = Array.from(document.querySelectorAll("div.a-fixed-left-grid-col .a-col-right>a>span")).map(
        element => {
          return element.innerText;
        })

      // extractings ans
      let Ans = Array.from(document.querySelectorAll("div.a-fixed-left-grid-col .a-col-right>span")).map(
        element => {
          return Array.from(element.querySelectorAll('span.askLongText')).length == 1 ? element.querySelectorAll('span.askLongText').textContent : element.innerText;
        }
      ).filter(function (el) {
        return el != null;
      });

      //combining ques and ans 
      let QAS = [];
      for (let i = 0, j = 0; i < Qs.length; i++ , j += 2) {
        QAS.push({
          que: Qs[i].replace(new RegExp("'", "g"), "''"),
          ans: Ans[j].replace(new RegExp("'", "g"), "''")
        });
      }
      return QAS;
    });
    const nextNum = (parseInt(pageURL.slice(pageURL.split('/', 7).join('/').length + 1, pageURL.split('/', 8).join('/').length))
      + 1);
    console.log("next page num = ", nextNum);
    if (QAs.length < 1 || nextNum > 25) {
      console.log("got last page");
      return;
    } else {
      const nextUrl = pageURL.slice(0, pageURL.split('/', 7).join('/').length + 1) + nextNum + pageURL.slice(pageURL.split('/', 8).join('/').length, pageURL.length);
      console.log("nextURL: ", nextUrl);
      return QAs.concat(await extractQAs(nextUrl));
    }
  }
  
  const res = await client.query(`SELECT id FROM "products" where "qa"='0' LIMIT 50`);
  console.log('urls = ', res.rows.length);

  for (let i = 0; i < res.rows.length; i++){
    console.log("i = ", i);
    const Product_QA_URL = `https://www.amazon.in/ask/questions/asin/${res.rows[i].id}/1/ref=ask_ql_psf_ql_hza?isAnswered=true`;
    const QAs = await extractQAs(Product_QA_URL);
    if(QAs !== undefined && QAs.length > 0) {
      try {
        const insertPromises = [];
        QAs.forEach((QA) => {
          if (QA !== undefined) {
            insertPromises.push(client.query(`INSERT INTO "qa" ("id", "que", "ans") VALUES ('${res.rows[i].id}', '${QA.que}', '${QA.ans}')`));
          }
        })
        await Promise.all(insertPromises);

        // await client.query(`INSERT INTO "qa" ("id", "qas") VALUES ('${res.rows[i].id}', '${JSON.stringify({ qas: QAs })}')`);
        await client.query(`UPDATE "products" SET "qa" = '1' WHERE "id" = '${res.rows[i].id}'`);
      } catch(e) {
        console.log("Error in postgre: ", e);
      }
    }

  }
  browser.close();
  await client.end();  
}

module.exports = ExtractQA;