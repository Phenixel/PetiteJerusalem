package fr.petitejerusalem.wear;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import com.google.android.gms.wearable.DataMap;
import com.google.android.gms.wearable.DataMapItem;
import com.google.android.gms.wearable.Node;
import com.google.android.gms.wearable.PutDataRequest;
import com.google.android.gms.wearable.Wearable;

/**
 * Le lien avec le téléphone : où lire les payloads déjà synchronisés, et
 * comment en réclamer de frais.
 *
 * Deux chemins, et deux moments bien distincts :
 *
 *   - au lancement, la montre relit l'élément DÉJÀ synchronisé
 *     (`pull`) : Google Play services en garde une copie locale, elle est donc
 *     disponible tout de suite, téléphone éteint ou hors de portée. C'est le
 *     chemin normal, et il ne dépend de rien ;
 *   - en plus, la montre demande au téléphone de tout renvoyer (`request`) :
 *     utile la toute première fois, quand le téléphone croit avoir déjà donné
 *     ce que la montre n'a jamais reçu. Best-effort : cela ne marche que si
 *     l'app du téléphone tourne, elle seule sachant calculer les payloads.
 */
public final class WatchLink {

    /** Le DataItem qui porte les trois payloads. */
    public static final String PATH_PAYLOADS = "/pj/payloads";

    /** Le message « renvoie-moi tout » adressé au téléphone. */
    public static final String PATH_REQUEST = "/pj/request";

    private WatchLink() {}

    /**
     * Relit l'élément déjà synchronisé et range ce qu'il porte. Sans effet
     * quand rien n'est encore arrivé.
     */
    public static void pull(Context context) {
        Context app = context.getApplicationContext();
        Wearable.getDataClient(app)
            // Sans autorité, l'URI vise l'élément de TOUS les nœuds : la
            // montre prend celui du téléphone, quel que soit son identifiant.
            .getDataItems(
                new Uri.Builder().scheme(PutDataRequest.WEAR_URI_SCHEME).path(PATH_PAYLOADS).build())
            .addOnSuccessListener(buffer -> {
                try {
                    for (int i = 0; i < buffer.getCount(); i++) {
                        DataMap map = DataMapItem.fromDataItem(buffer.get(i)).getDataMap();
                        for (String key : PayloadStore.KEYS) {
                            String json = map.getString(key);
                            if (json != null) PayloadStore.write(app, key, json);
                        }
                    }
                } finally {
                    buffer.release();
                }
                app.sendBroadcast(
                    new Intent(PjWearListenerService.ACTION_PAYLOADS).setPackage(app.getPackageName()));
                Complications.requestUpdate(app);
            });
    }

    /** Demande au téléphone de tout renvoyer (voir l'en-tête de la classe). */
    public static void request(Context context) {
        Context app = context.getApplicationContext();
        Wearable.getNodeClient(app)
            .getConnectedNodes()
            .addOnSuccessListener(nodes -> {
                for (Node node : nodes) {
                    Wearable.getMessageClient(app)
                        .sendMessage(node.getId(), PATH_REQUEST, new byte[0]);
                }
            });
    }
}
