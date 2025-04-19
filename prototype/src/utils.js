import commandLineArgs from "command-line-args";
import pRetry, { AbortError } from "p-retry";
import seedrandom from "seedrandom";
import axios from "axios";
import fs from "fs";
import config from "config";
import _ from "lodash";
const optionDefinitions = [
  { name: "nct", alias: "n", type: String },
  { name: "real", alias: "r", type: Boolean, default: false },
  { name: "silent", alias: "s", type: Boolean, default: false },
];

const options = commandLineArgs(optionDefinitions, { partial: true });

export const doiRegex = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/gi;

const N_RETRIES = config.get("scraping.nRetries");
const N_DOIS_PER_SOURCE = config.get("scraping.nDoisPerSource");
const USER_AGENT = config.get("scraping.userAgent");

const ignoredSites = JSON.parse(
  fs.readFileSync("./data/ignoredSearchLocations.json")
);

export const log = (msg) => {
  if (!options.silent) {
    console.log(msg);
  }
};

export const seedLodash = (seed) => {
  const orig = Math.random;
  seedrandom(seed, { global: true });
  const lodash = _.runInContext();
  Math.random = orig;
  return lodash;
};

export const roundNumber = (num) => {
  return +(Math.round(num + "e+4") + "e-4");
};

export const fetchWithRetries = async (request) => {
  return pRetry(request, {
    retries: N_RETRIES,
    onFailedAttempt: (error) => {
      log(
        `Attempt ${error.attemptNumber} failed. There are ${error.retriesLeft} retries left.`
      );
    },
  });
};

export const logTimeAndCost = ({ t1, t2, tokens, nCases }) => {
  const elapsedSeconds = t2 - t1;

  log(
    `Trials queried = ${nCases}. Time elapsed: ${roundNumber(
      elapsedSeconds / 60
    )} minutes. Time per request = ${
      elapsedSeconds / nCases
    } seconds. Total tokens used = ${tokens}. Total cost on GPT 4o mini: ${roundNumber(
      (tokens / 1000000) * 0.15
    )}$`
  );
};

export const removeDuplicatePublications = (publications) => {
  // Remove duplicates based on pmid
  const uniquePubSet = publications.reduce((prev, cur) => {
    const curPmid = cur?.pmid;
    if (!curPmid) {
      throw new Error(`No pmid found in publication ${JSON.stringify(cur)}`);
    }
    if (prev[curPmid]) {
      prev[curPmid].sources = [
        ...new Set([...cur?.sources, ...prev[curPmid]?.sources]),
      ];
      return prev;
    }
    prev[curPmid] = _.cloneDeep(cur);
    return prev;
  }, {});
  return Object.values(uniquePubSet);
};

function findEarliestPublicationDate(publications) {
  if (!publications || !publications.length) {
    return null;
  }

  const earliestDate = publications
    .map((pub) => {
      const date = pub.publicationDate;

      // Handle YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return new Date(date);
      }

      // Handle YYYY-MM format
      if (/^\d{4}-\d{2}$/.test(date)) {
        return new Date(date + "-01");
      }

      // Handle YYYY format
      if (/^\d{4}$/.test(date)) {
        return new Date(date + "-01-01");
      }

      return null;
    })
    .filter((date) => date !== null) // Remove any invalid dates
    .reduce((earliest, current) => {
      return earliest === null || current < earliest ? current : earliest;
    }, null);

  // Format the date as YYYY-MM-DD
  if (earliestDate === null) {
    return null;
  }

  return earliestDate.toISOString().split("T")[0];
}

function isIgnoredUrl(url) {
  const onIgnoreList = ignoredSites.some((ignoredUrl) =>
    url.includes(ignoredUrl)
  );
  const isPdf = url.endsWith(".pdf");

  return onIgnoreList || isPdf;
}

export const uniqueDoisOnly = (results) => {
  const dois = results.reduce((acc, { dois }) => {
    return [...acc, ...dois?.slice(0, N_DOIS_PER_SOURCE)];
  }, []);
  return [...new Set(dois)];
};

export async function fetchAndExtractDOI(url) {
  try {
    if (isIgnoredUrl(url)) {
      console.log(`Ignoring ${url}`);
      return { url, dois: [] };
    }
    console.log(`Fetching ${url} in search of doi`);
    const urlMatches = url.match(doiRegex);
    if (urlMatches?.length > 0) {
      console.log(`Found doi in url: ${urlMatches} for url ${url}`);
      return { url, dois: urlMatches };
    }
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html",
        "Accept-Language": "en-US",
        "Cache-Control": "no-cache",
        Referer: "https://scholar.google.com/",
      },
    });
    const pageContent = response.data;

    const dois = pageContent.match(doiRegex);

    // console.log(`Found dois: ${dois} for url ${url}`);
    return { url, dois: dois || [] };
  } catch (error) {
    console.error(`Error fetching ${url}:`, error.message);
    return { url, dois: [], error: error.message };
  }
}

export const processFinalOutput = (output) => {
  const finalOutput = output.map(
    ({ trial, registration, results, error, truncated }) => {
      if (!results) {
        results = [];
      }
      const totalTokens = results.reduce(
        (acc, res) => acc + (res?.tokens || 0),
        0
      );
      const toolResults = results.some((res) => res?.gptRes?.hasResults);
      const hasError = !!error;
      const toolPromptedPmids = results.map((res) => res?.pmid).join(",");

      // Determine the unique identification steps from the tool results
      const toolIdentStepsSet = new Set();
      results?.forEach((res) => {
        if (res?.gptRes?.hasResults) {
          res.sources.forEach((source) => {
            toolIdentStepsSet.add(source);
          });
        }
      });

      const toolIdentSteps = [...toolIdentStepsSet].join(",");
      const toolResultPmids = results
        .filter((res) => res?.gptRes?.hasResults)
        .map((res) => res.pmid)
        .join(",");
      const toolSuccess = results.every((res) => res.success);

      return {
        nct_id: registration.nctId,
        tool_tokens: totalTokens,
        tool_results: toolResults,
        has_error: hasError,
        tool_prompted_pmids: toolPromptedPmids,
        tool_result_pmids: toolResultPmids,
        tool_success: toolSuccess,
        tool_ident_steps: toolIdentSteps,
        tool_truncated: truncated,
      };
    }
  );

  return finalOutput;
};
