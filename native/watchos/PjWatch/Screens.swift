import SwiftUI

/**
 * Les écrans de l'app de montre.
 *
 * Rien n'est calculé ici : tout vient des payloads (Payloads.swift), déjà
 * localisés et formatés, et les Tehilim sont lus dans le fichier embarqué. Les
 * trois écrans sont ceux de la montre Wear OS, à la lettre : horaires, lecture
 * du jour, textes.
 *
 * Fichier ajouté à la cible « PjWatch » du projet Xcode par
 * scripts/setup-ios.mjs, voir docs/app-watch.md.
 */

/** Repli quand aucun payload n'est encore arrivé (montre fraîchement posée). */
let pairingFallback = "Ouvrez Petite Jérusalem sur votre téléphone"

// MARK: - Accueil

/**
 * L'écran d'accueil : d'abord ce pour quoi on lève le poignet, le prochain
 * horaire en grand, puis les trois écrans. La lecture du jour porte son
 * avancement dès le menu, pour n'avoir même pas à l'ouvrir.
 */
struct RootScreen: View {
    @EnvironmentObject private var store: PayloadStore

    var body: some View {
        NavigationStack {
            List {
                Section { glance }
                menu
            }
            .listStyle(.carousel)
            .navigationTitle("Petite Jérusalem")
            .navigationBarTitleDisplayMode(.inline)
        }
        // L'interface suit la langue choisie sur le téléphone : en hébreu, la
        // montre se lit de droite à gauche comme l'app. Le texte des psaumes,
        // lui, reste de droite à gauche quelle que soit la langue de
        // l'interface : c'est de l'hébreu, et sa mise en page ne se discute pas.
        .environment(\.layoutDirection, store.watch?.locale == "he" ? .rightToLeft : .leftToRight)
    }

    @ViewBuilder private var glance: some View {
        let now = Date()
        let next = store.zmanim?.upcoming(from: now, limit: 1).first
        VStack(spacing: 2) {
            if let day = store.zmanim?.day(at: now) {
                Text(day.hebrewDate).font(.caption2).foregroundStyle(PjColors.textSecondary)
            }
            if let place = store.zmanim?.place {
                Text(place).font(.caption2).foregroundStyle(PjColors.textSecondary)
            }
            if let next {
                Text(next.label).font(.footnote).foregroundStyle(PjColors.text)
                Text(next.time)
                    .font(.system(size: 34, weight: .semibold, design: .rounded))
                    .foregroundStyle(PjColors.accent(store.zmanim?.accent))
            } else {
                // Trois états, trois messages : rien n'est encore arrivé, ou
                // la semaine embarquée est épuisée faute d'avoir rouvert l'app.
                Text(store.zmanim?.stale ?? store.watch?.pairing ?? pairingFallback)
                    .font(.caption2)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(PjColors.textSecondary)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 4)
    }

    @ViewBuilder private var menu: some View {
        let now = Date()
        NavigationLink {
            ZmanimScreen()
        } label: {
            Text(store.watch?.zmanimTitle ?? "Horaires")
        }
        NavigationLink {
            DailyScreen()
        } label: {
            VStack(alignment: .leading, spacing: 1) {
                Text(store.watch?.dailyTitle ?? "Lecture du jour")
                if let daily = store.daily, daily.configured {
                    Text(daily.progressLine(at: now))
                        .font(.caption2)
                        .foregroundStyle(PjColors.textSecondary)
                }
            }
        }
        NavigationLink {
            TehilimListScreen()
        } label: {
            Text(store.watch?.textsTitle ?? "Textes")
        }
    }
}

// MARK: - Horaires

/**
 * Les prochains zmanim du lieu de l'utilisateur, la paracha de la semaine et
 * le ta'hanoun : ce que montre le widget d'écran d'accueil, déroulé.
 */
struct ZmanimScreen: View {
    @EnvironmentObject private var store: PayloadStore

    /// De quoi couvrir la fin de la journée et le début de la suivante.
    private static let maxTimes = 12

