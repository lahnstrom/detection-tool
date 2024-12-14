import Koa from "koa";
import Router from "koa-router";
import fs from "fs/promises";
import path from "path";
import {
  fetchRegistrationFs,
  hasSummaryResults,
  parseRegistration,
} from "./ctgov_utils.js";
import cors from "@koa/cors";
import { discoverPublications, PUB_SOURCE } from "./publication_discovery.js";
import { processFinalOutput, removeDuplicatePublications } from "./utils.js";
import {
  fetchAbstracts,
  mergePubsAbstracts,
  parsePubmedAbstractXML,
} from "./pubmed_utils.js";
import { detectResults } from "./results_detection.js";

// To avoid rate limit on chatgpt
const LIMIT_PUBS = 15;

const app = new Koa();
const router = new Router();

// Enable CORS for all origins
app.use(cors());

// Endpoint to fetch trial data by trialId
router.get("/api/trials/:trialId", async (ctx) => {
  try {
    // Read the JSON file from disk

    // Get the trialId from the route parameters
    const { trialId } = ctx.params;

    if (!trialId) {
      ctx.status = 400;
      ctx.body = { error: "Trial ID is required" };
      return;
    }

    let trial = {};
    const rawTrial = await fetchRegistrationFs(trialId);
    trial = parseRegistration(rawTrial);

    if (trial) {
      ctx.body = trial;
    } else {
      ctx.status = 404;
      ctx.body = { error: "Trial not found" };
    }
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: "Failed to read trial data" };
  }
});

router.get("/api/results/:trialId", async (ctx) => {
  const { trialId } = ctx.params;

  try {
    let registration = {};
    const rawRegistration = await fetchRegistrationFs(trialId);
    if (!rawRegistration) {
      ctx.status = 404;
      ctx.body = { error: "Trial not found" };
      return;
    }
    registration = parseRegistration(rawRegistration);

    const discoveredPublications = await discoverPublications(registration);
    const uniquePublications = removeDuplicatePublications(
      discoveredPublications
    );
    const truncatedPublications = uniquePublications.slice(0, LIMIT_PUBS);

    // Fetch abstracts and detect results
    const discoveredPmids = truncatedPublications.map((pub) => pub.pmid);
    const rawAbstracts = await fetchAbstracts(discoveredPmids);
    const abstracts = parsePubmedAbstractXML(rawAbstracts);
    const pubsWithAbstracts = mergePubsAbstracts(
      truncatedPublications,
      abstracts
    );

    const publicationResults = await detectResults(pubsWithAbstracts);

    ctx.body = {
      trialId,
      registration,
      results: publicationResults,
      truncated: uniquePublications.length > truncatedPublications.length,
    };
  } catch (error) {
    console.error("Error retrieving trial results:", error);
    ctx.status = 500;
    ctx.body = { error: "Failed to retrieve results for trial ID: " + trialId };
  }
});

// Use the router middleware
app.use(router.routes());
app.use(router.allowedMethods());

// Start the Koa server
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
