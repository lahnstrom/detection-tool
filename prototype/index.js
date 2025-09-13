import "dotenv/config";
import Koa from "koa";
import Router from "koa-router";
import cors from "@koa/cors";
import { registrationDiscovery } from "./src/live_processing/registration_discovery.js";
import { publicationDiscovery } from "./src/live_processing/publication_discovery.js";
import { resultsDiscovery } from "./src/live_processing/results_discovery.js";

const app = new Koa();
const router = new Router();

// Enable CORS for all origins
app.use(cors());

// Request duration logging middleware
app.use(async (ctx, next) => {
  const start = Date.now();
  const startTime = new Date().toISOString();
  console.log(`[${startTime}] ${ctx.method} ${ctx.url} - START`);

  await next();

  const end = Date.now();
  const endTime = new Date().toISOString();
  const duration = end - start;
  console.log(
    `[${endTime}] ${ctx.method} ${ctx.url} - ${ctx.status} - ${duration}ms - END`
  );
});

// Endpoint to fetch trial data by nctId
router.get("/api/trials/:nctId", async (ctx) => {
  try {
    const { nctId } = ctx.params;

    if (!nctId) {
      ctx.status = 400;
      ctx.body = { error: "Trial ID is required" };
      return;
    }

    const trial = await registrationDiscovery(nctId);

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

router.get("/api/publications/:nctId", async (ctx) => {
  try {
    const { nctId } = ctx.params;

    if (!nctId) {
      ctx.status = 400;
      ctx.body = { error: "Trial ID is required" };
      return;
    }

    const [pubs, errors] = await publicationDiscovery(nctId);

    if (pubs) {
      ctx.body = { pubs, errors };
    } else {
      ctx.status = 404;
      ctx.body = { error: "Publications not found" };
    }
  } catch (error) {
    console.error("Error retrieving trial publications:", error);
    ctx.status = 500;
    ctx.body = {
      error: "Failed to retrieve publications for trial ID: " + nctId,
    };
  }
});

router.get("/api/results/:nctId/:pmid", async (ctx) => {
  const { nctId, pmid } = ctx.params;
  try {
    if (!nctId) {
      ctx.status = 400;
      ctx.body = { error: "Trial ID is required" };
      return;
    }

    if (!pmid) {
      ctx.status = 400;
      ctx.body = { error: "PMID is required" };
      return;
    }

    const discoveredResults = await resultsDiscovery(nctId, pmid);

    ctx.body = discoveredResults;
  } catch (error) {
    console.error("Error searching for results publications:", error);
    ctx.status = 500;
    ctx.body = {
      error: `Failed to retrieve results for publication: ${pmid} and trial ${nctId}`,
    };
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
