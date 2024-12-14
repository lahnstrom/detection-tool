import fs from "fs";
import csv from "csvtojson";
import converter from "json-2-csv";
import _ from "lodash";
import seedrandom from "seedrandom";
import {
  fetchRegistrationFs,
  checkSummaryResults,
  parseRegistration,
} from "./src/ctgov_utils.js";
import {
  discoverPublications,
  PUB_SOURCE,
} from "./src/publication_discovery.js";
import {
  fetchAbstracts,
  fetchPubmedRefs,
  maxDateFilter,
  mergePubsAbstracts,
  minDateFilter,
  parsePubmedAbstractXML,
} from "./src/pubmed_utils.js";
import {
  fetchWithRetries,
  log,
  logTimeAndCost,
  processFinalOutput,
  removeDuplicatePublications,
} from "./src/utils.js";
import { detectResults } from "./src/results_detection.js";
import { cacheResultToFile } from "./src/cache.js";
import { fetchArticlesByPmids } from "./src/sqlite_repo.js";

// To avoid rate limit on chatgpt
const LIMIT_PUBS = 15;

(async () => {
  const t1 = Date.now() / 1000;

  // Dirty solution to keep track of costs
  global.pubmedTokens = 0;

  const validationData = await csv().fromFile("./data/validation_dataset.csv");

  const negativeCases = validationData.filter((trial) => {
    return trial.has_publication === "No" && trial.has_summary_results === "No";
  });

  const positiveCases = validationData.filter((trial) => {
    return (
      trial.has_publication === "Yes" || trial.has_summary_results === "Yes"
    );
  });

  // const finalSample = await csv({ delimiter: ";" }).fromFile(
  //   "./data/final-sample-ctgov.csv"
  // );

  // For testing purposes:
  // let output = JSON.parse(
  //   fs.readFileSync("./out/val/validation_run_error.json")
  // );

  let output = [];

  // Set seed
  seedrandom("my_random_seed", { global: true });
  const _s = _.runInContext();

  // SAMPLE N, this determines what it is going to cost to run!
  const validationCases = _s.sampleSize(validationData, 100);

  // const cases = validationCases.filter(
  //   (trial) => trial.has_summary_results === "Yes"
  // );

  // const sampleCases = _s.sampleSize(finalSample, 10);

  // // SELECT A SPECIFIC CASE
  // const cases = [
  //   validationData.find((trial) => trial.nct_id === "NCT01106365"),
  // ];

  // TODO: FIND OUT WHY THE FOLLOWING NCTID:s FAIL:
  // NCT02659371, NCT02295696, NCT00860730

  const cases = validationCases;

  for (let trial of cases) {
    let registration = {};
    let hasSummaryResults = null;
    try {
      // const rawRegistration = await fetchRegistration(trial.nct_id);
      const rawRegistration = await fetchRegistrationFs(trial.nct_id);

      registration = parseRegistration(rawRegistration);
      hasSummaryResults = checkSummaryResults(registration);

      // Dirty solution that uses publication pmids from the validation data
      if (trial.publication_pmid) {
        registration.publicationPmid = trial?.publication_pmid;
      }

      const discoveredPublications = await discoverPublications(registration);
      
      const uniquePublications = removeDuplicatePublications(
        discoveredPublications
      );
      const truncatedPublications = uniquePublications.slice(0, LIMIT_PUBS);
      const discoveredPmids = truncatedPublications.map((pub) => pub.pmid);
      const pubsWithAbstracts = fetchArticlesByPmids(discoveredPmids);

      // This line should be used for all trials
      const minDayFilteredPublications = minDateFilter(
        pubsWithAbstracts,
        registration.startDate
      );

      // This line should only be used during VALIDATION
      const filteredPublications = maxDateFilter(
        minDayFilteredPublications,
        trial?.registry == "iv" ? "2020-11-17" : "2023-02-15"
      );

      // For testing purposes:
      // const publicationResults = pubsWithAbstracts;

      const publicationResults = await cacheResultToFile(
        () => detectResults(filteredPublications),
        `results-${trial.nct_id}`
      );

      output.push({
        trial,
        hasSummaryResults,
        registration,
        results: publicationResults,
        error: null,
        truncated: uniquePublications.length > truncatedPublications.length,
      });
    } catch (error) {
      log(error, true);

      output.push({
        trial,
        registration,
        hasSummaryResults,
        results: [],
        error,
        truncated: false,
      });
    }
  }

  try {
    const finalOutput = processFinalOutput(output);
    const csvOutput = converter.json2csv(finalOutput);

    fs.writeFileSync(
      `./out/val/validation_run_${new Date()
        .toISOString()
        .replaceAll(".", ":")}.csv`,
      csvOutput
    );
    const t2 = Date.now() / 1000;
    const totalTokens =
      finalOutput.reduce((acc, res) => acc + res.toolTokens, 0) +
      global.pubmedTokens;
    logTimeAndCost({
      t1,
      t2,
      tokens: totalTokens,
      nCases: cases.length,
    });
  } catch (error) {
    fs.writeFileSync(
      "./out/val/validation_run_error.json",
      JSON.stringify(output)
    );
    log(error);
  }
})();
