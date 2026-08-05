// Cloud Functions (callables studio*). Module séparé du bundle initial :
// seul le studio auteurs l'importe.
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { app } from "./core";

export const functions = getFunctions(app);

// Port de l'émulateur : voir la note dans ./core.ts (plage 8470-8477).
if (import.meta.env.DEV) {
  connectFunctionsEmulator(functions, "localhost", 8477);
}
