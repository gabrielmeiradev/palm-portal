import fs from "fs";
import path from "path";
import os from "os";

// Get the default cache path based on the operating system
function getCachePath(fileName) {
  const cacheDir = path.join(os.homedir(), ".cache"); // Default cache directory in home directory
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir); // Create the directory if it doesn't exist
  }
  return path.join(cacheDir, fileName);
}

// Set file with content in the cache directory
export function setEnvVariable(fileName, content) {
  const filePath = getCachePath(fileName);
  fs.writeFileSync(filePath, content, "utf8");
  console.log(`File saved at ${filePath}`);
}

// Get content of the file from cache
export function getEnvVariable(fileName) {
  const filePath = getCachePath(fileName);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, "utf8");
  } else {
    return null;
  }
}