    var body: some View {
        let now = Date()
        let upcoming = store.zmanim?.upcoming(from: now, limit: Self.maxTimes) ?? []
        let day = store.zmanim?.day(at: now)
        List {
            if upcoming.isEmpty {
                Text(store.zmanim?.stale ?? store.watch?.pairing ?? pairingFallback)
                    .font(.footnote)
                    .foregroundStyle(PjColors.textSecondary)
            }
            ForEach(Array(upcoming.enumerated()), id: \.element.id) { index, zman in
                HStack {
                    Text(zman.label).font(.footnote)
                    Spacer(minLength: 6)
                    Text(zman.time)
                        .font(.footnote)
                        // Le prochain porte l'accent, comme la carte
                        // « prochain horaire » de la page Horaires.
                        .foregroundStyle(
                            index == 0 ? PjColors.accent(store.zmanim?.accent) : PjColors.text)
                        .fontWeight(index == 0 ? .semibold : .regular)
                }
            }
            if let day {
                Section {
                    if let parasha = day.parasha {
                        Text(parasha).font(.caption2).foregroundStyle(PjColors.textSecondary)
                    }
                    if let tachanun = day.tachanun {
                        // En gras les jours où l'on n'en dit pas : c'est ce
                        // qu'on vient vérifier.
                        Text(tachanun)
                            .font(.caption2)
                            .fontWeight(day.tachanunStrong ? .semibold : .regular)
                            .foregroundStyle(PjColors.textSecondary)
                    }
                }
            }
        }
        .navigationTitle(store.watch?.zmanimTitle ?? "Horaires")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Lecture du jour

/**
 * L'avancement du jour et les lectures qui le composent.
 *
 * Consultation seule, et c'est délibéré : cocher depuis la montre demanderait
 * un chemin d'écriture en sens inverse (montre → téléphone → Firestore) qui ne
 * fonctionnerait QUE l'app du téléphone ouverte, seule à savoir écrire les
 * préférences. Une coche avalée en silence vaut moins qu'une coche qu'on n'a
 * pas proposée (voir docs/app-watch.md).
 */
struct DailyScreen: View {
    @EnvironmentObject private var store: PayloadStore

    var body: some View {
        let now = Date()
        List {
            if let daily = store.daily, daily.configured {
                let done = daily.done(at: now)
                let fresh = daily.isFresh(at: now)
                Section {
                    VStack(spacing: 6) {
                        Text(
                            done == daily.items.count && !daily.items.isEmpty
                                ? daily.allDoneLabel
                                : daily.progressLine(at: now)
                        )
                        .font(.caption)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(
                            done == daily.items.count && !daily.items.isEmpty
                                ? PjColors.success : PjColors.textSecondary)
                        ProgressView(
                            value: daily.items.isEmpty
                                ? 0 : Double(done) / Double(daily.items.count))
                            .tint(PjColors.accent(daily.accent))
                    }
                    .frame(maxWidth: .infinity)
                }
                ForEach(daily.items) { item in
                    ReadingRow(
                        label: item.label, done: fresh && item.done, accent: daily.accent)
                }
                if let parasha = daily.parasha {
                    // Chnei mikra : suivi hebdomadaire, hors décompte du jour,
                    // et sa coche ne se périme donc pas à minuit.
                    ReadingRow(label: parasha, done: daily.parashaDone, accent: daily.accent)
                }
            } else {
                Text(store.daily?.emptyLabel ?? store.watch?.pairing ?? pairingFallback)
                    .font(.footnote)
                    .foregroundStyle(PjColors.textSecondary)
            }
        }
        .navigationTitle(store.watch?.dailyTitle ?? "Lecture du jour")
        .navigationBarTitleDisplayMode(.inline)
    }
}

/** Une lecture du jour : sa coche, et son titre. */
private struct ReadingRow: View {
    let label: String
    let done: Bool
    let accent: String?

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Image(systemName: done ? "checkmark.circle.fill" : "circle")
                .font(.caption2)
                .foregroundStyle(done ? PjColors.accent(accent) : PjColors.textSecondary)
            Text(label)
                .font(.footnote)
                .foregroundStyle(done ? PjColors.textSecondary : PjColors.text)
        }
    }
}

// MARK: - Tehilim

/**
 * La liste des Tehilim : ceux du jour en tête, puis les 150 dans l'ordre.
 *
 * C'est le seul écran de la montre qui n'a besoin de rien : le texte est
 * embarqué, seuls les psaumes du jour et les titres viennent du payload.
 */
struct TehilimListScreen: View {
    @EnvironmentObject private var store: PayloadStore

