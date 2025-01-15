export function codeToLog(code) {
  let isError = false;
  let action;
  switch (code) {
    case "incorrect-token":
      action = console.error("Incorrect token provided");
      isError = true;
      break;
  }

  return { isError };
}
