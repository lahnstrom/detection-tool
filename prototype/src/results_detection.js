import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import OpenAI from "openai";
import fs from "fs";
import { log } from "./utils.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const SinglePublicationOutput = z.object({
  hasResults: z
    .boolean()
    .describe(
      "Your JUDGMENT whether or not this Publication contains results. THIS judgment is formed by comparing the registration description, enrollment, study design, and more, with the publication title and abstract."
    ),
  reason: z
    .string()
    .describe(
      "Maximum of two sentences describing your reasoning as to why this publication contains results of the trial."
    ),
});

const systemPromptSingle = fs
  .readFileSync("./prompts/systemPromptSingleAbstract.txt")
  .toString();

export const buildUserPrompt = (publication) => {
  if (!publication) {
    throw new Error(
      `buildUserPrompt expecting non-null publication, got ${publication}`
    );
  }

  const abstract = publication.abstract;
  const registration = publication.registration;
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
Title: ${abstract.title}
Author: ${abstract.authors}
Abstract: ${abstract.text}
-----`;

  return prompt;
};

const logGptResToFile = ({ responses, publications }) => {
  const location = `./out/gpt-res-raw/${publications?.[0]?.registration?.nctId}.json`;
  log(`Writing GPT response to file ${location}`);
  fs.writeFileSync(location, JSON.stringify(responses));
};

export const promptGptIndividually = async (pubsWithPrompts) => {
  const registration = pubsWithPrompts?.[0]?.registration;
  fs.writeFileSync(
    `./out/prompts/${registration?.nctId}.txt`,
    pubsWithPrompts?.map((pub) => pub?.userPrompt).join("\n")
  );

  log(
    `Prompting chatGPT with prompt found in ./out/prompts/${registration?.nctId}.txt`
  );

  const requests = pubsWithPrompts.map((pub) =>
    openai.beta.chat.completions.parse({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPromptSingle,
        },
        {
          role: "user",
          content: pub?.userPrompt,
        },
      ],
      response_format: zodResponseFormat(
        SinglePublicationOutput,
        "single_publication_format"
      ),
    })
  );

  const responses = await Promise.all(requests);

  const parsed = responses.map((res, i) => {
    if (res.choices[0].finish_reason === "stop") {
      return {
        ...pubsWithPrompts[i],
        gptRes: res.choices[0]?.message?.parsed,
        success: true,
        tokens: res?.usage?.total_tokens || 0,
      };
    }
    return {
      ...pubsWithPrompts[i],
      gptRes: null,
      success: false,
      tokens: res?.usage?.total_tokens || 0,
    };
  });

  logGptResToFile({ responses, publications: pubsWithPrompts });

  return parsed;
};

export const detectResults = async (publications) => {
  const pubsWithPrompts = publications.map((pub) => {
    return { ...pub, userPrompt: buildUserPrompt(pub) };
  });

  const pubsWithResults = await promptGptIndividually(pubsWithPrompts);

  return pubsWithResults;
};
