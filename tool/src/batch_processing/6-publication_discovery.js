import _ from "lodash";
import { discoverPublications } from "../publication_discovery.js";
import {
  fetchPubmedRefs,
  maxDateFilter,
  minDateFilter,
} from "../pubmed_utils.js";
import { removeDuplicatePublications } from "../utils.js";
import fs from "fs";
import { fetchArticlesByDois, fetchArticlesByPmids } from "../sqlite_repo.js";
import config from "config";

const FILE_NAME = config.get("batch.fileName");
const INPUT_FILE = `./out/batch/prepared_data/${FILE_NAME}.json`;
const OUTPUT_FILE = `./out/batch/publication_data/${FILE_NAME}.json`;
const BATCH_LIMITS = config.get("batch.limits");
const IS_VALIDATION = config.get("batch.isValidation");

const limitPublications = (publications) => {
  const limits = _.cloneDeep(BATCH_LIMITS);

  const includedPublications = publications.filter((pub) => {
    const sources = pub.sources;

    let included = false;

    for (const source of sources) {
      if (limits[source] > 0) {
        included = true;
        limits[source]--;
        break;
      }
    }

    return included;
  });

  return includedPublications;
};

const discoverSingle = async ({ registration, validation }) => {
  const { discoveredPublications, errors } = await discoverPublications(
    registration
  );

  const uniquePublications = removeDuplicatePublications(
    discoveredPublications
  );

  const discoveredPmids = uniquePublications
    .map((pub) => pub.pmid)
    .filter(Boolean);

  const discoveredDois = uniquePublications
    .map((pub) => pub.doi)
    .filter(Boolean);

  const pubsWithAbstractsPmid = await fetchArticlesByPmids(discoveredPmids);
  const pubsWithAbstractsDoi = await fetchArticlesByDois(discoveredDois);

  if (
    discoveredPmids?.length + discoveredDois?.length <
    uniquePublications?.length
  ) {
    console.warn(
      "Probable faulty publication discovery. Each article should have a doi or pmid or both. "
    );
  }

  if (pubsWithAbstractsPmid?.length < discoveredPmids?.length) {
    console.warn(
      `Failed to find reference in database for ${
        discoveredPmids?.length - pubsWithAbstractsPmid?.length
      } PMIDs`
    );
  }

  const pubsWithAbstracts = pubsWithAbstractsPmid.concat(pubsWithAbstractsDoi);

  const pubsWithSource = addBackSource(
    pubsWithAbstracts,
    discoveredPublications
  );

  const truncatedPublications = limitPublications(pubsWithSource);
  const didTruncate = uniquePublications.length > truncatedPublications.length;

  // This line should be used for all trials
  const minDayFilteredPublications = minDateFilter(
    truncatedPublications,
    registration.startDate
  );

  let filteredPublications = minDayFilteredPublications;

  if (IS_VALIDATION) {
    filteredPublications = maxDateFilter(
      minDayFilteredPublications,
      validation?.dataset == "iv" ? "2020-11-17" : "2023-02-15"
    );
  }

  return [filteredPublications, didTruncate, errors];
};

const addBackSource = (pubs, pubsWithSource) => {
  return pubs.map((pub) => {
    const sourcesPmid = pubsWithSource
      .filter((p) => p.pmid === pub.pmid)
      .map((p) => p.sources)
      .flat();

    const sourcesDoi = pubsWithSource
      .filter((p) => p.doi === pub.doi)
      .map((p) => p.sources)
      .flat();

    const sources = [...new Set([...sourcesPmid, ...sourcesDoi])];

    return { ...pub, sources };
  });
};

(async () => {
  const pairs = JSON.parse(fs.readFileSync(INPUT_FILE).toString());

  // Check on NCT00874848
  const results = [];
  for (const pair of pairs) {
    const { registration, validation } = pair;
    try {
      const [pubs, didTruncate, errors] = await discoverSingle(pair);

      const result = {
        pubs,
        registration,
        validation,
        error: errors,
        truncated: didTruncate,
      };

      results.push(result);
    } catch (error) {
      console.log(error);
      results.push({
        pubs: null,
        registration,
        validation,
        error: [error],
        truncated: false,
      });
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results));
})();
