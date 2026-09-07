package fr.petitejerusalem.app;

import android.content.Context;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Le payload « zmanim » (contrat : src/services/widgetPayloads.ts), lu une
 * fois pour les trois widgets qui en vivent : « Horaires », « Horaires
 * essentiels » et le raccourci « Prochain horaire ».
 *
 * Rien ne se calcule ici : les libellés et les heures arrivent déjà localisés
 * et formatés, cette classe ne fait que choisir (le prochain horaire, le jour
 * qui couvre l'instant courant, les quatre essentiels du jour). C'est le
 * pendant Java des `Decodable` de native/ios/PjWidgets/PjWidgets.swift, et les
 * deux plateformes doivent choisir la même chose.
 */
final class ZmanimPayload {

    /** Un horaire réduit à ce qui se voit, plus l'epoch qui le situe. */
    static final class Line {
        final String key;
        final String label;
        final String time;
        /** Epoch en millisecondes (Date.getTime() côté JS). */
        final long epoch;

        Line(String key, String label, String time, long epoch) {
            this.key = key;
            this.label = label;
            this.time = time;
            this.epoch = epoch;
        }
    }

    /** Le jour hébraïque, borné par les chkiot qui l'ouvrent et le ferment. */
    static final class Day {
        final long from;
        final long until;
        final String hebrewDate;
        final String parasha;
        final String tachanun;
        /** Vrai les jours SANS tahanoun : à repérer d'un coup d'oeil, donc en gras. */
        final boolean tachanunStrong;

        Day(JSONObject json) {
            from = json.optLong("from");
            until = json.optLong("until");
            String date = Json.text(json, "hebrewDate");
            hebrewDate = date == null ? "" : date;
            parasha = Json.text(json, "parasha");
            tachanun = Json.text(json, "tachanun");
            tachanunStrong = json.optBoolean("tachanunStrong");
        }

        boolean covers(long instant) {
            return from <= instant && instant < until;
        }
    }

    /**
     * Les trois horaires de journée des « Horaires essentiels », dans l'ordre
     * de la journée. Pour le Chéma comme pour la Amida, l'opinion la plus
     * tardive (Gaon de Vilna, `sofZmanShma` et `sofZmanTfilla`, contre les
     * `…MGA` du Maguen Avraham) : c'est elle la limite au-delà de laquelle il
     * est trop tard. Le tsét, lui, se prend dans la fenêtre suivante.
     */
    private static final String[] MORNING_KEYS = {"sofZmanShma", "sofZmanTfilla", "plagHaMincha"};

    /** Nom affichable du lieu (« Paris », « Près de Lyon »…). */
    final String place;
    /** Message quand tous les horaires embarqués sont passés (app pas rouverte). */
    final String stale;
    /** Accent du thème de l'utilisateur, absent des payloads d'avant. */
    final String accent;
    final List<Line> times;
    final List<Day> days;

    /** Le payload rangé par le plugin, ou null s'il manque ou ne se lit pas. */
    static ZmanimPayload load(Context context) {
        String raw = PjWidgetsPlugin.store(context).getString(PjWidgetsPlugin.KEY_ZMANIM, null);
        if (raw == null) return null;
        try {
            return new ZmanimPayload(new JSONObject(raw));
        } catch (Exception e) {
            return null;
        }
    }

    private ZmanimPayload(JSONObject json) throws Exception {
        place = json.getString("place");
        stale = json.getString("stale");
        accent = Json.text(json, "accent");
        times = new ArrayList<>();
        JSONArray rawTimes = json.getJSONArray("times");
        for (int i = 0; i < rawTimes.length(); i++) {
            JSONObject time = rawTimes.getJSONObject(i);
            times.add(new Line(
                time.optString("key", ""),
                time.getString("label"),
                time.getString("time"),
                time.getLong("epoch")));
        }
        days = new ArrayList<>();
        // Absents des payloads d'avant la v2 : les lignes du jour restent vides.
        JSONArray rawDays = json.optJSONArray("days");
        for (int i = 0; rawDays != null && i < rawDays.length(); i++) {
            JSONObject day = rawDays.optJSONObject(i);
            if (day != null) days.add(new Day(day));
        }
    }

    /** Le premier horaire à venir, ou null : la fenêtre embarquée est épuisée. */
    Line next(long now) {
        for (Line line : times) {
            if (line.epoch > now) return line;
        }
        return null;
    }

    /**
     * Ceux d'après le prochain, au plus `max` : ils remplissent la place que
     * le prochain laisse libre.
     */
    List<Line> following(long now, int max) {
        List<Line> upcoming = new ArrayList<>();
        boolean skippedNext = false;
        for (Line line : times) {
            if (line.epoch <= now) continue;
            if (!skippedNext) {
                // Le prochain est mis en avant ailleurs : il ne se répète pas.
                skippedNext = true;
                continue;
            }
            upcoming.add(line);
            if (upcoming.size() == max) break;
        }
        return upcoming;
    }

    /** Le jour hébraïque qui couvre l'instant, ou null s'il n'est pas embarqué. */
    Day dayCovering(long instant) {
        for (Day day : days) {
            if (day.covers(instant)) return day;
        }
        return null;
    }

    /**
     * Les quatre horaires essentiels d'un jour hébraïque.
     *
     * La fenêtre du jour va d'une chkia à la suivante : les trois horaires de
     * journée y tombent. Le tsét, lui, suit la chkia qui ferme la fenêtre,
     * donc il appartient déjà à la suivante : on va le chercher là, sans quoi
     * on afficherait celui de la veille, tombé au tout début de la fenêtre.
     */
    List<Line> essentials(Day day) {
        List<Line> lines = new ArrayList<>();
        for (String key : MORNING_KEYS) {
            for (Line line : times) {
                if (!key.equals(line.key)) continue;
                if (day.from <= line.epoch && line.epoch < day.until) {
                    lines.add(line);
                    break;
                }
            }
        }
        for (Line line : times) {
            if ("tzeit".equals(line.key) && line.epoch >= day.until) {
                lines.add(line);
                break;
            }
        }
        return lines;
    }
}
