export function codeToLog(code) {
  let isAuthError, isAuthSuccess, isDeployCompleted;
  switch (code) {
    case "incorrect-token":
      isAuthError = true;
      break;
    case "correct-token":
      isAuthSuccess = true;
      break;
    case "deploy-completed":
      isDeployCompleted = true;
      break;
  }

  return { isAuthError, isAuthSuccess, isDeployCompleted };
}
