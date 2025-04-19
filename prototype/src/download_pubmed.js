import fs from "fs";
import path from "path";
import convert from "xml-js";
import readline from "readline";
import {
  setupDatabase,
  upsertArticle,
  upsertArticlesBatch,
  writeToNctIdTable,
} from "./sqlite_repo.js";
import sqlite3 from "sqlite3";
import { parsePubmedRecord } from "./pubmed_utils.js";
import { compareMd5Checksums } from "./checksums.js";

const inputDir = path.join("/", "Volumes", "T7", "updatefiles");
const outputDb = path.join("/", "Volumes", "T7", "database.db");

const run = async () => {
  const files1 = fs
    .readdirSync(inputDir)
    .filter((file) => !file.startsWith(".") & file.endsWith(".xml"));

  const files = [...files1];

  const startFrom = 140;

  console.log(`Processing ${files.length - startFrom} files...`);

  for (let i = startFrom; i < files.length; i++) {
    const file = files[i];
    console.log(`Processing file no. ${i + 1}: ${file}`);

    try {
      await processFileBatch(file);

      const percentageDone = Math.round(((i + 1) / files.length) * 100);
      console.log(`Progress: ${percentageDone}%`);
    } catch (err) {
      console.error(`Error processing file ${file}:`, err);
    }
  }

  console.log("All files processed successfully.");
};

const processFileBatch = async (file) => {
  const filePath = path.join(inputDir, file);
  let xmlBuffer = "";
  let insidePubmedArticle = false;

  return new Promise((resolve, reject) => {
    const lineReader = readline.createInterface({
      input: fs.createReadStream(filePath),
      crlfDelay: Infinity,
    });

    let articleBuffer = [];

    lineReader.on("line", (line) => {
      try {
        if (line.includes("<PubmedArticle>")) {
          insidePubmedArticle = true;
          xmlBuffer = line;
        } else if (line.includes("</PubmedArticle>") && insidePubmedArticle) {
          insidePubmedArticle = false;
          xmlBuffer += line;

          const raw = convert.xml2js(xmlBuffer, { compact: true });
          const article = parsePubmedRecord(raw?.PubmedArticle, false);
          articleBuffer.push(article);
          xmlBuffer = "";
        } else if (insidePubmedArticle) {
          xmlBuffer += line;
        }
      } catch (err) {
        console.log("Error processing line:", err);
        lineReader.close();
        reject(err);
      }
    });

    lineReader.on("close", async () => {
      try {
        console.log(
          `Closing reader for file ${file}. Upserting ${articleBuffer?.length} articles...`
        );
        await upsertArticlesBatch(articleBuffer);
        articleBuffer = [];
        console.log(`File ${file} processed successfully.`);
        resolve();
      } catch (err) {
        reject(err);
      } finally {
      }
    });

    lineReader.on("error", (err) => {
      console.error("Error reading file:", err);

      reject(err);
    });
  });
};

const processFile = async (file) => {
  const db = new sqlite3.Database(outputDb);
  const filePath = path.join(inputDir, file);
  let xmlBuffer = "";
  let insidePubmedArticle = false;

  return new Promise((resolve, reject) => {
    const lineReader = readline.createInterface({
      input: fs.createReadStream(filePath),
      crlfDelay: Infinity,
    });

    lineReader.on("line", (line) => {
      try {
        if (line.includes("<PubmedArticle>")) {
          insidePubmedArticle = true;
          xmlBuffer = line;
        } else if (line.includes("</PubmedArticle>") && insidePubmedArticle) {
          insidePubmedArticle = false;
          xmlBuffer += line;

          const raw = convert.xml2js(xmlBuffer, { compact: true });
          const article = parsePubmedRecord(raw);

          try {
            upsertArticle(article, db);
          } catch (err) {
            console.error("Error upserting article:", err);
            // Continue processing even if one article fails
          }

          xmlBuffer = "";
        } else if (insidePubmedArticle) {
          xmlBuffer += line;
        }
      } catch (err) {
        lineReader.close();
        reject(err);
      }
    });

    lineReader.on("close", async () => {
      try {
        console.log(`File ${file} processed successfully.`);
        resolve();
      } catch (err) {
        reject(err);
      }
    });

    lineReader.on("error", (err) => {
      fs.writeFileSync(`./out/errors/error-file-${file}.txt`, err);
      console.error("Error reading file:", err);
      reject(err);
    });
  });
};
// deleteAllArticles()

(async () => {
  // compareMd5Checksums(inputDir);
  // compareMd5Checksums(inputDir2);
  // setupDatabase();
  // writeToNctIdTable();
  // await run();
})();
