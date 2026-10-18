package fr.petitejerusalem.wear;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Lecture du payload de la lecture du jour, comme le widget d'écran d'accueil :
 * compter les coches encore valables et remplir le gabarit de progression.
 *
 * The checks carry their expiry (`expiresAt`, the dawn after the day they
 * belong to, when the journey's day turns): past that instant, they no
 * longer count and the watch starts from zero without anything being sent
 * again. A numeric comparison, no calendar logic here (the device calendar
 * may be Hebrew, which would distort any native date formatting).
 */
public final class Daily {

    /** L'avancement du jour, tel qu'il s'affiche. */
    public static final class Progress {
        /** Faux tant que l'utilisateur n'a rien activé, ou n'est pas connecté. */
        public final boolean configured;
        public final int done;
        public final int total;
        /** Les coches valent-elles encore pour aujourd'hui ? */
        public final boolean fresh;

        Progress(boolean configured, int done, int total, boolean fresh) {
            this.configured = configured;
            this.done = done;
            this.total = total;
            this.fresh = fresh;
        }

        public boolean allDone() {
            return total > 0 && done == total;
        }

        /** 0..1, pour la barre et l'anneau. */
        public float ratio() {
            return total == 0 ? 0f : (float) done / (float) total;
        }
    }

    private Daily() {}

    public static Progress of(JSONObject payload, long now) {
        if (payload == null) return new Progress(false, 0, 0, false);
        boolean fresh = now < payload.optLong("expiresAt", 0);
        JSONArray items = payload.optJSONArray("items");
        int total = items == null ? 0 : items.length();
        int done = 0;
        for (int i = 0; fresh && items != null && i < items.length(); i++) {
            JSONObject item = items.optJSONObject(i);
            if (item != null && item.optBoolean("done")) done++;
        }
        return new Progress(payload.optBoolean("configured"), done, total, fresh);
    }

    /**
     * « 2 sur 3 lus aujourd'hui » : le gabarit arrive avec ses sentinelles
     * intactes, les deux nombres se comptant ici, seul endroit à savoir si les
     * coches valent encore.
     */
    public static String progressLine(JSONObject payload, Progress progress) {
        String template = PayloadStore.text(payload, "progressTemplate");
        if (template == null) return "";
        return template
            .replace("{done}", String.valueOf(progress.done))
            .replace("{total}", String.valueOf(progress.total));
    }

    /** Does a check still hold? False past the expiry, whatever the item says. */
    public static boolean isDone(JSONObject item, Progress progress) {
        return progress.fresh && item != null && item.optBoolean("done");
    }
}
