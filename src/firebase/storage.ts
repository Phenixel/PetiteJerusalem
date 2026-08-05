// Storage (upload des audios du studio auteurs / de l'admin). La lecture des
// audios publics passe par des URLs permanentes et ne dépend pas de cet objet.
// Module séparé du bundle initial : seuls le studio et l'admin l'importent.
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { app } from "./core";

export const storage = getStorage(app);

// Port de l'émulateur : voir la note dans ./core.ts (plage 8470-8477).
if (import.meta.env.DEV) {
  connectStorageEmulator(storage, "localhost", 8472);
}
