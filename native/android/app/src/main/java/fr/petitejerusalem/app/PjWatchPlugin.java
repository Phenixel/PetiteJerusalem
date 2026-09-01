package fr.petitejerusalem.app;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.wearable.MessageClient;
import com.google.android.gms.wearable.MessageEvent;
import com.google.android.gms.wearable.PutDataMapRequest;
import com.google.android.gms.wearable.Wearable;

/**
 * Pont app → montre Wear OS (pendant de PjWidgetsPlugin pour l'écran
 * d'accueil).
 *
 * La webview pousse ici les payloads JSON pré-calculés
 * (src/services/watchService.ts) ; ils partent dans le Data Layer, l'espace
 * que Google Play services synchronise tout seul entre le téléphone et la
 * montre. Le contrat est celui des widgets : horaires et lecture du jour tels
 * quels, plus le payload de la montre (libellés de ses écrans, psaumes du
 * jour).
 *
 * Deux propriétés du Data Layer font tout l'intérêt du transport ici :
 * l'élément déposé PERSISTE (la montre le retrouve à son réveil, même si elle
 * était éteinte ou hors de portée au moment du dépôt), et il se dépose sans
 * qu'aucune montre soit appairée (elle recevra tout à l'appairage). Le
 * téléphone n'a donc jamais à attendre la montre, et la montre n'a jamais à
 * attendre le téléphone.
 *
 * Un DataItem est remplacé d'un bloc, jamais fusionné : les payloads déjà
 * envoyés sont donc conservés ici, en SharedPreferences, pour être redéposés
 * avec celui qui change. Les trois tiennent très largement sous la limite de
 * 100 ko d'un DataItem (les horaires, les plus gros, pèsent une dizaine de
 * kilo-octets pour leur semaine).
 *
 * Fichier versionné dans native/android/, copié dans android/ (git-ignoré)
 * par scripts/setup-android.mjs et enregistré dans MainActivity.
 */
@CapacitorPlugin(name = "PjWatch")
public class PjWatchPlugin extends Plugin implements MessageClient.OnMessageReceivedListener {

    /** Chemin du DataItem qui porte les payloads (voir native/wear/). */
    static final String PATH_PAYLOADS = "/pj/payloads";

    /**
     * La montre réclame tout : son app vient d'être ouverte pour la première
     * fois, ou elle vient d'être appairée. Elle n'a alors rien de ce que le
     * téléphone croit lui avoir donné.
     */
    static final String PATH_REQUEST = "/pj/request";

    /** Copie locale du dernier dépôt, pour redéposer l'ensemble. */
    private static final String STORE = "pj_watch";

    private static final String[] KEYS = {"zmanim", "daily", "watch"};

    @Override
    public void load() {
        Wearable.getMessageClient(getContext()).addListener(this);
    }

    @Override
    protected void handleOnDestroy() {
        Wearable.getMessageClient(getContext()).removeListener(this);
    }

    @Override
    public void onMessageReceived(MessageEvent event) {
        if (!PATH_REQUEST.equals(event.getPath())) return;
        // La webview republiera tout : elle seule sait calculer les payloads.
        notifyListeners("watchRequest", new JSObject());
    }

    @PluginMethod
    public void setPayloads(PluginCall call) {
        Context context = getContext();
        SharedPreferences store = context.getSharedPreferences(STORE, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = store.edit();
        for (String key : KEYS) {
            String value = call.getString(key);
            if (value != null) editor.putString(key, value);
        }
        editor.apply();

        PutDataMapRequest request = PutDataMapRequest.create(PATH_PAYLOADS);
        for (String key : KEYS) {
            String value = store.getString(key, null);
            if (value != null) request.getDataMap().putString(key, value);
        }
        // setUrgent : sans lui le système peut retenir le dépôt une trentaine
        // de minutes. Les horaires, eux, se périment à la minute.
        Wearable.getDataClient(context)
            .putDataItem(request.asPutDataRequest().setUrgent())
            // Résolu seulement une fois déposé : un échec fait retenter l'envoi
            // au passage suivant (PayloadSink côté webview).
            .addOnSuccessListener(item -> call.resolve())
            .addOnFailureListener(error -> call.reject("Data Layer indisponible", error));
    }
}
