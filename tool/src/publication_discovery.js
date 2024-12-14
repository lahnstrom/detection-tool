import {
  fetchAndExtractDOI,
  fetchWithRetries,
  log,
  uniqueDoisOnly,
} from "./utils.js";
import ncbi from "node-ncbi";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import OpenAI from "openai";
import fs from "fs";
import axios from "axios";
import { cacheResultToFile } from "./cache.js";
import {
  fetchArticleByTitle,
  fetchArticlesByDois,
  fetchArticlesByNctId,
} from "./sqlite_repo.js";
import { DateTime } from "luxon";
import { citationMatch } from "./pubmed_utils.js";
import Fuse from "fuse.js";

const fuseOptions = {
  keys: ["title"],
};

const SERPER_API_KEY = process.env.SERPER_API_KEY;

export const PubmedGptQueryOutput = z.object({
  search_string: z
    .string()
    .describe(
      "Your generated search string. This is the string that we will use to search for publications in PubMed relating to the trial registration."
    ),
});

const systemPromptPubmedSearchGeneration = fs
  .readFileSync("./prompts/systemPromptPubmedSearchGeneration.txt")
  .toString();

const NAIVE_SEARCH_LIMIT = 5;
const ENHANCED_SEARCH_LIMIT = 5;

export const PUB_SOURCE = {
  PUBMED_NAIVE: "pubmed_naive",
  LINKED_AT_REGISTRATION: "linked_at_registration",
  GOOGLE_SCHOLAR: "google_scholar",
  GOOGLE_SCHOLAR_RESCRAPE: "google_scholar_rescrape",
  PUBMED_ENHANCED: "pubmed_enhanced",
  PUBMED_RELATED_LINKED: "pubmed_related_linked",
  ALREADY_IDENTIFIED: "already_identified",
  SUMMARY_RESULTS: "summary_results",
  NCT_MATCH: "nct_match",
};

// Returns a list of publications PMIDs relating to a registration and the source from which they were discovered
export const discoverPublications = async (registration) => {
  const searchFunctions = [
    searchLinkedAtRegistrationCached,
    searchPubmedNaiveCached,
    searchPubmedGptQueryBatchCached,
    searchGoogleScholarNoScrapeCached,
    searchNctMatch,
  ];

  //   Return a list of async wrapper functions that will call the search functions
  const searchFunctionsWithWrappers = searchFunctions.map((fn) => {
    return async (registration) => {
      try {
        const { results, error } = await fn(registration);
        return { results, fn: fn.name, error };
      } catch (error) {
        return { results: [], fn: fn.name, error: error.message };
      }
    };
  });

  const searchResults = await Promise.all(
    searchFunctionsWithWrappers.map((fn) => fn(registration))
  );

  const discoveredPublications = searchResults.map((s) => s.results).flat();
  const errors = searchResults.filter((s) => s.error).flat();
  return { discoveredPublications, errors };
};

const searchLinkedAtRegistration = async (registration) => {
  if (!registration) {
    throw new Error(`searchLinkedAtRegistration failed, null registration`);
  }

  log(`Finding linked publications for ${registration.nctId}`);

  let hits = [];
  // Are there any linked publications?
  if (registration?.references?.length > 0) {
    log(
      `found ${registration?.references?.length} references in clinicaltrials.gov`
    );
    hits = registration?.references
      ?.filter((ref) => !!ref?.pmid)
      .map((ref) => {
        return {
          pmid: ref?.pmid,
          sources: [PUB_SOURCE.LINKED_AT_REGISTRATION],
        };
      });
    if (hits?.length !== registration?.references?.length) {
      log(
        `Used ${hits?.length} of linked references for registration ${registration?.nctId} (missing pmid)`
      );
    }
  }

  return { results: hits };
};

const searchPubmedNaive = async (registration) => {
  if (!registration) {
    throw new Error(`searchPubmedNaive failed, null registration`);
  }

  log(`Attempting naive search of pubmed for ${registration.nctId}`);

  const formattedStartDate = DateTime.fromISO(registration.startDate).toFormat(
    "yyyy/MM/dd"
  );

  const query = `(
    ${
      registration.investigatorFullName
        ? `(${registration.investigatorFullName}[au]) OR `
        : ""
    } 
    (${registration.nctId}[tiab]) ) OR 
    (${registration.briefTitle}[tiab]) OR
    (${registration.nctId}[si]})
    )
    AND 
    ("${
      formattedStartDate || "1970"
    }"[Date - Publication] : "3000"[Date - Publication])`;

  // Remove extra spaces
  const cleanedQuery = query.replace(/\s+/g, " ");
  const pubmedSearch = ncbi.pubmed;
  const pubmedRes = await pubmedSearch.search(
    cleanedQuery,
    undefined,
    NAIVE_SEARCH_LIMIT
  );
  const pmids = pubmedRes?.papers?.map((paper) => paper.pmid + "");

  return {
    results: pmids.map((pmid) => {
      return {
        pmid,
        sources: [PUB_SOURCE.PUBMED_NAIVE],
      };
    }),
  };
};

