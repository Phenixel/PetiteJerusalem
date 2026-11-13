import fr from "./fr";
import frAdmin from "./frAdmin";

/**
 * Every French message, the back office's included: what the tests check
 * (keys used, typography) and mount admin pages with. The app itself starts
 * with fr.ts and loads frAdmin.ts with the /admin route (src/i18n.ts).
 */
const frAll = { ...fr, admin: frAdmin };

export default frAll;
