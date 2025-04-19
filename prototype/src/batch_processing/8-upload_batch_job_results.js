import fs from "fs";
import config from "config";
import OpenAI from "openai";

const openai = new OpenAI();

const FILE_NAME = config.get("batch.fileName");
const INPUT_FILE = `./out/batch/gpt_job_result/input/${FILE_NAME}.jsonl`;
const OUTPUT_FILE = `./out/batch/gpt_job_result/metadata/${FILE_NAME}.json`;

const uploadBatchJob = async (filePath) => {
  const file = await openai.files.create({
    file: fs.createReadStream(filePath),
    purpose: "batch",
  });

  console.log(file);
  return file;
};

const createBatchJob = async (fileId) => {
  const batch = await openai.batches.create({
    input_file_id: fileId,
    endpoint: "/v1/chat/completions",
    completion_window: "24h",
  });

  console.log(batch);
  return batch;
};

(async () => {
  console.log("WARNING: UPLOADING BATCH JOB - RESULTS");
  const file = await uploadBatchJob(INPUT_FILE);
  const batch = await createBatchJob(file.id);

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(batch));
})();