    var body: some View {
        let now = Date()
        let ofDay = store.watch?.tehilimOfDayIsFresh(at: now) == true
            ? store.watch?.tehilimOfDay : nil
        List {
            if let ofDay, !ofDay.psalms.isEmpty {
                Section(ofDay.label) {
                    ForEach(ofDay.psalms, id: \.self) { psalm in link(to: psalm) }
                }
            }
            Section(store.watch?.tehilimTitle ?? "Tehilim") {
                ForEach(1...TehilimBook.chapters, id: \.self) { psalm in link(to: psalm) }
            }
        }
        .navigationTitle(store.watch?.textsTitle ?? "Textes")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func link(to chapter: Int) -> some View {
        NavigationLink {
            TehilimScreen(chapter: chapter)
        } label: {
            Text(title(chapter)).font(.footnote)
        }
    }

    private func title(_ chapter: Int) -> String {
        store.watch?.psalmTitle(chapter) ?? "Tehilim \(chapter)"
    }
}

/**
 * Un psaume, en hébreu, lu au poignet.
 *
 * Ce n'est pas le plus confortable des supports, et ce n'est pas la question :
 * un Tehilim se dit là où l'on se trouve, et une montre est toujours là. Les
 * versets sont séparés par un blanc plutôt que numérotés : la place manque, et
 * l'on ne vient pas y chercher une référence.
 */
struct TehilimScreen: View {
    @EnvironmentObject private var store: PayloadStore
    let chapter: Int

    var body: some View {
        ScrollView {
            VStack(alignment: .trailing, spacing: 10) {
                ForEach(Array(TehilimBook.lines(chapter).enumerated()), id: \.offset) { _, line in
                    Text(line)
                        .font(.footnote)
                        .multilineTextAlignment(.trailing)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                }
            }
            .environment(\.layoutDirection, .rightToLeft)
            .padding(.vertical, 4)
        }
        .navigationTitle(store.watch?.psalmTitle(chapter) ?? "Tehilim \(chapter)")
        .navigationBarTitleDisplayMode(.inline)
    }
}

/**
 * Les 150 Tehilim, embarqués dans le paquet de l'app.
 *
 * C'est le seul texte que la montre porte, et il ne transite pas par
 * WatchConnectivity : il ne change jamais, il pèse trois cents kilo-octets, et
 * le faire voyager à chaque changement de langue serait payer une bande
 * passante et une batterie pour rien. Embarqué, il se lit sans téléphone à
 * portée, dès la première seconde, et c'est ce qu'on attend d'un livre.
 *
 * Le fichier est produit au setup depuis public/texts/tehilim.json, débarrassé
 * de la mise en forme de la source Sefaria par scripts/lib/watch-tehilim.mjs,
 * exactement comme l'app le fait à l'écran : il n'y a aucune règle de texte à
 * tenir ici.
 *
 * Les autres corpus (Talmud, Michna, Tanakh, Sidour) restent sur le téléphone :
 * ils pèsent une quarantaine de méga-octets et se lisent par pages, ce qu'un
 * poignet ne rend pas.
 */
enum TehilimBook {
    /// Le livre en compte 150, et le fichier embarqué les porte tous.
    static let chapters = 150

    /// Le livre entier, lu une fois. Les vues le redemandent à chaque rendu.
    private static let book: [String: [String]] = {
        guard let url = Bundle.main.url(forResource: "tehilim", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode([String: [String]].self, from: data)
        else { return [:] }
        return decoded
    }()

    /// Les versets d'un psaume, déjà nettoyés. Vide si le fichier manque.
    static func lines(_ chapter: Int) -> [String] {
        book[String(chapter)] ?? []
    }
}
