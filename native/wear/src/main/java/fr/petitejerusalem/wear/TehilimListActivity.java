package fr.petitejerusalem.wear;

import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.wear.widget.WearableRecyclerView;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * La liste des Tehilim : ceux du jour en tête, puis les 150 dans l'ordre.
 *
 * Les psaumes du jour viennent du payload de la montre (le même cycle mensuel
 * que la lecture quotidienne de l'app) ; le texte, lui, est embarqué. Sans
 * payload, la liste des 150 reste entière : c'est le seul écran de la montre
 * qui n'a besoin de rien.
 */
public class TehilimListActivity extends PjWearActivity {

    private WearableRecyclerView list;
    private final List<Object> rows = new ArrayList<>();
    private final Adapter adapter = new Adapter();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_tehilim_list);
        list = findViewById(R.id.pj_list);
        list.setLayoutManager(new LinearLayoutManager(this));
        // Le défilement rotatif d'une WearableRecyclerView, lui, est natif :
        // il suffit de le demander (contrairement à un ScrollView, voir
        // PjWearActivity.bindRotary).
        list.setEdgeItemsCenteringEnabled(true);
        list.requestFocus();
        list.setAdapter(adapter);
    }

    @Override
    protected void render() {
        JSONObject watch = watchPayload();
        long now = System.currentTimeMillis();
        rows.clear();

        // Les psaumes du jour, tant qu'ils sont ceux du jour : passé minuit,
        // le payload ne vaut plus et la liste s'ouvre simplement sur les 150.
        JSONObject ofDay = watch == null ? null : watch.optJSONObject("tehilimOfDay");
        boolean fresh = watch != null && now < watch.optLong("expiresAt", 0);
        JSONArray psalms = ofDay == null ? null : ofDay.optJSONArray("psalms");
        if (fresh && psalms != null && psalms.length() > 0) {
            rows.add(new Section(PayloadStore.text(ofDay, "label")));
            for (int i = 0; i < psalms.length(); i++) rows.add(psalms.optInt(i));
        }

        rows.add(new Section(PayloadStore.label(this, watch, "tehilimTitle", R.string.pj_wear_tehilim)));
        for (int n = 1; n <= TehilimBook.CHAPTERS; n++) rows.add(n);
        adapter.notifyDataSetChanged();
    }

    /** Un intertitre de la liste. */
    private static final class Section {
        final String label;

        Section(String label) {
            this.label = label;
        }
    }

    private final class Adapter extends RecyclerView.Adapter<RecyclerView.ViewHolder> {
        private static final int TYPE_SECTION = 0;
        private static final int TYPE_PSALM = 1;

        @Override
        public int getItemViewType(int position) {
            return rows.get(position) instanceof Section ? TYPE_SECTION : TYPE_PSALM;
        }

        @NonNull
        @Override
        public RecyclerView.ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            int layout = viewType == TYPE_SECTION ? R.layout.row_section : R.layout.row_psalm;
            View view = LayoutInflater.from(parent.getContext()).inflate(layout, parent, false);
            return new RecyclerView.ViewHolder(view) {};
        }

        @Override
        public void onBindViewHolder(@NonNull RecyclerView.ViewHolder holder, int position) {
            Object row = rows.get(position);
            TextView view = (TextView) holder.itemView;
            if (row instanceof Section) {
                view.setText(((Section) row).label);
                return;
            }
            int chapter = (Integer) row;
            view.setText(TehilimBook.title(TehilimListActivity.this, watchPayload(), chapter));
            view.setOnClickListener(
                clicked -> {
                    Intent intent = new Intent(TehilimListActivity.this, TehilimTextActivity.class);
                    intent.putExtra(TehilimTextActivity.EXTRA_CHAPTER, chapter);
                    startActivity(intent);
                });
        }

        @Override
        public int getItemCount() {
            return rows.size();
        }
    }
}
