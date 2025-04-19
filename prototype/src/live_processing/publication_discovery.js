import {
  fetchRegistrationLiveCache,
  writePublicationsLiveCache,
} from "../server_utils.js";
import { discoverPublications } from "../publication_discovery_live.js";
import { removeDuplicatePublications } from "../utils.js";
import { fetchPubmedRefs } from "../pubmed_utils.js";

export async function publicationDiscovery(nctId) {
  const registration = fetchRegistrationLiveCache(nctId);

  const { discoveredPublications, errors } = await discoverPublications(
    registration
  );

  const uniquePublications = removeDuplicatePublications(
    discoveredPublications
  );

  //   Extract the pmids
  const discoveredPmids = uniquePublications
    .map((pub) => pub.pmid)
    .filter(Boolean);

  // Fetch the abstracts from PubMed
  const pubsWithAbstracts = await fetchPubmedRefs(discoveredPmids);

  const pubsWithSource = addBackSource(
    pubsWithAbstracts,
    discoveredPublications
  );

  writePublicationsLiveCache(pubsWithSource);

  return [pubsWithSource, errors];
}

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
