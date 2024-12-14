import fs from "fs";
import path from "path";
import crypto from "crypto";

function calculateMd5(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("md5");
    const stream = fs.createReadStream(filePath);

    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", (err) => reject(err));
  });
}

export async function compareMd5Checksums(directory) {
  try {
    const files = fs.readdirSync(directory);

    // Filter for .xml.gz files, ignoring hidden files
    const xmlGzFiles = files.filter(
      (file) => file.endsWith(".xml.gz") && !file.startsWith(".")
    );

    for (const file of xmlGzFiles) {
      const xmlGzPath = path.join(directory, file);
      const md5FilePath = `${xmlGzPath}.md5`;

      // Check if corresponding .md5 file exists
      if (!fs.existsSync(md5FilePath)) {
        console.warn(`MD5 file missing for: ${file}`);
        continue;
      }

      // Read and parse the .md5 file content
      const md5FileContent = fs.readFileSync(md5FilePath, "utf-8").trim();
      const match = md5FileContent.match(/MD5\(.+\)=\s+([a-fA-F0-9]{32})/);

      if (!match) {
        console.error(`Invalid MD5 file format for: ${md5FilePath}`);
        continue;
      }

      const expectedMd5 = match[1];

      // Calculate the MD5 checksum of the .xml.gz file
      const calculatedMd5 = await calculateMd5(xmlGzPath);

      // Compare checksums
      if (expectedMd5 === calculatedMd5) {
        console.log(`Checksum matches for: ${file}`);
      } else {
        console.error(`Checksum mismatch for: ${file}`);
        console.error(`Expected: ${expectedMd5}`);
        console.error(`Found: ${calculatedMd5}`);
      }
    }
  } catch (err) {
    console.error("Error while comparing checksums:", err);
  }
}
