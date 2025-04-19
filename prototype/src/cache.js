import fs from "fs";

export const cacheResultToFile = async (func, cacheKey) => {
  const cacheFileName = `./cache/${cacheKey}.json`;

  if (fs.existsSync(cacheFileName)) {
    try {
      const cachedData = await fs.promises.readFile(cacheFileName, "utf8");
      console.log("Read cached data from:", cacheFileName);
      return JSON.parse(cachedData);
    } catch (error) {
      console.error("Failed to read cache file:", error);
    }
  }

  const result = await func();

  try {
    fs.writeFileSync(cacheFileName, JSON.stringify(result), "utf8");
    console.log("Wrote cache data to:", cacheFileName);
  } catch (error) {
    console.error("Failed to write cache file:", error);
  }

  return result;
};
