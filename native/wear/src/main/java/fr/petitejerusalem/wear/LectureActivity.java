package fr.petitejerusalem.wear;

import android.content.res.ColorStateList;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Écran « Lecture du jour » : l'avancement du jour et les lectures qui le
 * composent, le dessin de la carte du tableau de bord ramené au poignet.
 *
 * Consultation seule, et c'est délibéré : cocher depuis la montre demanderait
 * un chemin d'écriture en sens inverse (montre → téléphone → Firestore) qui ne
 * fonctionnerait QUE l'app du téléphone ouverte, seule à savoir écrire les
 * préférences. Une coche avalée en silence vaut moins qu'une coche qu'on n'a
 * pas proposée (voir docs/app-watch.md).
 *
 * Les coches portent leur échéance : passé minuit, elles ne comptent plus, et
 * l'écran repart de zéro sans que le téléphone ait à envoyer quoi que ce soit.
 */
public class LectureActivity extends PjWearActivity {

    private TextView title;
    private TextView progressLabel;
    private ProgressBar progressBar;
    private LinearLayout items;
    private TextView message;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_lecture);
        title = findViewById(R.id.pj_title);
        progressLabel = findViewById(R.id.pj_progress_label);
        progressBar = findViewById(R.id.pj_progress);
        items = findViewById(R.id.pj_items);
        message = findViewById(R.id.pj_message);
        bindRotary((ScrollView) findViewById(R.id.pj_scroll));
    }

    @Override
    protected void render() {
        long now = System.currentTimeMillis();
        JSONObject daily = payload(PayloadStore.KEY_DAILY);
        JSONObject watch = watchPayload();
        int accent = PayloadStore.accent(daily);

        title.setText(PayloadStore.label(this, watch, "dailyTitle", R.string.pj_wear_daily));
        items.removeAllViews();

        Daily.Progress progress = Daily.of(daily, now);
        if (daily == null || !progress.configured) {
            // Personne de connecté, aucune lecture activée, ou rien encore
            // reçu : un message, et rien d'autre à montrer.
            progressLabel.setVisibility(View.GONE);
            progressBar.setVisibility(View.GONE);
            message.setVisibility(View.VISIBLE);
            String empty = PayloadStore.text(daily, "emptyLabel");
            message.setText(
                empty != null
                    ? empty
                    : PayloadStore.label(this, watch, "pairing", R.string.pj_wear_open_phone));
            return;
        }

        message.setVisibility(View.GONE);
        progressLabel.setVisibility(View.VISIBLE);
        progressBar.setVisibility(View.VISIBLE);
        String allDone = PayloadStore.text(daily, "allDoneLabel");
        progressLabel.setText(
            progress.allDone() && allDone != null ? allDone : Daily.progressLine(daily, progress));
        progressLabel.setTextColor(
            progress.allDone()
                ? getColor(R.color.pj_wear_success)
                : getColor(R.color.pj_wear_text_secondary));
        progressBar.setProgress(Math.round(progress.ratio() * 100));
        // La teinte, et non un filtre de couleur : le filtre repeindrait aussi
        // le fond de la barre, qui doit rester en retrait.
        progressBar.setProgressTintList(ColorStateList.valueOf(accent));

        JSONArray list = daily.optJSONArray("items");
        for (int i = 0; list != null && i < list.length(); i++) {
            JSONObject item = list.optJSONObject(i);
            if (item == null) continue;
            addItem(PayloadStore.text(item, "label"), Daily.isDone(item, progress), accent);
        }

        // Chnei mikra : suivi hebdomadaire, affiché à part et hors décompte,
        // comme sur la page. Sa coche ne se périme pas à minuit.
        String parasha = PayloadStore.text(daily, "parasha");
        if (parasha != null) addItem(parasha, daily.optBoolean("parashaDone"), accent);
    }

    private void addItem(String label, boolean done, int accent) {
        View row = LayoutInflater.from(this).inflate(R.layout.row_item, (ViewGroup) items, false);
        TextView check = row.findViewById(R.id.pj_item_check);
        TextView text = row.findViewById(R.id.pj_item_label);
        // Un caractère, pas une image : il suit la taille de police du système,
        // que les montres laissent régler bien plus largement qu'un téléphone.
        check.setText(done ? "✓" : "·");
        check.setTextColor(done ? accent : getColor(R.color.pj_wear_text_secondary));
        text.setText(label == null ? "" : label);
        text.setTextColor(
            done ? getColor(R.color.pj_wear_text_secondary) : getColor(R.color.pj_wear_text));
        items.addView(row);
    }
}
