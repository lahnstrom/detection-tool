import "dotenv/config";
import Koa from "koa";
import Router from "koa-router";
import cors from "@koa/cors";
import { registrationDiscovery } from "./src/live_processing/registration_discovery.js";
import { publicationDiscovery } from "./src/live_processing/publication_discovery.js";
import { resultsDiscovery } from "./src/live_processing/results_discovery.js";
import serve from "koa-static";
import path from "path";
import send from "koa-send";
import { fileURLToPath } from "url";
console.log("Loaded API key:", process.env.OPENAI_API_KEY);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// To avoid rate limit on chatgpt
const LIMIT_PUBS = 15;

const app = new Koa();
const router = new Router();

// Enable CORS for all origins
app.use(cors());

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

// Serve static files from the build folder
app.use(serve(path.join(__dirname, "build")));

// Fallback for React Router
app.use(async (ctx) => {
  await send(ctx, "index.html", { root: path.join(__dirname, "build") });
});
// Start the Koa server
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
