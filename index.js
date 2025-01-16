#!/usr/bin/env node
import figlet from "figlet";
import inquirer from "inquirer";
import gradient from "gradient-string";
import { program } from "commander";
import fs from "fs";
import net from "net";
import { createSpinner } from "nanospinner";
import { getEnvVariable, setEnvVariable } from "./set-env.js";
import { codeToLog as serverCode } from "./server-codes.js";

const CONFIG = {
  SERVER_HOST: "localhost",
  SERVER_PORT: 1337,
  TOKEN_ENV_NAME: "TOKEN_PALM_PORTAL",
};

async function findZipFiles() {
  return fs.readdirSync(process.cwd()).filter((file) => file.endsWith(".zip"));
}

async function promptFileSelection(files) {
  const answer = await inquirer.prompt([
    {
      type: "list",
      name: "fileName",
      message: "Select the file you want to deploy",
      choices: files,
    },
  ]);
  return answer.fileName;
}

async function determineFileName() {
  const fileName = program.args[0];
  if (fileName) return fileName;

  const filesInDir = await findZipFiles();
  if (filesInDir.length === 0) {
    console.error("No .zip files found in the current directory");
    process.exit(1);
  }

  return filesInDir.length === 1
    ? filesInDir[0]
    : await promptFileSelection(filesInDir);
}

function validateAuthentication() {
  program.option("--a, --auth <char>");
  program.parse();

  const { auth } = program.opts();
  const existentToken = getEnvVariable(CONFIG.TOKEN_ENV_NAME);

  if (!auth && !existentToken) {
    throw new Error(
      "You need authenticate to deploy, use --auth <token> (or --a <token>)"
    );
  }

  if (auth) setEnvVariable(CONFIG.TOKEN_ENV_NAME, auth);
  return existentToken;
}

function displayBanner() {
  return new Promise((resolve, reject) => {
    figlet("Palm-Portal", (err, data) => {
      if (err) {
        console.error("Something went wrong...");
        console.dir(err);
        reject(err);
      }
      console.log(gradient.pastel.multiline(data));
      resolve();
    });
  });
}

function createUploadSpinner() {
  return createSpinner("Trying to deploy").start();
}

function updateUploadProgress(spinner, fileName, startTime, bytesRead) {
  const totalSize = fs.statSync(fileName).size;
  const time = ((Date.now() - startTime) / 1000).toFixed(2);
  const uploadedMB = (bytesRead / (1024 * 1024)).toFixed(2);
  const totalMB = (totalSize / (1024 * 1024)).toFixed(2);

  spinner.update(
    `Uploading file: ${uploadedMB} MB of ${totalMB} MB in ${time} seconds`
  );
}

function handleSocketConnection(socket, fileName) {
  let startTime = Date.now();
  let reader = fs.createReadStream(fileName);
  let isAuthError, isAuthSuccess, isDeployCompleted; // one state each time, it will be replaced [1]
  let spinner;

  const token = getEnvVariable(CONFIG.TOKEN_ENV_NAME);
  socket.on("error", (e) => {
    console.error(gradient.passion("Error connecting to the server"));
  });
  socket.on("data", (msg) => {
    ({ isAuthError, isAuthSuccess, isDeployCompleted } = serverCode(
      msg.toString() // [1] here
    ));
  });

  socket.on("end", () => {
    if (isDeployCompleted) {
      return spinner.success(
        gradient.cristal("Deployment completed successfully!")
      );
    }
    spinner.error(gradient.passion("Server terminated your connection"));
    process.exit(1);
  });

  socket.write(token);
  console.warn(gradient.fruit("Validating token"));
  spinner = createUploadSpinner();

  const authCheckInterval = setInterval(() => {
    if (isAuthError) {
      spinner.error(gradient.passion("Incorrect token provided"));
      process.exit(1);
    }
    if (isAuthSuccess) {
      clearInterval(authCheckInterval);

      reader.on("readable", function () {
        let data;
        while ((data = this.read())) {
          socket.write(data);
          updateUploadProgress(spinner, fileName, startTime, reader.bytesRead);
        }
      });
    }
  }, 1000);

  reader.on("end", () => {
    socket.write("can-deploy");
  });
}

function deployFile(fileName) {
  const socket = new net.Socket();

  socket.connect(CONFIG.SERVER_PORT, CONFIG.SERVER_HOST, () => {
    handleSocketConnection(socket, fileName);
  });

  socket.on("error", (err) => {
    console.error(
      gradient.fruit(
        `Failed to connect to ${CONFIG.SERVER_HOST}:${CONFIG.SERVER_PORT}`
      )
    );
    console.error(gradient.passion(err.message));
    process.exit(1);
  });
}

async function main() {
  try {
    validateAuthentication();
    await displayBanner();
    const fileName = await determineFileName();
    deployFile(fileName);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

main();
