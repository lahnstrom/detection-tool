import fs from "fs";
import converter from "json-2-csv";
import config from "config";

const FILE_NAME = config.get("batch.fileName");
const INPUT_FILE_PUBS = `./out/batch/publication_data/${FILE_NAME}.json`;
const BATCH_FILE_PATH = `./out/batch/gpt_job_result/output/${FILE_NAME}.jsonl`;
const BATCH_FILE_PATH_2 = `./out/batch/gpt_job_result/output/${FILE_NAME}_2.jsonl`;
const OUTPUT_FILE = `./out/batch/final_output/${FILE_NAME}.csv`;
const OUTPUT_FILE_ANALYSIS = `../analysis/data/${FILE_NAME}.csv`;
const OUTPUT_FILE_PUBLICATIONS = `../analysis/data/${FILE_NAME}_publications.csv`;

const reduceGptResults = (acc, cur) => {
  const {
    custom_id,
    response: { body },
  } = cur;

  console.log("Processing GPT result for", custom_id);
  const [nct_id, pmid] = custom_id.split("-");
  const message = body?.choices[0]?.message;
  const finishReason = body?.choices[0]?.finish_reason;
  if (finishReason === "length") {
    const error = `${custom_id} was finished due to length`;
    console.error(error);
    acc.errors = [...(acc.errors || []), error];
    return acc;
  }
  const resRaw = message?.content;
  let res;
  try {
    res = resRaw ? JSON.parse(resRaw) : null;
  } catch (e) {
    console.error("Error parsing GPT result", e);
  }

  if (!acc[nct_id]) {
    acc[nct_id] = [{ pmid, res }];
  } else if (acc[nct_id] && Array.isArray(acc[nct_id])) {
    acc[nct_id].push({ pmid, res });
  }

  return acc;
};

const mergeTripleResults = (
  { pubs, validation, registration, error },
  gptResultsMap
) => {
  const gptResultsArray = gptResultsMap[registration.nctId];

  const mergedPubs = [];

  if (!gptResultsArray) {
    // This isn't really an error. Many trials have no discovered publications.
    return { pubs, validation, registration, error };
  }

  for (const pub of pubs) {
    const gptResult = gptResultsArray.find((r) => r.pmid === pub.pmid);
    if (gptResult?.res) {
      mergedPubs.push({ ...pub, ...gptResult.res });
    } else {
      // This should never happen
      console.log("No GPT result for", pub.pmid);
      mergedPubs.push({ ...pub, gptResult: null });
    }
  }

  return { pubs: mergedPubs, validation, registration, error };
};

const generateOutput = ({
  validation,
  registration,
  pubs,
  error,
  truncated,
}) => {
  const toolResults = pubs?.some((pub) => pub?.hasResults) || false;
  const hasError = !!error;
  const toolPromptedPmids = pubs?.map((pub) => pub?.pmid).join(",") || null;

  // Determine the unique identification steps from the tool results
  const toolIdentStepsSet = new Set();

  pubs?.forEach((pub) => {
    if (pub?.hasResults) {
      pub?.sources?.forEach((source) => {
        toolIdentStepsSet.add(source);
      });
    }
  });

  const toolIdentSteps = [...toolIdentStepsSet].join(",");
  const toolResultPmids = pubs
    ?.filter((pub) => pub?.hasResults)
    .map((pub) => pub.pmid)
    .join(",");

  return {
    nct_id: registration.nctId,
    tool_results: toolResults,
    has_error: hasError,
    tool_prompted_pmids: toolPromptedPmids,
    tool_result_pmids: toolResultPmids,
    tool_ident_steps: toolIdentSteps,
    tool_truncated: truncated,
  };
};

(async () => {
  const raw = fs.readFileSync(INPUT_FILE_PUBS).toString();
  const triples = JSON.parse(raw);

  const gptResult1 = fs
    .readFileSync(BATCH_FILE_PATH)
    .toString()
    .split("\n")
    .filter(Boolean)
    .map(JSON.parse);

  const gptResult2 = fs
    .readFileSync(BATCH_FILE_PATH_2)
    .toString()
    .split("\n")
    .filter(Boolean)
    .map(JSON.parse);

  const gptResultMap = gptResult1
    .concat(gptResult2)
    .reduce(reduceGptResults, {});

  const mergedResults = triples.map((triple) =>
    mergeTripleResults(triple, gptResultMap)
  );

  const finalOutput = mergedResults.map(generateOutput);

  const csvOutput = converter.json2csv(finalOutput);

  fs.writeFileSync(OUTPUT_FILE, csvOutput);
  fs.writeFileSync(OUTPUT_FILE_ANALYSIS, csvOutput);

  const publicationOutput = mergedResults.map(({ pubs, registration }) => {
    return (
      pubs?.map((pub) => {
        return {
          nct_id: registration.nctId,
          pmid: pub.pmid,
          has_results: pub.hasResults,
          sources: pub.sources.join(","),
        };
      }) || []
    );
  });

  const csvOutputPublications = converter.json2csv(publicationOutput.flat());
  fs.writeFileSync(OUTPUT_FILE_PUBLICATIONS, csvOutputPublications);
})();
