import sqlite3 from "sqlite3";
import path from "path";
import os from "os";

const dbPath = path.join("/", "Volumes", "T7", "database.db");
// const dbPath = path.join("./", "database.db");

const batchDb = new sqlite3.Database(dbPath);

export async function fetchArticleByPmid(pmid) {
  const db = new sqlite3.Database(dbPath);

  try {
    const result = await new Promise((resolve, reject) => {
      const query = `SELECT * FROM articles WHERE pmid = ?`;

      db.get(query, [pmid], (err, row) => {
        if (err) {
          console.error("Error fetching data:", err.message);
          reject(err);
        } else {
          if (row && row.raw) {
            try {
              row.raw = JSON.parse(row.raw);
            } catch (parseError) {
              console.error("Error parsing raw field:", parseError);
            }
          }
          resolve(row || null);
        }
      });
    });

    return result;
  } catch (error) {
    console.error("Error fetching article by pmid:", error);
    throw error;
  } finally {
    db.close();
  }
}

export async function fetchArticlesByNctId(nctId) {
  const db = new sqlite3.Database(dbPath);

  try {
    const result = await new Promise((resolve, reject) => {
      const query = `
        SELECT articles.*
        FROM articles
        JOIN nct_pmid ON articles.pmid = nct_pmid.pmid
        WHERE nct_pmid.nctId = ?
      `;

      db.all(query, [nctId], (err, rows) => {
        if (err) {
          console.error("Error fetching data:", err.message);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });

    return result;
  } catch (error) {
    console.error("Error fetching articles by nctId:", error);
    throw error;
  } finally {
    db.close();
  }
}

export async function fetchArticlesByPmids(pmids) {
  const db = new sqlite3.Database(dbPath);

  try {
    const results = await new Promise((resolve, reject) => {
      const placeholders = pmids.map(() => "?").join(",");
      const query = `SELECT * FROM articles WHERE pmid IN (${placeholders})`;

      db.all(query, pmids, (err, rows) => {
        if (err) {
          console.error("Error fetching data:", err.message);
          reject(err);
        } else {
          rows.forEach((row) => {
            if (row.raw) {
              try {
                row.raw = JSON.parse(row.raw);
              } catch (parseError) {
                console.error("Error parsing raw field:", parseError);
              }
            }
          });
          resolve(rows);
        }
      });
    });

    return results;
  } catch (error) {
    console.error("Error fetching articles by PMIDs:", error);
    throw error;
  } finally {
    db.close();
  }
}

export async function fetchArticleByDoi(doi) {
  const db = new sqlite3.Database(dbPath);

  try {
    const result = await new Promise((resolve, reject) => {
      const query = `SELECT * FROM articles WHERE doi = ?`;

      db.get(query, [doi], (err, row) => {
        if (err) {
          console.error("Error fetching data:", err.message);
          reject(err);
        } else {
          if (row && row.raw) {
            try {
              row.raw = JSON.parse(row.raw);
            } catch (parseError) {
              console.error("Error parsing raw field:", parseError);
            }
          }
          resolve(row || null);
        }
      });
    });

    return result;
  } catch (error) {
    console.error("Error fetching article by doi:", error);
    throw error;
  } finally {
    db.close();
  }
}

export async function fetchArticleByTitle(title) {
  const db = new sqlite3.Database(dbPath);

  try {
    const result = await new Promise((resolve, reject) => {
      const query = `SELECT * FROM articles WHERE title = ?`;

      db.get(query, [title], (err, row) => {
        if (err) {
          console.error("Error fetching data:", err.message);
          reject(err);
        } else {
          if (row && row.raw) {
            try {
              row.raw = JSON.parse(row.raw);
            } catch (parseError) {
              console.error("Error parsing raw field:", parseError);
            }
          }
          resolve(row || null);
        }
      });
    });

    return result;
  } catch (error) {
    console.error("Error fetching article by title:", error);
    throw error;
  } finally {
    db.close();
  }
}

export async function fetchArticlesByDois(dois) {
  const db = new sqlite3.Database(dbPath);

  try {
    const results = await new Promise((resolve, reject) => {
      const placeholders = dois.map(() => "?").join(",");
      const query = `SELECT * FROM articles WHERE doi IN (${placeholders})`;

      db.all(query, dois, (err, rows) => {
        if (err) {
          console.error("Error fetching data:", err.message);
          reject(err);
        } else {
          rows.forEach((row) => {
            if (row.raw) {
              try {
                row.raw = JSON.parse(row.raw);
              } catch (parseError) {
                console.error("Error parsing raw field:", parseError);
              }
            }
          });
          resolve(rows);
        }
      });
    });

    return results;
  } catch (error) {
    console.error("Error fetching articles by DOIs:", error);
    throw error;
  } finally {
    db.close();
  }
}

export function deleteAllArticles() {
  const db = new sqlite3.Database(dbPath);

  db.run(`DELETE FROM articles`, function (err) {
    if (err) {
      return console.error("Error deleting rows:", err.message);
    }
    console.log(`All rows have been deleted from the articles table.`);
  });

  db.close();
}

export function dropArticles() {
  const db = new sqlite3.Database(dbPath);

  db.run(`DROP TABLE articles`, function (err) {
    if (err) {
      return console.error("Error dropping table:", err.message);
    }
    console.log(`The articles table has been dropped.`);
  });

  db.close();
}
export function insertArticle({
  pmid,
  doi,
  abstract,
  publicationDate,
  authors,
  title,
  nctId,
  nctIds,
  raw,
}) {
  const db = new sqlite3.Database(dbPath);

  const query = `
    INSERT INTO articles (
      pmid, doi, abstract, publicationDate, authors, title, nctId, nctIds, raw
    ) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(
    query,
    [
      pmid,
      doi,
      abstract,
      publicationDate,
      authors,
      title,
      nctId,
      nctIds,
      JSON.stringify(raw),
    ],
    function (err) {
      if (err) {
        return console.error("Error inserting data:", err.message);
      }
      console.log(`A row has been inserted with rowid ${this.lastID}`);
    }
  );

  db.close();
}

export function upsertArticle(article, db) {
  let dbProvided = !!db;
  if (!dbProvided) {
    db = new sqlite3.Database(dbPath);
  }

  const {
    pmid,
    doi,
    abstract,
    publicationDate,
    authors,
    title,
    nctId,
    nctIds,
    raw,
  } = article;

  const query = `
    INSERT INTO articles (
      pmid, doi, abstract, publicationDate, authors, title, nctId, nctIds, raw
    ) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(pmid) DO UPDATE SET
      doi = excluded.doi,
      abstract = excluded.abstract,
      publicationDate = excluded.publicationDate,
      authors = excluded.authors,
      title = excluded.title,
      nctId = excluded.nctId,
      nctIds = excluded.nctIds,
      raw = excluded.raw
  `;

  db.run(
    query,
    [
      pmid,
      doi,
      abstract,
      publicationDate,
      authors,
      title,
      nctId,
      nctIds,
      JSON.stringify(raw),
    ],
    (err) => {
      if (err) {
        console.error("Error upserting article:", err);
      } else {
        console.log("Record upserted successfully");
      }
    }
  );

  if (!dbProvided) {
    db.close();
  }
}

export const upsertArticlesBatch = async (articles) => {
  return new Promise((resolve, reject) => {
    // Start a transaction for the batch
    batchDb.serialize(() => {
      batchDb.run("BEGIN TRANSACTION");

      // Prepare the statement once for reuse
      const stmt = batchDb.prepare(`
        INSERT INTO articles (
          pmid, doi, abstract, publicationDate, authors, title, nctId, nctIds, raw
        ) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(pmid) DO UPDATE SET
          doi = excluded.doi,
          abstract = excluded.abstract,
          publicationDate = excluded.publicationDate,
          authors = excluded.authors,
          title = excluded.title,
          nctId = excluded.nctId,
          nctIds = excluded.nctIds,
          raw = excluded.raw
      `);

      // Process each article in the batch
      for (const article of articles) {
        const {
          pmid,
          doi,
          abstract,
          publicationDate,
          authors,
          title,
          nctId,
          nctIds,
          raw,
        } = article;

        try {
          stmt.run(
            pmid,
            doi,
            abstract,
            publicationDate,
            authors,
            title,
            nctId,
            nctIds,
            JSON.stringify(raw)
          );
        } catch (err) {
          console.error(`Error processing article ${pmid}:`, err);
          // Continue processing other articles even if one fails
        }
      }

      // Finalize the prepared statement
      stmt.finalize();

      // Commit the transaction and handle any errors
      batchDb.run("COMMIT", (err) => {
        if (err) {
          console.error("Error committing transaction:", err);
          batchDb.run("ROLLBACK"); // Rollback on error
          reject(err);
        } else {
          console.log(
            `Successfully upserted batch of ${articles.length} articles`
          );
          resolve();
        }
      });
    });
  });
};

export function setupDatabase() {
  const db = new sqlite3.Database(dbPath);

  db.serialize(() => {
    db.run(
      `CREATE TABLE IF NOT EXISTS articles (
        pmid TEXT PRIMARY KEY, 
        doi TEXT, 
        abstract TEXT, 
        publicationDate TEXT, 
        authors TEXT, 
        title TEXT, 
        nctId TEXT, 
        nctIds TEXT, 
        raw JSON 
      );`
    );

    db.run("CREATE INDEX IF NOT EXISTS doi_index ON articles (doi);");

    db.run("CREATE INDEX IF NOT EXISTS nctId_index ON articles (nctId);");

    db.run("CREATE INDEX IF NOT EXISTS title_index ON articles (title);");

    db.run(
      `CREATE TABLE IF NOT EXISTS nct_pmid (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nctId TEXT NOT NULL,
        pmid TEXT NOT NULL
      );`
    );

    db.run("CREATE INDEX IF NOT EXISTS nctId_index ON nct_pmid (nctId);");

    console.log("Database and table created (if they didn't exist).");
  });

  db.close();
}

// Two example usages of JSON fields in SQLite
export async function fetchArticlesByJournalAbbreviation(abbreviation) {
  sqlite3.verbose();
  const db = new sqlite3.Database(dbPath);

  try {
    const results = await new Promise((resolve, reject) => {
      const query = `
        SELECT *
        FROM articles
        WHERE JSON_EXTRACT(raw, '$.PubmedArticle.MedlineCitation.Article.Journal.ISOAbbreviation._text') = ?`;

      db.all(query, [abbreviation], (err, rows) => {
        if (err) {
          console.error("Error fetching data:", err.message);
          reject(err);
        } else {
          rows.forEach((row) => {
            if (row.raw) {
              try {
                row.raw = JSON.parse(row.raw);
              } catch (parseError) {
                console.error("Error parsing raw field:", parseError);
              }
            }
          });
          resolve(rows || []);
        }
      });
    });

    return results;
  } catch (error) {
    console.error("Error fetching articles by journal abbreviation:", error);
    throw error;
  } finally {
    db.close();
  }
}

export async function getUniquePublicationTypes() {
  let sqlite = sqlite3.verbose();
  const db = new sqlite.Database(dbPath);

  try {
    const publicationTypes = await new Promise((resolve, reject) => {
      const query = `
        SELECT DISTINCT JSON_EXTRACT(raw, '$.PubmedArticle.MedlineCitation.Article.PublicationTypeList.PublicationType._text') AS publication_type
        FROM articles
        WHERE JSON_EXTRACT(raw, '$.PubmedArticle.MedlineCitation.Article.PublicationTypeList.PublicationType._text') IS NOT NULL;
      `;

      db.all(query, [], (err, rows) => {
        if (err) {
          console.error("Error fetching data:", err.message);
          reject(err);
        } else {
          resolve(rows.map((row) => row.publication_type));
        }
      });
    });

    return publicationTypes;
  } catch (error) {
    console.error("Error retrieving publication types:", error);
    throw error;
  } finally {
    db.close();
  }
}

export function writeToNctIdTable() {
  const db = new sqlite3.Database(dbPath);
  const processArticlesQuery = `
  SELECT pmid, nctIds FROM articles;
  `;

  db.each(
    processArticlesQuery,
    [],
    (err, row) => {
      if (err) {
        console.error("Error retrieving article:", err.message);
        return;
      }

      const pmid = row.pmid;
      const nctIds = row.nctIds ? row.nctIds.split("|") : [];

      if (nctIds.length) {
        console.log("stop");
      }
      const insertQuery = `
    INSERT INTO nct_pmid (nctId, pmid) VALUES (?, ?);
    `;

      nctIds.forEach((nctId) => {
        nctId = nctId.trim(); // Remove any extra whitespace
        if (nctId) {
          db.run(insertQuery, [nctId, pmid], (insertErr) => {
            if (insertErr) {
              console.error(
                `Error inserting nctId ${nctId} with pmid ${pmid}:`,
                insertErr.message
              );
            }
          });
        }
      });
    },
    (finalErr, count) => {
      if (finalErr) {
        console.error("Error during processing articles:", finalErr.message);
      } else {
        console.log(`Processing complete. Processed ${count} rows.`);
      }
    }
  );
}
