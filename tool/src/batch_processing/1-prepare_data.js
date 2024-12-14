import { fetchRegistrationFs, parseRegistration } from "../ctgov_utils.js";
import fs from "fs";
import csv from "csvtojson";
import _ from "lodash";
import seedrandom from "seedrandom";
import config from "config";

const SEED = config.get("batch.seed");
const SAMPLE_SIZE = config.get("batch.sampleSize");
const FILE_NAME = config.get("batch.fileName");
const INPUT_FILE = config.get("batch.validationFile");
const OUTPUT_FILE = `./out/batch/prepared_data/${FILE_NAME}.json`;

const prepareRegistrationData = async (filePath, seed, sampleSize) => {
  const data = await csv({ delimiter: config.get("batch.delimiter") }).fromFile(
    filePath
  );

  seedrandom(seed, { global: true });
  const _s = _.runInContext();
  const cases = _s.sampleSize(data, sampleSize);

  const pairs = cases.map((trial) => {
    const registration = fetchRegistrationFs(trial.nct_id);

    return {
      registration: parseRegistration(registration),
      validation: trial,
    };
  });

  return pairs;
};

const filterDuplicates = (pairs) => {
  const unique = pairs.reduce((acc, current) => {
    const foundDuplicate = acc.find(
      (item) => item.registration.nctId === current.registration.nctId
    );
    if (!foundDuplicate) {
      acc.push(current);
    } else {
      console.log("Found duplicate: ", current.registration.nctId);
      console.log("Duplicate: ", foundDuplicate.registration.nctId);
    }
    return acc;
  }, []);

  return unique;
};

(async () => {
  const pairs = await prepareRegistrationData(INPUT_FILE, SEED, SAMPLE_SIZE);
  const uniquePairs = filterDuplicates(pairs);
  const withoutMultipleNct = uniquePairs.filter((val) => {
    if (val.registration.nctId.length > 11) {
      console.error("Should not happen");
      return false;
    }

    return true;
  });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(withoutMultipleNct));
})();
