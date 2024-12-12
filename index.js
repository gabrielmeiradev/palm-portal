#!/usr/bin/env node
import figlet from "figlet";
import inquirer from "inquirer";
import gradient from "gradient-string";
import { program } from "commander";
import fs from "fs";
import net from "net";
import { createSpinner } from "nanospinner";

// const SERVER_HOST = "45.175.210.184"
const SERVER_HOST = "localhost";
const SERVER_PORT = 1337;

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

const startProgram = () => {
  program.option("--a, --auth <char>");

  program.parse();

  // setup auth
  const options = program.opts();
  const { auth } = options;

  if (auth) {
    fs.writeFileSync(".auth.env", `AUTH_TOKEN=${auth}`);
    process.exit(0);
  }

  if (fs.existsSync(".auth.env")) {
    const envContent = fs.readFileSync(".auth.env", "utf-8");
    const authTokenMatch = envContent.match(/^AUTH_TOKEN=(.*)$/m);

    if (authTokenMatch) {
      return authTokenMatch[1].trim();
    } else {
      throw new Error("AUTH_TOKEN not found in .auth.env");
    }
  } else {
    throw new Error(
      "You need authenticate to deploy, use --auth <token> (or --a <token>)"
    );
  }
};

const setup = () => {
  let token;
  try {
    token = startProgram();
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

    deploy(fileName, token);
  });
};

const deploy = (fileName, token) => {
  let socket = new net.Socket();
  let startTime = Date.now();
  let reader = fs.createReadStream(fileName);
  let serverMessage;

  socket.connect(SERVER_PORT, SERVER_HOST, function () {
    let spinner = createSpinner("Uploading file").start();

    socket.write(token);

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

    reader.on("end", function () {
      if (serverMessage) {
        spinner.stop();
        return socket.end();
      }
      spinner.success("File uploaded successfully");
      socket.end();
    });
  });

  socket.on("data", function (data) {
    serverMessage = data.toString();
    console.error(`\n${serverMessage}`);
  });

  socket.on("error", function (err) {
    console.error(err.message);
  });
};

setup();
