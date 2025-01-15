#!/usr/bin/env node
import figlet from "figlet";
import inquirer from "inquirer";
import gradient from "gradient-string";
import { program } from "commander";
import fs from "fs";
import net from "net";
import { createSpinner } from "nanospinner";
import { getEnvVariable, setEnvVariable } from "./set-env.js";
import { codeToLog } from "./server-codes.js";
const SERVER_HOST = process.env.SERVER_HOST;
const SERVER_PORT = 1337;
const TOKEN_ENV_NAME = "TOKEN_PALM_PORTAL";

const getFileNameToDeploy = async () => {
  let fileName = program.args[0];

  if (!fileName) {
    const filesInDir = fs.readdirSync(process.cwd()).filter((file) => {
      return file.endsWith(".zip");
    });

    if (filesInDir.length === 0) {
      console.error("No .zip files found in the current directory");
      process.exit(1);
    }

    if (filesInDir.length === 1) {
      return filesInDir[0];
    }

    const answer = await inquirer.prompt([
      {
        type: "list",
        name: "fileName",
        message: "Select the file you want to deploy",
        choices: filesInDir,
      },
    ]);

    return answer.fileName;
  } else {
    return fileName;
  }
};

const setupProgram = () => {
  program.option("--a, --auth <char>");
  program.parse();
  // setup auth
  const options = program.opts();
  const { auth } = options;
  const existentToken = getEnvVariable(TOKEN_ENV_NAME);

  if (!auth && !existentToken) {
    throw new Error(
      "You need authenticate to deploy, use --auth <token> (or --a <token>)"
    );
  }
  if (auth) setEnvVariable(TOKEN_ENV_NAME, auth);

  return existentToken;
};

const setup = () => {
  let token;
  try {
    token = setupProgram();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  figlet("Palm-Portal", async function (err, data) {
    if (err) {
      console.log("Something went wrong...");
      console.dir(err);
      return;
    }
    console.log(gradient.pastel.multiline(data));

    const fileName = await getFileNameToDeploy();

    deploy(fileName);
  });
};

const deploy = (fileName) => {
  let socket = new net.Socket();
  let startTime = Date.now();
  let reader = fs.createReadStream(fileName);

  const token = getEnvVariable(TOKEN_ENV_NAME);

  socket.connect(SERVER_PORT, SERVER_HOST, function () {
    let isError, spinner;
    socket.on("data", function (msg) {
      ({ isError } = codeToLog(msg.toString()));
    });

    socket.write(token);
    console.warn("Validating token...");
    setTimeout(() => {
      spinner = createSpinner("Uploading file").start();
      reader.on("readable", function () {
        let data;
        while ((data = this.read())) {
          socket.write(data);
          const totalSize = fs.statSync(fileName).size;
          const time = ((Date.now() - startTime) / 1000).toFixed(2);
          spinner.update(
            `Uploading file: ${(reader.bytesRead / (1024 * 1024)).toFixed(
              2
            )} MB of ${(totalSize / (1024 * 1024)).toFixed(
              2
            )} MB in ${time} seconds`
          );
        }
      });
    }, 1000);

    reader.on("end", function () {
      if (isError) {
        spinner.error("File not uploaded");
        return socket.end();
      }

      spinner.success("File uploaded successfully");
      socket.end();
    });
  });

  socket.on("error", function (err) {
    console.error("Error connecting to the server");
  });
};
setup();
