import { zodResponseFormat } from "openai/helpers/zod";
import fs from "fs";
import _ from "lodash";
import { PubmedGptQueryOutput } from "../publication_discovery.js";
import config from "config";

const MODEL = config.get("batch.queryModel");
const FILE_NAME = config.get("batch.fileName");
const MAX_TOKENS_PER_QUERY = config.get("batch.maxTokensQuery");
const INPUT_FILE = `./out/batch/prepared_data/${FILE_NAME}.json`;
const OUTPUT_FILE = `./out/batch/gpt_job_query/input/${FILE_NAME}.jsonl`;
const GPT_SEED = config.get("batch.gptSeed");

const systemPromptPubmedSearchGeneration = fs
  .readFileSync(config.get("batch.systemPromptQueries"))
  .toString();

const generateGptQuery = (pair) => {
  const { registration } = pair;

  // Do not want GPT getting confused here
  const filteredRegistration = { ...registration };
  delete filteredRegistration.hasResults;
  delete filteredRegistration.publicationPmid;

  const body = {
    model: MODEL,
    max_tokens: MAX_TOKENS_PER_QUERY,
    seed: GPT_SEED,
    messages: [
      {
        role: "system",
        content: systemPromptPubmedSearchGeneration,
      },
      {
        role: "user",
        content: JSON.stringify(filteredRegistration),
      },
    ],
    response_format: zodResponseFormat(
      PubmedGptQueryOutput,
      "pubmed_search_format"
    ),
  };

  const query = {
    custom_id: registration.nctId,
    method: "POST",
    url: "/v1/chat/completions",

    body,
  };

  return query;
};

(async () => {
  const pairs = JSON.parse(fs.readFileSync(INPUT_FILE).toString());
  const jsonl = pairs
    .map(generateGptQuery)
    .map((query) => JSON.stringify(query))
    .join("\n");

  fs.writeFileSync(OUTPUT_FILE, jsonl);
})();
