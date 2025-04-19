import {
  fetchPublicationLiveCache,
  fetchRegistrationLiveCache,
  fetchResultsLiveCache,
  writeResultsLiveCache,
} from "../server_utils.js";
import fs from "fs";
import { zodResponseFormat } from "openai/helpers/zod";
import config from "config";
import { SinglePublicationOutput } from "../results_detection.js";
import OpenAI from "openai";

const MODEL = config.get("live.resultModel");
const MAX_TOKENS_PER_QUERY = config.get("live.maxTokensResults");

const openai = new OpenAI();
const systemPrompt = fs
  .readFileSync(config.get("live.systemPromptResults"))
  .toString();

export async function resultsDiscovery(nctId, pmid) {
  const cacheHit = fetchResultsLiveCache(nctId, pmid);
  if (cacheHit) {
    return cacheHit;
  }
  const registration = fetchRegistrationLiveCache(nctId);
  const publication = fetchPublicationLiveCache(pmid);
  const userPrompt = buildUserPrompt(registration, publication);

  const results = await promptGpt(userPrompt);
  writeResultsLiveCache(nctId, pmid, results);
  return results;
}

export const buildUserPrompt = (registration, publication) => {
  if (!publication) {
    throw new Error(
      `buildUserPrompt expecting non-null publication, got ${publication}`
    );
  }

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

export const promptGpt = async (userPrompt) => {
  const response = await openai.beta.chat.completions.parse({
    model: MODEL,
    max_tokens: MAX_TOKENS_PER_QUERY,
    messages: [
      {
        role: "system",
        content: systemPrompt,
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
  });

  const success = response.choices[0].finish_reason === "stop";

  return {
    content: success ? response.choices[0]?.message?.parsed : null,
    success,
    tokens: response?.usage?.total_tokens || 0,
  };
};
