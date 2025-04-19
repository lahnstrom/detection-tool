import { zodResponseFormat } from "openai/helpers/zod";
import fs from "fs";
import _ from "lodash";
import { SinglePublicationOutput } from "../results_detection.js";
import config from "config";

const MODEL = config.get("batch.resultModel");
const FILE_NAME = config.get("batch.fileName");
const INPUT_FILE = `./out/batch/publication_data/${FILE_NAME}.json`;
const OUTPUT_FILE = `./out/batch/gpt_job_result/input/${FILE_NAME}.jsonl`;
const OUTPUT_FILE_2 = `./out/batch/gpt_job_result/input/${FILE_NAME}_2.jsonl`;
const MAX_TOKENS_PER_QUERY = config.get("batch.maxTokensResults");
const GPT_SEED = config.get("batch.gptSeed");

const systemPromptSingle = fs
  .readFileSync(config.get("batch.systemPromptResults"))
  .toString();

export const buildUserPrompt = ({ publication, registration }) => {
  const prompt = `REGISTRATION:
Brief Title: ${registration.briefTitle}
Official Title: ${registration.officialTitle}
Organization: ${registration.organization?.fullName}
NCTID: ${registration.nctId}
Study Type: ${registration.studyType}
Summary: ${registration.briefSummary}
Description: ${registration.detailedDescription}
-----

PUBLICATION:
Title: ${publication.title}
Author: ${publication.authors}
Abstract: ${publication.abstract}
-----`;

  return prompt;
};

const generateGptQuery = (triple) => {
  const { registration, pubs } = triple;

  if (!pubs || !pubs.length) {
    return [];
  }

  const pubBody = pubs.map((pub) => {
    const userPrompt = buildUserPrompt({ publication: pub, registration });
    return {
      body: {
        model: MODEL,
        max_tokens: MAX_TOKENS_PER_QUERY,
        seed: GPT_SEED,
        messages: [
          {
            role: "system",
            content: systemPromptSingle,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        response_format: zodResponseFormat(
          SinglePublicationOutput,
          "single_publication_format"
        ),
      },
      pub,
    };
  });

  const queries = pubBody.map(({ body, pub }) => {
    return {
      custom_id: `${registration.nctId}-${pub.pmid}`,
      method: "POST",
      url: "/v1/chat/completions",
      body,
    };
  });

  return queries;
};

const loadPublicationsFromFile = async (filePath) => {
  const pubs = fs.readFileSync(filePath);
  return JSON.parse(pubs);
};

(async () => {
  const triples = await loadPublicationsFromFile(INPUT_FILE);

  const queries = [];

  for (const triple of triples) {
    queries.push(generateGptQuery(triple));
  }

  const queriesFlat = _.flatten(queries);
  const totalQueries = queriesFlat.length;
  const totalTokens = totalQueries * MAX_TOKENS_PER_QUERY;

  console.log(`Total queries: ${totalQueries}`);
  console.log(`Max total tokens: ${totalTokens}`);
  console.log(`Max cost on ${MODEL}: ${(totalTokens / 1000000) * 0.075} USD`);

  const jsonQueries = queriesFlat.map((query) => JSON.stringify(query));

  if (jsonQueries.length > 15000) {
    console.log("WARNING: JSONL FILE TOO LARGE - splitting");
    const midIndex = Math.ceil(jsonQueries.length / 2);
    const firstPart = jsonQueries.slice(0, midIndex);
    const secondPart = jsonQueries.slice(midIndex);

    fs.writeFileSync(OUTPUT_FILE, firstPart.join("\n"));
    fs.writeFileSync(OUTPUT_FILE_2, secondPart.join("\n"));
  } else {
    const jsonl = jsonQueries.join("\n");

    fs.writeFileSync(OUTPUT_FILE, jsonl);
  }
})();
