import { fetchRegistrationFs, parseRegistration } from "../ctgov_utils.js";
import fs from "fs";
import csv from "csvtojson";
import _ from "lodash";
import seedrandom from "seedrandom";
import { fetchArticleByPmid } from "../sqlite_repo.js";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import config from "config";
import readline from "readline";
import OpenAI from "openai";

const SEED = config.get("batch.seed");
const SAMPLE_SIZE = config.get("batch.sampleSize");
const VALIDATION_DATA_FILE = config.get("batch.validationFile");
const MAX_TOKENS_PER_QUERY = config.get("batch.maxTokensFakeAbstracts");
const MODEL = config.get("batch.fakeAbstractsModel");
const FILE_NAME = config.get("batch.fileName");
const OUTPUT_FILE = `./out/batch/publication_data/${FILE_NAME}.json`;
const OUTPUT_FILE_FAKE_ABSTRACTS = `./out/batch/publication_data/fake/${FILE_NAME}.json`;
const BATCH_INPUT_FILE = `./out/batch/gpt_job_fake_abstracts/input/${FILE_NAME}.jsonl`;
const BATCH_METADATA_FILE = `./out/batch/gpt_job_fake_abstracts/metadata/${FILE_NAME}.json`;
const BATCH_RESULTS_FILE = `./out/batch/gpt_job_fake_abstracts/output/${FILE_NAME}.jsonl`;

const systemPromptFakeAbstracts = fs
  .readFileSync(config.get("batch.systemPromptFakeAbstracts"))
  .toString();
const openai = new OpenAI();

// Create an interface to read from the console
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Function to pause and wait for a specific phrase
function waitForPhrase(phrase) {
  return new Promise((resolve) => {
    console.log(`Waiting for the phrase "${phrase}"...`);

    // Listen for user input
    rl.on("line", (input) => {
      if (input.trim() === phrase) {
        console.log(`You entered the correct phrase: "${phrase}"`);
        rl.close(); // Close the readline interface
        resolve(); // Resolve the promise to continue
      } else {
        console.log(`Incorrect. Please type "${phrase}" to continue.`);
      }
    });
  });
}

const FakeAbstractFormat = z.object({
  abstract: z
    .string()
    .describe(
      "The modified abstract that is scientifically coherent but distinct from the original publication, ensuring it no longer matches the provided clinical trial registration."
    ),
  title: z
    .string()
    .describe(
      "The modified title that accurately represents the contents of the generated abstract while being distinct from the original title."
    ),
});

const prepareRegistrationData = async (filePath, seed, sampleSize) => {
  const data = await csv().fromFile(filePath);

  const pairs = data.map((trial) => {
    const registration = fetchRegistrationFs(trial.nct_id);

    return {
      registration: parseRegistration(registration),
      validation: trial,
    };
  });

  const uniquePairs = filterDuplicates(pairs);
  const filtered = uniquePairs.filter(
    ({ validation }) =>
      !!validation.publication_pmid && validation.publication_pmid !== "NA"
  );

  //   Seed and sample
  seedrandom(seed, { global: true });
  const _s = _.runInContext();
  const cases = _s.sampleSize(filtered, sampleSize);

  return cases;
};

const filterDuplicates = (pairs) => {
  const unique = pairs.reduce((acc, current) => {
    if (
      !acc.find(
        (item) => item.registration.nctId === current.registration.nctId
      )
    ) {
      acc.push(current);
    }
    return acc;
  }, []);

  return unique;
};

const buildPrompt = (registration, pub) => {
  return `REGISTRATION:

    ${JSON.stringify(registration, null, 2)}

    -------------------
    PUBLICATION:

    ${JSON.stringify(pub, null, 2)}`;
};

const generateGptQuery = (withAbstract) => {
  const { registration, pubs } = withAbstract;
  const pub = pubs[0];

  const userPrompt = buildPrompt(registration, pub);
  const body = {
    model: MODEL,
    max_tokens: MAX_TOKENS_PER_QUERY,
    messages: [
      {
        role: "system",
        content: systemPromptFakeAbstracts,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
    response_format: zodResponseFormat(
      FakeAbstractFormat,
      "single_publication_format"
    ),
  };

  return {
    custom_id: `${registration.nctId}`,
    method: "POST",
    url: "/v1/chat/completions",
    body,
  };
};

const addAbstract = async (pair) => {
  const { registration, validation } = pair;
  const { publication_pmid } = validation;
  const article = await fetchArticleByPmid(publication_pmid);
  return { registration, validation, pubs: [article] };
};

const replaceAbstracts = (triple, gptResults) => {
  const { registration, pubs } = triple;
  const gptRes = gptResults.find((r) => r.custom_id === registration.nctId);
  const jsonRes = JSON.parse(gptRes.response.body.choices[0].message.content);
  const newPub = _.cloneDeep(pubs[0]);
  newPub.abstract = jsonRes.abstract;
  newPub.title = jsonRes.title;

  return { oldPub: [pubs[0]], ...triple, pubs: [newPub] };
};

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

const fetchCurrent = async (id) => {
  const batch = openai.batches.retrieve(id);

  return batch;
};

(async () => {
  const sampledPairs = await prepareRegistrationData(
    VALIDATION_DATA_FILE,
    SEED,
    SAMPLE_SIZE
  );

  const withAbstracts = await Promise.all(sampledPairs.map(addAbstract));

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(withAbstracts));

  const queries = withAbstracts.map(generateGptQuery);

  const jsonl = queries.map((query) => JSON.stringify(query)).join("\n");

  fs.writeFileSync(BATCH_INPUT_FILE, jsonl);

  console.log("Batch job ready for upload.");
  console.log("Number of queries: ", queries.length);
  console.log(
    "Confirm that you are ready to run the batch job by typing 'confirm'."
  );

  await waitForPhrase("confirm");

  console.log("Uploading batch job...");
  const file = await uploadBatchJob(BATCH_INPUT_FILE);
  let batch = await createBatchJob(file.id);
  let completed = false;

  fs.writeFileSync(BATCH_METADATA_FILE, JSON.stringify(batch));

  while (!completed) {
    const oldId = batch.id;
    batch = await fetchCurrent(oldId);
    if (batch.status === "completed") {
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

  fs.writeFileSync(BATCH_RESULTS_FILE, fileContents);

  const results = fileContents.split("\n").filter(Boolean).map(JSON.parse);

  const withNewAbstracts = withAbstracts.map((triple) =>
    replaceAbstracts(triple, results)
  );

  fs.writeFileSync(
    OUTPUT_FILE_FAKE_ABSTRACTS,
    JSON.stringify(withNewAbstracts)
  );

  withNewAbstracts.forEach(({ pubs, oldPub, registration }) => {
    if (!oldPub) {
      return;
    }
    const abs1 = pubs[0].abstract;
    const abs2 = oldPub[0].abstract;
    const title1 = pubs[0].title;
    const title2 = oldPub[0].title;
    const output = `
      Actual vs Fake Abstract Comparison:
      Actual Title: ${title2}
      Fake Title: ${title1}
      Actual Abstract: ${abs2}
      Fake Abstract: ${abs1}
      `;
    fs.writeFileSync(
      `./out/abstract_comparison/${registration.nctId}.txt`,
      output
    );
  });
})();
