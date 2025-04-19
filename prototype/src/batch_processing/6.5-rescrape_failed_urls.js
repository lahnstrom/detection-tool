import _ from "lodash";
import fs from "fs";
import config from "config";
import puppeteer from "puppeteer";
import { doiRegex } from "../utils.js";
import { PUB_SOURCE } from "../publication_discovery.js";
import { chromium } from "playwright";

const FILE_NAME = config.get("batch.fileName");
const INPUT_FILE = `./out/batch/publication_data/${FILE_NAME}.json`;
const OUTPUT_FILE = `./out/batch/publication_data/${FILE_NAME}.json`;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const rescrapeFailedPlaywright = async (failedUrls) => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Set extra HTTP headers
  await context.setExtraHTTPHeaders({
    accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "accept-language": "en-US,en;q=0.9",
    "cache-control": "max-age=0",
    cookie:
      "prov=4568ad3a-2c02-1686-b062-b26204fd5a6a; usr=p=%5b10%7c15%5d%5b160%7c%3bNewest%3b%5d",
    referer: "https://scholar.google.com/",
    "sec-ch-ua":
      '"Not.A/Brand";v="8", "Chromium";v="114", "Google Chrome";v="114"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "cross-site",
    "sec-fetch-user": "?1",
    "upgrade-insecure-requests": "1",
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
  });

  const dois = [];

  for (const { url } of failedUrls) {
    try {
      // Navigate to the URL and wait until DOM content is loaded
      await page.goto(url, { waitUntil: "domcontentloaded" });

      // Extract the page's inner HTML
      const html = await page.evaluate(() => document.body.innerHTML);

      // Match DOIs from the page content
      const matches = html.match(doiRegex);
      const uniqueDois = matches ? [...new Set(matches)] : [];
      dois.push(uniqueDois);

      console.log(`Scraped ${uniqueDois.length} DOIs from ${url}`);
      console.log(uniqueDois);
    } catch (e) {
      console.error(`Failed to scrape ${url}`, e);
    }
  }

  // Close the browser
  await browser.close();

  return dois.flat();
};

const rescrapeFailed = async (failedUrls) => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.setExtraHTTPHeaders({
    accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "accept-language": "en-US,en;q=0.9",
    "cache-control": "max-age=0",
    cookie:
      "prov=4568ad3a-2c02-1686-b062-b26204fd5a6a; usr=p=%5b10%7c15%5d%5b160%7c%3bNewest%3b%5d",
    referer: "https://scholar.google.com/",
    "sec-ch-ua":
      '"Not.A/Brand";v="8", "Chromium";v="114", "Google Chrome";v="114"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "cross-site",
    "sec-fetch-user": "?1",
    "upgrade-insecure-requests": "1",
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
  });

  const dois = [];

  for (const { url } of failedUrls) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      const html = await page.evaluate(() => document.body.innerHTML);
      const matches = html.match(doiRegex);
      const uniqueDois = matches ? [...new Set(matches)] : [];
      dois.push(uniqueDois);

      console.log(`Scraped ${uniqueDois.length} DOIs from ${url}`);
      console.log(uniqueDois);
    } catch (e) {
      console.log(e);
      console.log("Failed to scrape ", url);
    }
  }

  await browser.close();

  return dois.flat();
};

(async () => {
  const pairs = JSON.parse(fs.readFileSync(INPUT_FILE).toString());

  const results = [];

  for (const { pubs, failedUrls, ...rest } of pairs) {
    if (!failedUrls || !failedUrls.length) {
      results.push({ pubs, failedUrls, ...rest });
      continue;
    }


    
    const newDois = await rescrapeFailedPlaywright(failedUrls);

    const newPubs = newDois.map((doi) => {
      return { doi, sources: [PUB_SOURCE.GOOGLE_SCHOLAR_RESCRAPE] };
    });

    results.push({
      pubs: [...pubs, ...newPubs],
      failedUrls,
      ...rest,
    });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results));
})();
