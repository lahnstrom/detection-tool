import { parsePubmedRecord } from "./pubmed_utils.js";
import convert from "xml-js";
import {
  fetchArticleByDoi,
  fetchArticlesByNctId,
  fetchArticleByPmid,
  fetchArticlesByJournalAbbreviation,
  getUniquePublicationTypes,
  upsertArticle,
} from "./sqlite_repo.js";
const PUBMED_API_KEY = process.env.PUBMED_API_KEY;

(async () => {
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=39043831&api_key=${PUBMED_API_KEY}`;

  const req = await fetch(url);
  const raw = await req.text();
  const jsObj = convert.xml2js(raw, { compact: true })?.PubmedArticleSet?.PubmedArticle;

  const article = parsePubmedRecord(jsObj);

  upsertArticle(article);

  const pmid = "39043831";

  const retrievedArticle = await fetchArticleByPmid(pmid);
  // const retrievedArticleDoi = await fetchArticleByDoi(article.doi);
  // const retrievedArticleNctId = await fetchArticlesByNctId(article.nctId);

  // const retrievedArticles = await fetchArticlesByJournalAbbreviation(
  //   "Eur Heart J"
  // );

  // const uniquePubTypes = await getUniquePublicationTypes();


})();
