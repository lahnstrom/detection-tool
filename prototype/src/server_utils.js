import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
export const fetchRegistrationLiveCache = (nctId) => {
  try {
    const path = `./request_cache/registrations/${nctId}.json`;
    const file = readFileSync(path);
    return JSON.parse(file);
  } catch (err) {
    console.error("Failed to fetch registration from cache");
    console.error(err);
    return null;
  }
};

export const writeRegistrationLiveCache = (nctId, registration) => {
  try {
    const path = `./request_cache/registrations/${nctId}.json`;
    writeFileSync(path, JSON.stringify(registration));
    return true;
  } catch (err) {
    console.error("Failed to write registration to cache");
    console.error(err);
    return false;
  }
};

export const writePublicationsLiveCache = (publications) => {
  const statuses = publications.map((pub) => {
    try {
      const path = `./request_cache/publications/${pub.pmid}.json`;
      writeFileSync(path, JSON.stringify(pub));
      return true;
    } catch (err) {
      console.error("Failed to write publication to cache");
      console.error(err);
      return false;
    }
  });

  return statuses.every(Boolean);
};

export const fetchPublicationLiveCache = (pmid) => {
  try {
    const path = `./request_cache/publications/${pmid}.json`;
    const file = readFileSync(path);
    return JSON.parse(file);
  } catch (err) {
    console.error("Failed to read publication from cache");
    console.error(err);
    return null;
  }
};

export const fetchResultsLiveCache = (nctId, pmid) => {
  try {
    const path = `./request_cache/results/${nctId}/${pmid}.json`;
    const file = readFileSync(path);
    return JSON.parse(file);
  } catch (err) {
    console.log("Failed to read results from cache");
    return null;
  }
};

export const writeResultsLiveCache = (nctId, pmid, results) => {
  try {
    if (!existsSync(`./request_cache/results/${nctId}`)) {
      mkdirSync(`./request_cache/results/${nctId}`);
    }
    const path = `./request_cache/results/${nctId}/${pmid}.json`;
    writeFileSync(path, JSON.stringify(results));
    return true;
  } catch (err) {
    console.error("Failed to write results to cache");
    console.error(err);
    return false;
  }
};
