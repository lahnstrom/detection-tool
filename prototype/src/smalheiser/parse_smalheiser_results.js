import fs from "fs";
import csv from "csvtojson";
import axios from "axios";
import * as cheerio from "cheerio";
import converter from "json-2-csv";

const INPUT_FILE = "./out/smalheiser/smaller_batches.json";
const PROB_THRESHOLD = 0.95;

(async () => {
  const data = JSON.parse(fs.readFileSync(INPUT_FILE).toString());

  const parsed = data.map(({ nct_id, data }) => {
    const parsedData = data.map(
      ([rank, simScoreRaw, probRaw, article, linked, title]) => {
        const simScore = parseFloat(simScoreRaw) / 100;
        const prob = parseFloat(probRaw) / 100;

        return {
          rank,
          simScore,
          prob,
          article,
          linked,
          title,
        };
      }
    );
    return {
      nct_id,
      best_match: parsedData[0]?.article,
      best_match_prob: parsedData[0]?.prob,
      best_match_sim: parsedData[0]?.simScore,
      has_sim_pub: parsedData.some((d) => d.simScore >= PROB_THRESHOLD),
      has_prob_pub: parsedData.some((d) => d.prob >= PROB_THRESHOLD),
      result_pubs_sim: parsedData
        .filter((d) => d.simScore >= PROB_THRESHOLD)
        .map((d) => d.article)
        .join(","),
      result_pubs_prob: parsedData
        .filter((d) => d.prob >= PROB_THRESHOLD)
        .map((d) => d.article)
        .join(","),
      best_match: parsedData[0]?.article,
    };
  });

  console.log(parsed);
  const csvOutput = converter.json2csv(parsed);
  fs.writeFileSync(`./out/smalheiser/batches_${PROB_THRESHOLD}.csv`, csvOutput);
})();
