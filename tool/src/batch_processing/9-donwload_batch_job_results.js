import fs from "fs";
import config from "config";
import OpenAI from "openai";

const openai = new OpenAI();

const FILE_NAME = config.get("batch.fileName");
const INPUT_FILE = `./out/batch/gpt_job_result/metadata/${FILE_NAME}.json`;
const OUTPUT_FILE = `./out/batch/gpt_job_result/output/${FILE_NAME}.jsonl`;

const fetchCurrent = async (oldBatch) => {
  const batch = openai.batches.retrieve(oldBatch.id);

  return batch;
};

(async () => {
  const oldBatch = JSON.parse(fs.readFileSync(INPUT_FILE).toString());
  let completed = false;
  let batch;

  while (!completed) {
    batch = await fetchCurrent(oldBatch);
    if (batch.status === "completed" ) {
      console.log("Batch completed");
      completed = true;
      break;
    }
    if (
      batch.status === "failed" ||
      batch.status === "cancelled" ||
      batch.status === "expired" ||
      batch.status === "cancelling"
    ) {
      console.log("Batch failed, status: ", batch.status);
      return;
    }

    console.log("Batch not completed yet");
    console.log("Status: ", batch.status);

    // Wait for 60 seconds before checking again
    await new Promise((resolve) => setTimeout(resolve, 60000));
  }

  const fileResponse = await openai.files.content(batch.output_file_id);
  const fileContents = await fileResponse.text();

  fs.writeFileSync(OUTPUT_FILE, fileContents);
})();
