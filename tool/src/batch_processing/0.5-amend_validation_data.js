// Due to faulty coding during construction of the validation dataset, some trials that were registered in both euctr and ctgov were not included.
// This file constructs a new validation dataset that includes these trials.

import fs from "fs";
import config from "config";
import csv from "csvtojson";
import converter from "json-2-csv";
import _ from "lodash";

const INPUT_FILE_OLD = "./data/validation_dataset.csv";
const INPUT_FILE_NEW = "./data/validation_dataset_2.csv";

const filterDuplicates = (val) => {
  const unique = val.reduce((acc, current) => {
    const foundDuplicate = acc.find((item) => item.nct_id === current.nct_id);
    if (!foundDuplicate) {
      acc.push(current);
    } else {
      console.log("Found duplicate: ", current.nct_id);
      console.log("Duplicate: ", foundDuplicate.nct_id);
    }
    return acc;
  }, []);

  return unique;
};

(async () => {
  const oldData = await csv({
    delimiter: config.get("batch.delimiter"),
  }).fromFile(INPUT_FILE_OLD);

  const newData = await csv({
    delimiter: config.get("batch.delimiter"),
  }).fromFile(INPUT_FILE_NEW);

  const onlyMissing = newData.filter((val) => {
    return !oldData.some((oldVal) => oldVal.nct_id === val.nct_id);
  });

  const withoutDuplicates = filterDuplicates(newData);
  console.log("N Duplicates: ", newData.length - withoutDuplicates.length);

  const singleNct = onlyMissing.filter((val) => {
    if (val.nct_id.length > 11) {
      return false;
    }
    return true;
  });

  const newCsv = converter.json2csv(singleNct);
  fs.writeFileSync("./data/validation_dataset_missed.csv", newCsv);
})();