const serperSearch = async (nctid) => {
  try {
    const config = {
      method: "post",
      maxBodyLength: Infinity,
      url: "https://google.serper.dev/scholar",
      timeout: 10000,
      headers: {
        "X-API-KEY": SERPER_API_KEY,
        "Content-Type": "application/json",
      },

      data: JSON.stringify({
        q: nctid,
        autocorrect: false,
      }),
    };
    const response = await axios.request(config);
    return response.data;
  } catch (error) {
    console.error(`Failed to search Serper: ${error}`);
    return [];
  }
};

const parseSerperResponse = (response) => {
  return response?.organic?.map((item) => item.link)?.filter(Boolean) || [];
};

const parseSerperTitle = (response) => {
  return response?.organic?.map((item) => item.title)?.filter(Boolean) || [];
};

const searchGoogleScholar = async (registration) => {
  try {
    log(`Attempting google scholar search for ${registration.nctId}`);

    const response = await cacheResultToFile(
      () => serperSearch(registration.nctId),
      `serper-${registration?.nctId}`
    );

    // For debug purposes
    fs.writeFileSync(
      `./out/serper/${registration?.nctId}.json`,
      JSON.stringify(response)
    );

    const urls = parseSerperResponse(response);
    const promises = urls.map(fetchAndExtractDOI);
    const scrapedUrls = await Promise.all(promises);

    const failedUrls = scrapedUrls.filter((res) => res.error);
    const uniqueDois = uniqueDoisOnly(scrapedUrls);
    // For debug purposes
    fs.writeFileSync(
      `./out/doiurls/${registration?.nctId}.json`,
      JSON.stringify(urls)
    );

    return {
      results: uniqueDois
        .map((doi) => {
          return {
            sources: [PUB_SOURCE.GOOGLE_SCHOLAR],
            doi,
          };
        })
        .filter(Boolean),
      failedUrls,
    };
  } catch (error) {
    console.error(`Failed to search Google Scholar: ${error}`);
    return { results: [], error };
  }
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const findWithTitle = async (title, delaySeconds) => {
  try {
    console.log("Searching for article with title ", title);
    const dbHit = await fetchArticleByTitle(title);
    if (dbHit) {
      console.log("Found article in database with title ", title);
      return [
        {
          pmid: dbHit.pmid + "",
          sources: [PUB_SOURCE.GOOGLE_SCHOLAR],
        },
      ];
    }
    // Avoid rate limits
    if (delaySeconds > 0) {
      console.log("Delaying search for ", delaySeconds, " seconds");
      await delay(delaySeconds * 1000);
    }

    const citationPmids = await citationMatch(title);
    if (citationPmids && citationPmids.length > 0) {
      console.log("Found article in citation match with title ", title);
      return citationPmids.map((pmid) => {
        return {
          pmid: pmid + "",
          sources: [PUB_SOURCE.GOOGLE_SCHOLAR],
        };
      });
    }

    const searchHits = await ncbi.pubmed.search(title, undefined, 100);
    if (searchHits?.papers && searchHits?.papers.length > 0) {
      const papers = searchHits.papers;

      // Fuzzy search of pubmed results
      const fuse = new Fuse(papers, fuseOptions);
      const results = fuse.search(title);
      const bestMatch = results[0]?.item;

      console.log("Found article in pubmed with title ", title);
      if (bestMatch) {
        return [
          {
            pmid: bestMatch.pmid + "",
            sources: [PUB_SOURCE.GOOGLE_SCHOLAR],
          },
        ];
      }
    }
    console.log("No article found with title ", title);
    return null;
  } catch (error) {
    console.error(`Failed to search for article with title ${title}:`);
    console.error(error);
    return null;
  }
};

const searchGoogleScholarNoScrape = async (registration) => {
  try {
    log(`Attempting google scholar search for ${registration.nctId}`);

    const response = await cacheResultToFile(
      () => serperSearch(registration.nctId),
      `serper-${registration?.nctId}`
    );

    const titles = parseSerperTitle(response);

    if (titles.length === 0) {
      return { results: [] };
    }

    // Delay 1 second for every 3 titles
    const promises = titles.map((title, i) =>
      findWithTitle(title, Math.floor(i / 3))
    );

    const pubs = await Promise.all(promises);

    const results = pubs.filter(Boolean).flat();

    return {
      results: results,
    };
  } catch (error) {
    console.error(error);
    console.error(`Failed to search Google Scholar: ${error}`);
    return { results: [] };
  }
};

const searchPubmedGptQuery = async (registration) => {
  log(`Attempting GPT-4o-mini query generation for ${registration.nctId}`);
  const openai = new OpenAI();

  // Do not want GPT getting confused here
  const filteredRegistration = { ...registration };
  delete filteredRegistration.hasResults;
  delete filteredRegistration.publicationPmid;

  fs.writeFileSync(
    `./out/prompts-pubmed/${registration?.nctId}.json`,
    JSON.stringify(filteredRegistration)
  );

  const res = await openai.beta.chat.completions.parse({
    model: "gpt-4o-mini",
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
  });

  if (res.choices[0].finish_reason !== "stop") {
    log(
      `GPT-4o-mini failed to generate a search string for ${registration?.nctId}`
    );
    return { results: [] };
  }

  log(`GPT-4o-mini generated pubmed search string for ${registration?.nctId}`);
  fs.writeFileSync(
    `./out/gpt-res-pubmed/${registration?.nctId}.json`,
    JSON.stringify(res)
  );

  const tokens = res?.usage?.total_tokens || 0;
  global.pubmedTokens += tokens;

  const searchString = res?.choices?.[0]?.message?.parsed?.search_string;
  const pubmedSearch = ncbi.pubmed;
  const pubmedRes = await pubmedSearch.search(
    searchString,
    undefined,
    ENHANCED_SEARCH_LIMIT
  );
  const pmids = pubmedRes?.papers?.map((paper) => paper.pmid + "");

  return {
    results: pmids.map((pmid) => {
      return {
        pmid,
        sources: [PUB_SOURCE.PUBMED_ENHANCED],
      };
    }),
  };
};

const searchPubmedGptQueryBatch = async (registration) => {
  console.log("Retrieving batch job gpt query");
  // Retrieve result of batch job in some way
  const raw = fs
    .readFileSync(`./batch_results/queries/${registration?.nctId}.json`)
    .toString();

  const res = JSON.parse(raw);

  const searchString = res?.search_string;
  const pubmedSearch = ncbi.pubmed;
  const pubmedRes = await pubmedSearch.search(
    searchString,
    undefined,
    ENHANCED_SEARCH_LIMIT
  );

  const pmids = pubmedRes?.papers?.map((paper) => paper.pmid + "");
  console.log("Received pmids from batch job query:", pmids);

  return {
    results: pmids.map((pmid) => {
      return {
        pmid,
        sources: [PUB_SOURCE.PUBMED_ENHANCED],
      };
    }),
  };
};

const searchNctMatch = async (registration) => {
  console.log(
    "Searching for articles matching nctId that contain single nctId"
  );
  const nctId = registration?.nctId;
  const articles = await fetchArticlesByNctId(nctId);
  console.log("Found articles:", articles);

  if (articles && articles.length > 0) {
    console.log("Found multiple articles with nctId:", nctId);

    const pmidSet = new Set();
    const uniqueArticles = articles.filter((article) => {
      if (pmidSet.has(article.pmid)) {
        return false;
      }
      pmidSet.add(article.pmid);
      return true;
    });

    return {
      results: uniqueArticles.map((article) => {
        return {
          pmid: article.pmid,
          sources: [PUB_SOURCE.NCT_MATCH],
        };
      }),
    };
  } else {
    return { results: [] };
  }
};

const searchPubmedGptQueryCached = async (registration) => {
  return await cacheResultToFile(
    () => searchPubmedGptQuery(registration),
    `gpt-pubmed-${registration?.nctId}`
  );
};

const searchPubmedGptQueryBatchCached = async (registration) => {
  return await cacheResultToFile(
    () => searchPubmedGptQueryBatch(registration),
    `gpt-pubmed-batch-${registration?.nctId}`
  );
};

const searchPubmedNaiveCached = async (registration) => {
  return await cacheResultToFile(
    () => searchPubmedNaive(registration),
    `pubmed-naive-${registration?.nctId}`
  );
};

const searchGoogleScholarCached = async (registration) => {
  return await cacheResultToFile(
    () => searchGoogleScholar(registration),
    `google-scholar-${registration?.nctId}`
  );
};

const searchGoogleScholarNoScrapeCached = async (registration) => {
  return await cacheResultToFile(
    () => searchGoogleScholarNoScrape(registration),
    `google-scholar-no-scrape-${registration?.nctId}`
  );
};

const searchLinkedAtRegistrationCached = async (registration) => {
  return await cacheResultToFile(
    () => searchLinkedAtRegistration(registration),
    `linked-at-registration-${registration?.nctId}`
  );
};
