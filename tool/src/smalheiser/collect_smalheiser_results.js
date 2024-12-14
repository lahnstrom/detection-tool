import fs from "fs";
import csv from "csvtojson";
import axios from "axios";
import * as cheerio from "cheerio";

const INPUT_FILE = "./data/validation_dataset_smaller_batches.csv";
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

(async () => {
  const data = await csv().fromFile(INPUT_FILE);

  const output = [];
  for (const trial of data) {
    try {
      const { nct_id, url } = trial;

      const res = await axios.get(url);
      // Load the HTML into Cheerio
      const $ = cheerio.load(res.data);

      // Select the first <tbody> and all its <tr> children
      const rows = $("tbody").first().find("tr");

      // Iterate over each <tr> and extract data
      const extractedData = [];
      rows.each((index, row) => {
        const cells = $(row).find("td");
        const rowData = [];

        // Iterate over each <td> and extract its text
        cells.each((_, cell) => {
          rowData.push($(cell).text().trim());
        });

        extractedData.push(rowData);
      });

      output.push({
        nct_id,
        data: extractedData,
      });
    } catch (err) {
      console.log(err);
    }
  }

  fs.writeFileSync(
    "./out/smalheiser/smaller_batches.json",
    JSON.stringify(output, null, 2)
  );
})();
