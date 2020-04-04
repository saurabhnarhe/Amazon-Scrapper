const express    = require("express"),
      app        = express(),
      bodyParser = require("body-parser"),
      port       = 8080;

const ExtractURLs = require('./extractURLs');
const ExtractDesc = require('./extractDesc');
const ExtractQA   = require("./extractQAs");

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

app.post('/', async (req, res) => {
    try {
        console.log("Extracting Products URLs from: ", req.body.url)
        await ExtractURLs(req.body.url);
        res.status(200).send(JSON.stringify({
            "status": "success"
        }));
    } catch(e) {
        console.log("erro =", e);
        res.status(400).send({error: e});
    }
})

setInterval(async () => {
    console.log("=============Extracting products desc=============");
    await ExtractDesc();
}, 2 * 60000);    // per 10 mins

setInterval(async () => {
    console.log("==============Extracting products QA==============");
    await ExtractQA();
}, 2 * 60000);   // per 10 mins

app.listen(port, () => console.log(`App running on: http://localhost:${port}`));
