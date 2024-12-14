import fs from "fs";
import config from "config";

const FILE_NAME = config.get("batch.fileName");
const FILE_PATH = `./out/batch/gpt_job_result/output/${FILE_NAME}.jsonl`;
const OUTPUT_FOLDER = "./batch_results/results/";

(async () => {
  const results = fs
    .readFileSync(FILE_PATH)
    .toString()
    .split("\n")
    .filter(Boolean)
    .map(JSON.parse);

  const totalTokens = results.reduce((acc, obj) => {
    return acc + obj.response?.body?.usage?.total_tokens;
  }, 0);

  // Find the result with the highest total token count
  const promptTokens = results.reduce((acc, obj) => {
    return acc + obj.response?.body?.usage?.prompt_tokens;
  }, 0);

  const completionTokens = results.reduce((acc, obj) => {
    return acc + obj.response?.body?.usage?.completion_tokens;
  }, 0);

  // Calculate average tokens per query
  console.log(`Total queries: ${results.length}`);
  console.log(`Total tokens: ${totalTokens}`);
  console.log(`Total prompt tokens: ${promptTokens}`);
  console.log(`Total completion tokens: ${completionTokens}`);
  console.log(`Average tokens per query: ${totalTokens / results?.length}`);
  console.log(
    `Average prompt tokens per query: ${promptTokens / results?.length}`
  );
  console.log(
    `Average completion tokens per query: ${completionTokens / results?.length}`
  );
  

  results.forEach((obj) => {
    const response = obj?.response?.body?.choices[0]?.message?.content;

    if (response) {
      fs.writeFileSync(`${OUTPUT_FOLDER}${obj.custom_id}.json`, response);
    } else {
      console.error(`No response for ${obj?.custom_id}`);
    }
  });
})();
