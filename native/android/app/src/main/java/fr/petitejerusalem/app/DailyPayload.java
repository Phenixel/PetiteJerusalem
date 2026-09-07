package fr.petitejerusalem.app;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Le payload « daily » (contrat : src/services/widgetPayloads.ts), lu par le
 * widget « Lecture du jour » et par le raccourci « Avancement de la lecture ».
 *
 * Il porte son échéance (`expiresAt`, le minuit local qui suit) : passé cet
 * instant, les coches ne comptent plus et la progression repart de zéro sans
 * attendre que l'app soit rouverte. Simple comparaison d'epochs, aucune
 * logique de calendrier ici (le calendrier de l'appareil peut être hébraïque).
 *
 * Pendant Java des `Decodable` de native/ios/PjWidgets/PjWidgets.swift : les
 * deux plateformes doivent lire la même progression au même instant.
 */
final class DailyPayload {

    /** Ce que la ligne affiche, une fois les coches confrontées à l'échéance. */
    static final class State {
        final String line;
        final float ratio;
        /** Vrai quand tout est lu : la ligne passe au vert, comme dans l'app. */
        final boolean allDone;
        /** Faux quand il n'y a rien à mesurer (liste vide, payload absent). */
        final boolean measurable;

        State(String line, float ratio, boolean allDone, boolean measurable) {
            this.line = line;
            this.ratio = ratio;
            this.allDone = allDone;
            this.measurable = measurable;
        }

        static State message(String line) {
            return new State(line, 0f, false, false);
        }
    }

    final String title;
    final String emptyLabel;
    final String allDoneLabel;
    /** "{done} sur {total} lus aujourd'hui" ; absent des payloads d'avant. */
    final String progressTemplate;
    /** La paracha de la semaine (chnei mikra), ou null. */
    final String parasha;
    final boolean parashaDone;
    final boolean configured;
    /** Epoch ms du minuit local qui suit : au-delà, les coches ne comptent plus. */
    final long expiresAt;
    final String accent;
    /** Les coches de la lecture du jour, une par texte de la liste. */
    private final boolean[] done;

    /** Le payload rangé par le plugin, ou null s'il manque ou ne se lit pas. */
    static DailyPayload load(Context context) {
        String raw = PjWidgetsPlugin.store(context).getString(PjWidgetsPlugin.KEY_DAILY, null);
        if (raw == null) return null;
        try {
            return new DailyPayload(new JSONObject(raw));
        } catch (Exception e) {
            return null;
        }
    }

    private DailyPayload(JSONObject json) throws Exception {
        title = json.getString("title");
        emptyLabel = json.getString("emptyLabel");
        allDoneLabel = json.getString("allDoneLabel");
        progressTemplate = json.optString("progressTemplate", "{done}/{total}");
        parasha = Json.text(json, "parasha");
        parashaDone = json.optBoolean("parashaDone");
        configured = json.getBoolean("configured");
        expiresAt = json.optLong("expiresAt");
        accent = Json.text(json, "accent");
        JSONArray items = json.getJSONArray("items");
        done = new boolean[items.length()];
        for (int i = 0; i < items.length(); i++) {
            done[i] = items.getJSONObject(i).getBoolean("done");
        }
    }

    /** La progression telle qu'elle vaut à cet instant. */
    State state(long now) {
        if (!configured) return State.message(emptyLabel);

        // Chnei mikra seul : la paracha EST la lecture, son avancement fait la
        // progression, et il ne se remet pas à zéro chaque jour.
        if (done.length == 0) {
            if (parasha == null) return State.message(emptyLabel);
            return new State(parasha, parashaDone ? 1f : 0f, parashaDone, true);
        }

        // Les coches ne valent que jusqu'au minuit local du payload.
        boolean fresh = now < expiresAt;
        int read = 0;
        for (boolean item : done) {
            if (fresh && item) read++;
        }
        int total = done.length;
        if (read >= total) return new State(allDoneLabel, 1f, true, true);
        // Le gabarit porte ses sentinelles : l'app ne peut pas interpoler des
        // nombres qu'elle ne connaît qu'ici (les coches dépendent de l'heure).
        String line = progressTemplate
            .replace("{done}", String.valueOf(read))
            .replace("{total}", String.valueOf(total));
        return new State(line, (float) read / total, false, true);
    }
}
