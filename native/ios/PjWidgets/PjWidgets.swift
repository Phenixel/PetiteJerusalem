import SwiftUI
import UIKit
import WidgetKit

/**
 * Widgets iOS « Horaires » et « Lecture du jour » (pendant des providers
 * Android de native/android/).
 *
 * Tout le contenu vient des payloads JSON poussés par l'app via
 * PjWidgetsPlugin dans l'App Group (contrat : src/services/widgetPayloads.ts).
 * Libellés ET heures y sont déjà localisés et formatés : aucun DateFormatter
 * ici, le réglage 12 h/24 h et le calendrier de l'appareil (hébraïque chez
 * une partie du public) réécriraient l'affichage. Les widgets comparent des
 * epochs, comptent des coches, rien d'autre.
 *
 * - Horaires : une entrée de timeline par zman à venir (fenêtre bornée, les
 *   entrées ne portent que leurs chaînes, pas le payload entier) ; fenêtre
 *   épuisée → une entrée « rouvrez l'app » en .never, l'app relancera tout au
 *   prochain push. Chaque entrée porte aussi les horaires suivants : ils
 *   occupent la largeur du format moyen, qui a la hauteur du petit.
 * - Horaires essentiels : les quatre horaires du jour qu'on vérifie le plus,
 *   un tableau qui ne tourne qu'à la chkia, contrairement au précédent qui
 *   annonce le prochain zman.
 * - Lecture : une ligne, le même dessin que la carte du tableau de bord
 *   (src/components/DailyReadingCard.vue) : titre, progression, pourcentage,
 *   barre. Une entrée maintenant, redessin à l'échéance du payload
 *   (expiresAt, minuit local calculé côté app).
 *
 * Fichier ajouté à la cible d'extension « PjWidgets » du projet Xcode par
 * scripts/setup-ios.mjs, voir docs/app-widgets.md.
 */

let appGroup = "group.fr.petitejerusalem.app"

func loadPayload<T: Decodable>(_ key: String, as type: T.Type) -> T? {
    guard let raw = UserDefaults(suiteName: appGroup)?.string(forKey: key),
          let data = raw.data(using: .utf8)
    else { return nil }
    return try? JSONDecoder().decode(T.self, from: data)
}

/** Repli quand aucun payload n'existe (widget posé avant le premier lancement). */
let openAppFallback = "Ouvrez Petite Jérusalem pour préparer le widget"

/**
 * Vrai pour les formats de l'écran d'accueil, faux pour les accessoires de
 * l'écran verrouillé (et de StandBy). Les accessoires changent tout : 72 pt
 * de haut au lieu de 164, aucun fond à nous, et le système délave les
 * couleurs (rendu « vibrant »), l'accent du thème compris.
 *
 * Les familles accessoires datent d'iOS 16 et l'app descend à 15 : on les
 * reconnaît par la négative, pour ne pas avoir à nommer un cas indisponible.
 */
func isHomeScreen(_ family: WidgetFamily) -> Bool {
    family == .systemSmall || family == .systemMedium || family == .systemLarge
}

/** Les familles d'un widget : l'écran d'accueil, plus l'écran verrouillé. */
func supportedFamilies(_ home: [WidgetFamily]) -> [WidgetFamily] {
    guard #available(iOS 16.0, *) else { return home }
    return home + [.accessoryRectangular]
}

/**
 * Le fond de l'app derrière un widget d'écran d'accueil. Sur l'écran
 * verrouillé, le système pose déjà le sien, translucide : y ajouter le nôtre
 * y ferait une tache opaque.
 */
struct PjWidgetBackground: ViewModifier {
    @Environment(\.widgetFamily) private var family

    @ViewBuilder func body(content: Content) -> some View {
        let home = isHomeScreen(family)
        if #available(iOS 17.0, *) {
            content.containerBackground(for: .widget) {
                if home { PjColors.background } else { Color.clear }
            }
        } else if home {
            content.padding().background(PjColors.background)
        } else {
            content
        }
    }
}

// MARK: - Couleurs

/**
 * Les couleurs de l'app (src/assets/main.css). L'accent, lui, est celui du
 * thème choisi par l'utilisateur et arrive dans le payload : ces constantes ne
 * servent qu'aux payloads d'avant, qui ne le portaient pas.
 */
enum PjColors {
    static let fallbackAccent = "#1D6FDB"
    static let background = adaptive(light: "#F4F1EA", dark: "#1F2937")
    static let text = adaptive(light: "#35312A", dark: "#F3F4F6")
    static let textSecondary = adaptive(light: "#6D6759", dark: "#9CA3AF")
    /// Le vert de « tout est lu » (text-green-600 / dark:text-green-400).
    static let success = adaptive(light: "#16A34A", dark: "#4ADE80")

    /// Une couleur qui suit le mode clair/sombre de l'appareil.
    static func adaptive(light: String, dark: String) -> Color {
        guard let lightColor = uiColor(light), let darkColor = uiColor(dark) else { return .primary }
        return Color(UIColor { $0.userInterfaceStyle == .dark ? darkColor : lightColor })
    }

    /// L'accent du payload, ou celui d'origine si le payload est d'avant.
    static func accent(_ hex: String?) -> Color {
        guard let color = uiColor(hex ?? "") ?? uiColor(fallbackAccent) else { return .primary }
        return Color(color)
    }

    /// Une couleur fixe, la même en clair et en sombre : les reliures des
    /// livres, par exemple, qui sont des objets et non de l'interface.
    static func fixed(_ hex: String) -> Color {
        guard let color = uiColor(hex) else { return .primary }
        return Color(color)
    }

    /// "#RRGGBB" ; toute autre forme rend nil, le widget ne devine pas.
    private static func uiColor(_ hex: String) -> UIColor? {
        var value = hex
        if value.hasPrefix("#") { value.removeFirst() }
        guard value.count == 6, let rgb = UInt32(value, radix: 16) else { return nil }
        return UIColor(
            red: CGFloat((rgb >> 16) & 0xFF) / 255,
            green: CGFloat((rgb >> 8) & 0xFF) / 255,
            blue: CGFloat(rgb & 0xFF) / 255,
            alpha: 1)
    }
}

// MARK: - Horaires

struct ZmanTime: Decodable {
    let key: String
    let label: String
    /// "17:42", déjà formaté dans le fuseau du lieu par l'app.
    let time: String
    /// Epoch en millisecondes (Date.getTime() côté JS).
    let epoch: Double

    var date: Date { Date(timeIntervalSince1970: epoch / 1000) }
}

/// Le jour hébraïque, borné par les chkiot qui l'ouvrent et le ferment.
struct ZmanimDay: Decodable {
    /// Epoch ms du début (la chkia de la veille) et de la fin (la sienne).
    let from: Double
    let until: Double
    let hebrewDate: String
    let parasha: String?
    let tachanun: String?
    /// Vrai les jours SANS tahanoun : à repérer d'un coup d'œil, donc en gras.
    let tachanunStrong: Bool

    func covers(_ instant: Date) -> Bool {
        let ms = instant.timeIntervalSince1970 * 1000
        return from <= ms && ms < until
    }
}

struct ZmanimPayload: Decodable {
    let v: Int
    let place: String
    let stale: String
    let times: [ZmanTime]
    /// Absent des payloads d'avant la v2 : les lignes du jour restent vides.
    let days: [ZmanimDay]?
    /// Absent des payloads d'avant l'accent de thème.
    let accent: String?
}

/// Un horaire à afficher, réduit à ce qui se voit.
struct ZmanLine: Hashable {
    let label: String
    let time: String
}

/// Une entrée ne porte que ce qu'elle affiche, surtout pas le payload entier,
/// que WidgetKit archiverait avec CHAQUE entrée de la timeline.
struct ZmanimEntry: TimelineEntry {
    let date: Date
    let place: String
    let hebrewDate: String
    let parasha: String?
    let tachanun: String?
    let tachanunStrong: Bool
    /// Prochain zman à l'instant `date`, nil quand `message` prend la place.
    let next: ZmanLine?
    /// Ceux d'après : ils remplissent la place que le prochain laisse libre.
    let following: [ZmanLine]
    /// Fenêtre épuisée ou payload absent : message à afficher seul.
    let message: String?
    let accent: String?
}

extension ZmanimEntry {
    /// L'entrée vide : un message seul, sans jour ni horaire.
    static func message(_ text: String, at date: Date, place: String = "", accent: String? = nil)
        -> ZmanimEntry
    {
        ZmanimEntry(
            date: date, place: place, hebrewDate: "", parasha: nil, tachanun: nil,
            tachanunStrong: false, next: nil, following: [], message: text, accent: accent)
    }
}

struct ZmanimProvider: TimelineProvider {
    /// Nombre maximal d'entrées par timeline (~3 jours de zmanim) : WidgetKit
    /// redemande la suite en fin de timeline (.atEnd), inutile d'archiver plus.
    static let maxEntries = 45
    /// Horaires embarqués en plus du prochain : de quoi remplir la colonne
    /// du format moyen ; le petit n'affiche que le premier.
    static let maxFollowing = 3

    func placeholder(in context: Context) -> ZmanimEntry {
        .message(openAppFallback, at: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (ZmanimEntry) -> Void) {
        let timeline = buildTimeline(now: Date())
        completion(timeline.entries.first ?? placeholder(in: context))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ZmanimEntry>) -> Void) {
        completion(buildTimeline(now: Date()))
    }

    private func buildTimeline(now: Date) -> Timeline<ZmanimEntry> {
        guard let payload = loadPayload("zmanim", as: ZmanimPayload.self) else {
            // Pas encore de payload : rien à replanifier, l'app rechargera les
            // timelines au premier push.
            return Timeline(entries: [.message(openAppFallback, at: now)], policy: .never)
        }

        let upcoming = payload.times.filter { $0.date > now }
        if upcoming.isEmpty {
            // Fenêtre épuisée : surtout pas .atEnd (une timeline déjà finie
            // serait redemandée en boucle et grillerait le budget de refresh).
            return Timeline(
                entries: [
                    .message(payload.stale, at: now, place: payload.place, accent: payload.accent)
                ],
                policy: .never)
        }

        var entries: [ZmanimEntry] = []
        for (i, next) in upcoming.prefix(Self.maxEntries).enumerated() {
            // L'entrée i affiche `next` ; elle prend effet maintenant pour la
            // première, au passage du zman précédent pour les suivantes.
            let at = i == 0 ? now : upcoming[i - 1].date.addingTimeInterval(1)
            // Le jour hébraïque de CET instant-là : la date, la paracha et le
            // tahanoun changent à la chkia, pas au zman.
            let day = payload.days?.first { $0.covers(at) }
            let following = upcoming
                .dropFirst(i + 1)
                .prefix(Self.maxFollowing)
                .map { ZmanLine(label: $0.label, time: $0.time) }
            entries.append(ZmanimEntry(
                date: at,
                place: payload.place,
                hebrewDate: day?.hebrewDate ?? "",
                parasha: day?.parasha,
                tachanun: day?.tachanun,
                tachanunStrong: day?.tachanunStrong ?? false,
                next: ZmanLine(label: next.label, time: next.time),
                following: Array(following),
                message: nil,
                accent: payload.accent))
        }
        return Timeline(entries: entries, policy: .atEnd)
    }
}

/// Un horaire secondaire : son libellé à gauche, son heure à droite.
struct ZmanRow: View {
    let line: ZmanLine

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(line.label)
                .foregroundStyle(PjColors.textSecondary)
            Spacer(minLength: 4)
            Text(line.time)
                .fontWeight(.semibold)
                .monospacedDigit()
                .foregroundStyle(PjColors.text)
        }
        .font(.caption)
        .lineLimit(1)
        // Un libellé trop long se resserre plutôt que de se couper : « Plag
        // haMin'ha » réduit à « Plag haMin'… » ne nomme plus rien.
        .minimumScaleFactor(0.7)
    }
}

struct HorairesWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: ZmanimEntry

    /**
     * Le format moyen est exactement aussi HAUT que le petit, seulement deux
     * fois plus large. Empiler chez lui trois horaires de plus sous l'heure
     * mise en avant faisait déborder le bloc : la date se collait au bord du
     * haut, le ta'hanoun se coupait en bas. Ce qu'il a en trop est de la
     * largeur : les horaires suivants vont donc à côté de l'heure, pas
     * dessous. Le petit, lui, garde sa colonne et un seul horaire de plus.
     */
    private var isMedium: Bool { family != .systemSmall }

    var body: some View {
        Group {
            if isHomeScreen(family) { home } else { accessory }
        }
        .widgetURL(URL(string: "petitejerusalem://petite-jerusalem.fr/horaires"))
    }

    /// Écran verrouillé : 72 pt de haut, sans fond ni couleur. Il n'y reste
    /// que le prochain horaire et celui d'après ; la date hébraïque, la
    /// paracha et le ta'hanoun sont du ressort de l'écran d'accueil.
    private var accessory: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let next = entry.next {
                Text(next.label)
                    .font(.caption2)
                Text(next.time)
                    .font(.title3.weight(.bold))
                    .monospacedDigit()
                if let after = entry.following.first {
                    HStack(spacing: 4) {
                        Text(after.label)
                        Spacer(minLength: 2)
                        Text(after.time)
                            .fontWeight(.semibold)
                            .monospacedDigit()
                    }
                    .font(.caption2)
                }
            } else {
                Text(entry.message ?? openAppFallback)
                    .font(.caption2)
                    .lineLimit(3)
            }
        }
        .lineLimit(1)
        .minimumScaleFactor(0.7)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private var home: some View {
        let accent = PjColors.accent(entry.accent)
        return VStack(alignment: .leading, spacing: 0) {
            header
            if let next = entry.next {
                Spacer(minLength: 6)
                if isMedium {
                    HStack(alignment: .top, spacing: 12) {
                        nextZman(next, accent: accent)
                        Spacer(minLength: 8)
                        following
                    }
                } else {
                    nextZman(next, accent: accent)
                    if let first = entry.following.first {
                        Spacer(minLength: 6)
                        ZmanRow(line: first)
                    }
                }
                Spacer(minLength: 6)
                footer
            } else {
                Spacer(minLength: 8)
                Text(entry.message ?? openAppFallback)
                    .font(.footnote)
                    .foregroundStyle(PjColors.text)
                Spacer(minLength: 0)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    /// L'horaire mis en avant : son nom, puis l'heure à l'accent du thème.
    private func nextZman(_ next: ZmanLine, accent: Color) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(next.label)
                .font(.footnote)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
                .foregroundStyle(PjColors.text)
            Text(next.time)
                .font(.system(size: isMedium ? 34 : 30, weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(accent)
        }
    }

    /// Les horaires d'après, en colonne à droite de l'heure mise en avant :
    /// ils occupent la largeur que le format moyen a en trop. La colonne se
    /// dimensionne sur sa ligne la plus large, ce qui aligne les heures.
    @ViewBuilder private var following: some View {
        if !entry.following.isEmpty {
            VStack(spacing: 4) {
                ForEach(Array(entry.following.prefix(3)), id: \.self) { line in
                    ZmanRow(line: line)
                }
            }
        }
    }

    /// La date hébraïque et le lieu : les deux repères du widget.
    private var header: some View {
        HStack(spacing: 6) {
            Text(entry.hebrewDate)
                .font(.caption.weight(.bold))
                .lineLimit(1)
            Spacer(minLength: 4)
            Text(entry.place)
                .font(.caption)
                .lineLimit(1)
        }
        .foregroundStyle(PjColors.textSecondary)
    }

    /// La paracha et le tahanoun, posés en bas : ce sont les repères du jour,
    /// pas des horaires, et ils ferment le widget au lieu de flotter au milieu.
    @ViewBuilder private var footer: some View {
        if entry.parasha != nil || entry.tachanun != nil {
            VStack(alignment: .leading, spacing: 1) {
                if let parasha = entry.parasha {
                    Text(parasha)
                        .font(.caption2)
                        .foregroundStyle(PjColors.textSecondary)
                }
                if let tachanun = entry.tachanun {
                    // Les jours sans tahanoun se repèrent d'un coup d'œil.
                    Text(tachanun)
                        .font(entry.tachanunStrong ? .caption2.weight(.bold) : .caption2)
                        .foregroundStyle(entry.tachanunStrong ? PjColors.text : PjColors.textSecondary)
                }
            }
            .lineLimit(1)
            // « Parachat Nitzavim · Vayelech » ne tient pas en largeur dans un
            // petit widget : il se resserre, plutôt que de perdre sa seconde
            // paracha dans des points de suspension.
            .minimumScaleFactor(0.7)
        }
    }
}

struct HorairesWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "HorairesWidget", provider: ZmanimProvider()) { entry in
            HorairesWidgetView(entry: entry).modifier(PjWidgetBackground())
        }
        .configurationDisplayName("Horaires")
        .description("Le prochain horaire (zman) de votre journée.")
        .supportedFamilies(supportedFamilies([.systemSmall, .systemMedium]))
    }
}

// MARK: - Horaires essentiels

/**
 * Les quatre horaires du jour qu'on vérifie le plus souvent, et rien d'autre :
 * les deux limites du matin, puis les deux repères du soir.
 *
 * À la différence du widget « Horaires », qui annonce le PROCHAIN zman et se
 * replanifie à chacun, celui-ci est un tableau du jour : ses quatre lignes ne
 * changent qu'à la chkia, quand le jour hébraïque tourne. Passée la limite du
 * Chéma, elle reste affichée, c'est bien son heure d'aujourd'hui que l'on
 * vient lire.
 */
struct EssentialsEntry: TimelineEntry {
    let date: Date
    let place: String
    let hebrewDate: String
    let lines: [ZmanLine]
    /// Fenêtre épuisée ou payload absent : message à afficher seul.
    let message: String?
    let accent: String?

    static func message(_ text: String, at date: Date, accent: String? = nil) -> EssentialsEntry {
        EssentialsEntry(
            date: date, place: "", hebrewDate: "", lines: [], message: text, accent: accent)
    }
}

struct EssentialsProvider: TimelineProvider {
    /**
     * Les clés retenues, dans l'ordre de la journée. Pour le Chéma comme pour
     * la Amida, l'opinion la plus tardive (Gaon de Vilna, `sofZmanShma` et
     * `sofZmanTfilla`, contre les `…MGA` du Maguen Avraham) : c'est elle la
     * limite au-delà de laquelle il est trop tard.
     */
    static let morningKeys = ["sofZmanShma", "sofZmanTfilla", "plagHaMincha"]

    func placeholder(in context: Context) -> EssentialsEntry {
        .message(openAppFallback, at: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (EssentialsEntry) -> Void) {
        completion(buildTimeline(now: Date()).entries.first ?? placeholder(in: context))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<EssentialsEntry>) -> Void) {
        completion(buildTimeline(now: Date()))
    }

    /**
     * Les quatre horaires d'un jour hébraïque.
     *
     * La fenêtre du jour va d'une chkia à la suivante : les trois horaires de
     * journée y tombent. Le tsét, lui, suit la chkia qui ferme la fenêtre,
     * donc il appartient déjà à la suivante : on va le chercher là, sans quoi
     * on afficherait celui de la veille, tombé au tout début de la fenêtre.
     */
    private func lines(_ payload: ZmanimPayload, day: ZmanimDay) -> [ZmanLine] {
        let daytime = payload.times.filter { day.from <= $0.epoch && $0.epoch < day.until }
        var times = Self.morningKeys.compactMap { key in daytime.first { $0.key == key } }
        if let tzeit = payload.times.first(where: { $0.key == "tzeit" && $0.epoch >= day.until }) {
            times.append(tzeit)
        }
        return times.map { ZmanLine(label: $0.label, time: $0.time) }
    }

    private func buildTimeline(now: Date) -> Timeline<EssentialsEntry> {
        guard let payload = loadPayload("zmanim", as: ZmanimPayload.self) else {
            return Timeline(entries: [.message(openAppFallback, at: now)], policy: .never)
        }
        // Les jours arrivent avec la v2 du payload ; sans eux, rien à border.
        let ms = now.timeIntervalSince1970 * 1000
        let upcoming = (payload.days ?? []).filter { $0.until > ms }

        var entries: [EssentialsEntry] = []
        for (i, day) in upcoming.enumerated() {
            let lines = lines(payload, day: day)
            if lines.isEmpty { continue }
            entries.append(EssentialsEntry(
                date: i == 0 ? now : Date(timeIntervalSince1970: day.from / 1000),
                place: payload.place,
                hebrewDate: day.hebrewDate,
                lines: lines,
                message: nil,
                accent: payload.accent))
        }
        if entries.isEmpty {
            // Surtout pas .atEnd : une timeline déjà finie serait redemandée
            // en boucle et grillerait le budget de rafraîchissement.
            return Timeline(
                entries: [.message(payload.stale, at: now, accent: payload.accent)], policy: .never)
        }
        return Timeline(entries: entries, policy: .atEnd)
    }
}

/// Une des quatre lignes : son libellé à gauche, son heure à droite, à
/// l'accent du thème comme toutes les heures de ces widgets. Les couleurs
/// viennent de l'appelant : les nôtres sur l'écran d'accueil, celles du
/// système sur l'écran verrouillé, qui n'en accepte pas d'autres.
struct EssentialRow: View {
    let line: ZmanLine
    let label: Color
    let time: Color
    let compact: Bool

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(line.label)
                .foregroundStyle(label)
            Spacer(minLength: 4)
            Text(line.time)
                .fontWeight(.semibold)
                .monospacedDigit()
                .foregroundStyle(time)
        }
        .font(compact ? .caption2 : .footnote)
        .lineLimit(1)
        .minimumScaleFactor(0.6)
    }
}

struct EssentialsWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: EssentialsEntry

    var body: some View {
        let accent = PjColors.accent(entry.accent)
        let home = isHomeScreen(family)
        VStack(alignment: .leading, spacing: 0) {
            // L'écran verrouillé n'a que 72 pt : les quatre lignes les
            // remplissent déjà, l'en-tête y serait de trop.
            if home {
                HStack(spacing: 6) {
                    Text(entry.hebrewDate)
                        .font(.caption.weight(.bold))
                    Spacer(minLength: 4)
                    Text(entry.place)
                        .font(.caption)
                }
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .foregroundStyle(PjColors.textSecondary)
            }
            if entry.lines.isEmpty {
                Spacer(minLength: 8)
                Text(entry.message ?? openAppFallback)
                    .font(home ? .footnote : .caption2)
                    .lineLimit(3)
                    .foregroundStyle(home ? PjColors.text : .primary)
                Spacer(minLength: 0)
            } else {
                Spacer(minLength: home ? 8 : 0)
                VStack(spacing: home ? 6 : 2) {
                    ForEach(entry.lines, id: \.self) { line in
                        EssentialRow(
                            line: line,
                            label: home ? PjColors.textSecondary : .secondary,
                            time: home ? accent : .primary,
                            compact: !home || family == .systemSmall)
                    }
                }
                Spacer(minLength: 0)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetURL(URL(string: "petitejerusalem://petite-jerusalem.fr/horaires"))
    }
}

struct EssentialsWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "EssentialsWidget", provider: EssentialsProvider()) { entry in
            EssentialsWidgetView(entry: entry).modifier(PjWidgetBackground())
        }
        .configurationDisplayName("Horaires essentiels")
        .description("Fin du Chéma et de la Amida, plag haMin'ha et tsét haKokhavim.")
        .supportedFamilies(supportedFamilies([.systemSmall, .systemMedium]))
    }
}

// MARK: - Lecture du jour

struct DailyItem: Decodable {
    let key: String
    let label: String
    let done: Bool
}

struct DailyPayload: Decodable {
    let v: Int
    let title: String
    let date: String
    /// Epoch ms du minuit local qui suit : au-delà, les `done` ne comptent plus.
    let expiresAt: Double
    let configured: Bool
    let emptyLabel: String
    let allDoneLabel: String
    let items: [DailyItem]
    let parasha: String?
    let parashaDone: Bool
    /// "{done} sur {total} lus aujourd'hui" ; absent des payloads d'avant.
    let progressTemplate: String?
    let accent: String?

    var expiryDate: Date { Date(timeIntervalSince1970: expiresAt / 1000) }
}

struct DailyEntry: TimelineEntry {
    let date: Date
    let payload: DailyPayload?
}

struct DailyProvider: TimelineProvider {
    func placeholder(in context: Context) -> DailyEntry {
        DailyEntry(date: Date(), payload: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (DailyEntry) -> Void) {
        completion(DailyEntry(date: Date(), payload: loadPayload("daily", as: DailyPayload.self)))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DailyEntry>) -> Void) {
        let now = Date()
        let payload = loadPayload("daily", as: DailyPayload.self)
        let entry = DailyEntry(date: now, payload: payload)
        // Redessin à l'échéance du payload (minuit local, calculé côté app) :
        // la vue re-filtre les coches, il suffit de rejouer le rendu. Échéance
        // passée ou payload absent : rien à attendre, le prochain push de
        // l'app rechargera la timeline.
        if let payload, payload.expiryDate > now {
            completion(Timeline(entries: [entry], policy: .after(payload.expiryDate.addingTimeInterval(1))))
        } else {
            completion(Timeline(entries: [entry], policy: .never))
        }
    }
}

/// La barre de progression de la carte du tableau de bord : un rail pâle,
/// une pastille pleine à la proportion lue. Les deux couleurs sont données
/// par l'appelant : l'accent du thème sur l'écran d'accueil, le blanc délavé
/// du système sur l'écran verrouillé, qui n'accepte pas d'autre couleur.
struct DailyProgressBar: View {
    let ratio: Double
    let fill: Color
    let rail: Color
    var height: CGFloat = 10

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                Capsule().fill(rail)
                if ratio > 0 {
                    // Jamais plus fine que haute : une pastille, pas un trait.
                    Capsule().fill(fill)
                        .frame(width: max(height, geometry.size.width * ratio))
                }
            }
        }
        .frame(height: height)
    }
}

/// Ce que la ligne affiche, une fois les coches confrontées à l'échéance.
struct DailyState {
    let line: String
    let ratio: Double
    /// Vrai quand tout est lu : la ligne passe au vert, comme dans l'app.
    let allDone: Bool
    /// Faux quand il n'y a rien à mesurer (liste vide, payload absent).
    let measurable: Bool
}

extension DailyState {
    static func of(_ payload: DailyPayload?, at instant: Date) -> DailyState {
        guard let payload else {
            return DailyState(line: openAppFallback, ratio: 0, allDone: false, measurable: false)
        }
        if !payload.configured {
            return DailyState(line: payload.emptyLabel, ratio: 0, allDone: false, measurable: false)
        }
        // Les coches ne valent que jusqu'au minuit local du payload, simple
        // comparaison d'epochs, aucun calendrier en jeu.
        let fresh = instant < payload.expiryDate
        // Chnei mikra seul : la paracha EST la lecture, son avancement fait la
        // progression, et il ne se remet pas à zéro chaque jour.
        if payload.items.isEmpty, let parasha = payload.parasha {
            return DailyState(
                line: parasha, ratio: payload.parashaDone ? 1 : 0, allDone: payload.parashaDone,
                measurable: true)
        }
        let total = payload.items.count
        let done = fresh ? payload.items.filter(\.done).count : 0
        if total == 0 {
            return DailyState(line: payload.emptyLabel, ratio: 0, allDone: false, measurable: false)
        }
        if done >= total {
            return DailyState(line: payload.allDoneLabel, ratio: 1, allDone: true, measurable: true)
        }
        // Le gabarit porte ses sentinelles : l'app ne peut pas interpoler des
        // nombres qu'elle ne connaît qu'ici (les coches dépendent de l'heure).
        let template = payload.progressTemplate ?? "{done}/{total}"
        let line = template
            .replacingOccurrences(of: "{done}", with: "\(done)")
            .replacingOccurrences(of: "{total}", with: "\(total)")
        return DailyState(
            line: line, ratio: Double(done) / Double(total), allDone: false, measurable: true)
    }
}

struct LectureWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: DailyEntry

    var body: some View {
        let state = DailyState.of(entry.payload, at: entry.date)
        Group {
            if isHomeScreen(family) { home(state) } else { accessory(state) }
        }
        .widgetURL(URL(string: "petitejerusalem://petite-jerusalem.fr/bibliotheque/lecture-du-jour"))
    }

    /// Écran verrouillé : le titre, la ligne de progression et sa barre, sans
    /// pourcentage ni chevron, que 72 pt de haut ne portent pas. Le vert de
    /// « tout est lu » disparaît aussi : le système y délave les couleurs.
    private func accessory(_ state: DailyState) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(entry.payload?.title ?? "Lecture du jour")
                .font(.caption2.weight(.semibold))
                .lineLimit(1)
            Text(state.line)
                .font(.caption2)
                .lineLimit(state.measurable ? 1 : 3)
            if state.measurable {
                DailyProgressBar(
                    ratio: state.ratio, fill: .primary, rail: .primary.opacity(0.3), height: 5)
            }
        }
        .minimumScaleFactor(0.7)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private func home(_ state: DailyState) -> some View {
        let payload = entry.payload
        let accent = PjColors.accent(payload?.accent)

        // Une ligne, le dessin de la carte du tableau de bord : titre et
        // chevron, progression et pourcentage, barre. Les écarts sont ceux de
        // la carte (16 pt sous le titre, 8 pt au-dessus de la barre) ; les
        // corps, eux, sont ceux d'un widget, plus grands que sur la carte :
        // à trois lignes fines, un format moyen sonnait vide.
        return VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 10) {
                Image(systemName: "book")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(accent)
                Text(payload?.title ?? "Lecture du jour")
                    .font(.title3.weight(.bold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .foregroundStyle(PjColors.text)
                Spacer(minLength: 4)
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(PjColors.textSecondary.opacity(0.6))
            }

            if state.measurable {
                Spacer().frame(height: 16)
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(state.line)
                        .font(.subheadline.weight(.medium))
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                        .foregroundStyle(state.allDone ? PjColors.success : PjColors.text)
                    Spacer(minLength: 4)
                    Text("\(Int((state.ratio * 100).rounded()))%")
                        .font(.subheadline.weight(.semibold))
                        .monospacedDigit()
                        .foregroundStyle(accent)
                }
                Spacer().frame(height: 8)
                DailyProgressBar(ratio: state.ratio, fill: accent, rail: accent.opacity(0.15))
            } else {
                Spacer().frame(height: 12)
                Text(state.line)
                    .font(.subheadline)
                    .lineLimit(3)
                    .foregroundStyle(PjColors.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

struct LectureWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "LectureWidget", provider: DailyProvider()) { entry in
            LectureWidgetView(entry: entry).modifier(PjWidgetBackground())
        }
        .configurationDisplayName("Lecture du jour")
        .description("Votre lecture quotidienne et sa progression.")
        // Une ligne : le carré n'a pas la largeur qu'il faut à la barre et à
        // son pourcentage, seul le format moyen porte ce dessin sur l'écran
        // d'accueil ; l'écran verrouillé a le sien, plus dépouillé.
        .supportedFamilies(supportedFamilies([.systemMedium]))
    }
}

// MARK: - Raccourcis

/**
 * Cinq tuiles qui n'ouvrent qu'une page : la bibliothèque, le sidour, les
 * horaires, les Tehilim, la lecture du jour. Le plus petit format que l'écran
 * d'accueil propose (`.systemSmall`), sauf la bibliothèque, à qui son étagère
 * vaut un format moyen.
 *
 * Trois d'entre elles ne montrent qu'un livre : c'est le dessin de l'étagère
 * de `src/components/LibraryShelf.vue`, porté ici trait pour trait.
 */

/**
 * Les couleurs de l'étagère, celles de LibraryShelf.vue. Elles sont
 * volontairement hors du thème de l'utilisateur, et identiques en mode
 * sombre : des teintes chaudes et mates, comme de vrais objets posés là.
 */
enum ShelfColors {
    /// Une reliure par volume, toutes de la même famille.
    static let bindings = [
        "tehilim": "#96604A", "michna": "#7D6A4C", "talmud": "#6D5743",
        "tanakh": "#84483F", "sidour": "#6E4551", "slihot": "#7A5C36",
        "brahot": "#5F6249",
    ]

    static func binding(_ corpus: String) -> Color {
        PjColors.fixed(bindings[corpus] ?? "#7D6A4C")
    }

    /// Le crème du cadre estampé, et le titre comme doré à chaud.
    static let stamp = PjColors.fixed("#ECDFC4")
    static let title = PjColors.fixed("#F3EAD6")
    /// La tranche des pages, ivoire, et les filets qui la rayent.
    static let pages = PjColors.fixed("#EFE5D0")
    static let pageLines = PjColors.fixed("#D6C8AB")
    /// La planche, en bois clair ; elle s'assombrit la nuit, comme dans l'app.
    static let board = LinearGradient(
        colors: [
            PjColors.adaptive(light: "#C3A87F", dark: "#8A7354"),
            PjColors.adaptive(light: "#A98C62", dark: "#6E5A40"),
        ],
        startPoint: .top, endPoint: .bottom)
}

/**
 * Un livre relié de l'étagère : reliure chaude, pli du dos, tranche de pages
 * ivoire qui dépasse à droite, cadre estampé à double filet, titre horizontal
 * en serif et son ornement.
 *
 * Les coordonnées sont celles du SVG d'origine, dans son carton de 96 sur 140,
 * ramenées à la largeur demandée : le dessin tient à toutes les tailles.
 */
struct ShelfBookView: View {
    let title: String
    let corpus: String
    /// Largeur du livre ; la hauteur suit le rapport du carton d'origine.
    let width: CGFloat
    /// Sous quelques dizaines de points, le titre ne se lit plus : on le tait
    /// plutôt que d'en faire une tache.
    var showsTitle = true

    /// Le rapport hauteur / largeur du dessin d'origine.
    static let ratio: CGFloat = 140 / 96

    /// Une unité du carton d'origine, à l'échelle demandée.
    private var u: CGFloat { width / 96 }

    var body: some View {
        ZStack(alignment: .topLeading) {
            // Tranche des pages, ivoire, qui dépasse à droite, et ses filets.
            plate(84, 6, 9, 128, 2, ShelfColors.pages)
            plate(87, 10, 0.8, 120, 0, ShelfColors.pageLines)
            plate(90, 10, 0.8, 120, 0, ShelfColors.pageLines)
            // Couverture, pli de la reliure côté dos, et sa ligne de lumière.
            plate(3, 3, 84, 134, 4, ShelfColors.binding(corpus))
            plate(3, 3, 7, 134, 3.5, Color.black.opacity(0.16))
            plate(12, 5, 1, 130, 0, Color.white.opacity(0.1))
            plate(3, 3, 84, 134, 4, LinearGradient(
                stops: [
                    .init(color: .white.opacity(0.09), location: 0),
                    .init(color: .white.opacity(0.02), location: 0.45),
                    .init(color: .black.opacity(0.06), location: 1),
                ],
                startPoint: .top, endPoint: .bottom))
            // Cadre estampé, double filet crème.
            stroked(18, 14, 62, 112, 1.5, 1.4, 0.55)
            stroked(22.5, 18.5, 53, 103, 1, 0.7, 0.3)
            if showsTitle {
                Text(title)
                    .font(.system(size: 13.5 * u, weight: .semibold, design: .serif))
                    .foregroundStyle(ShelfColors.title)
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                    .frame(width: 62 * u, height: 26 * u)
                    .offset(x: 18 * u, y: 49 * u)
                ornament
            }
        }
        // Le ZStack se dimensionne sur la couverture seule (un `offset` ne
        // compte pas dans la mise en page) : sans `topLeading`, le cadre le
        // recentrerait et tout le dessin glisserait de quelques points.
        .frame(width: width, height: width * Self.ratio, alignment: .topLeading)
    }

    /// La fine ornementation sous le titre : deux filets et un losange.
    /// Un `Group` et non un `ZStack` : ses trois éléments doivent être posés
    /// par le ZStack du livre, à ses coordonnées à lui.
    @ViewBuilder private var ornament: some View {
        plate(35, 79.5, 11, 1, 0, ShelfColors.stamp.opacity(0.5))
        plate(52, 79.5, 11, 1, 0, ShelfColors.stamp.opacity(0.5))
        Rectangle()
            .fill(ShelfColors.stamp.opacity(0.5))
            .frame(width: 3.7 * u, height: 3.7 * u)
            .rotationEffect(.degrees(45))
            .offset(x: 47.15 * u, y: 78.15 * u)
    }

    /// Un rectangle plein, aux coordonnées du dessin d'origine.
    private func plate<S: ShapeStyle>(
        _ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ radius: CGFloat, _ style: S
    ) -> some View {
        RoundedRectangle(cornerRadius: radius * u, style: .continuous)
            .fill(style)
            .frame(width: w * u, height: h * u)
            .offset(x: x * u, y: y * u)
    }

    /// Un rectangle au trait, pour les filets du cadre estampé.
    private func stroked(
        _ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ radius: CGFloat,
        _ lineWidth: CGFloat, _ opacity: Double
    ) -> some View {
        RoundedRectangle(cornerRadius: radius * u, style: .continuous)
            .stroke(ShelfColors.stamp.opacity(opacity), lineWidth: lineWidth * u)
            .frame(width: w * u, height: h * u)
            .offset(x: x * u, y: y * u)
    }
}

/// La planche de l'étagère, en bois clair, sous les livres.
struct ShelfBoardView: View {
    var body: some View {
        RoundedRectangle(cornerRadius: 3, style: .continuous)
            .fill(ShelfColors.board)
            .frame(height: 6)
    }
}

// MARK: - Raccourcis : les libellés

struct LibraryBook: Decodable {
    let corpus: String
    let label: String
}

struct LibraryPayload: Decodable {
    let v: Int
    let title: String
    let books: [LibraryBook]

    func book(_ corpus: String) -> LibraryBook? { books.first { $0.corpus == corpus } }
}

/**
 * Repli avant le premier lancement, quand l'app n'a encore rien poussé. Ces
 * titres restent en français, comme les autres ressources natives (le
 * sélecteur de widgets, « ouvrez l'app ») : dès le premier lancement, le
 * payload les remplace par ceux de la langue choisie.
 */
enum ShortcutFallback {
    static let library = "Bibliothèque"
    static let sidour = "Sidour"
    static let tehilim = "Tehilim"
    static let daily = "Lecture du jour"
    static let zmanim = "Horaires"
}

struct LibraryEntry: TimelineEntry {
    let date: Date
    let payload: LibraryPayload?
}

/// Rien à replanifier : des libellés qui ne changent qu'avec la langue de
/// l'app, et c'est l'app qui recharge alors les timelines.
struct LibraryProvider: TimelineProvider {
    func placeholder(in context: Context) -> LibraryEntry {
        LibraryEntry(date: Date(), payload: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (LibraryEntry) -> Void) {
        completion(LibraryEntry(date: Date(), payload: loadPayload("library", as: LibraryPayload.self)))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<LibraryEntry>) -> Void) {
        completion(Timeline(
            entries: [LibraryEntry(date: Date(), payload: loadPayload("library", as: LibraryPayload.self))],
            policy: .never))
    }
}

// MARK: - Raccourci : la bibliothèque

struct LibraryWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: LibraryEntry

    /// L'étagère du widget : les quatre volumes d'étude, dans l'ordre de la
    /// page. Le sidour et les Tehilim ont chacun leur propre raccourci.
    private static let shelf = ["tehilim", "michna", "talmud", "tanakh"]

    var body: some View {
        let medium = family != .systemSmall
        // Le petit format n'a pas la largeur de quatre titres lisibles : il
        // montre trois volumes muets, l'étagère se reconnaît à sa silhouette.
        let corpora = medium ? Self.shelf : Array(Self.shelf.prefix(3))
        // Largeurs comptées pour tenir dans la hauteur, qui est la même aux
        // deux formats : quatre livres de 62 pt font 90 pt de haut, plus le
        // titre et la planche, il reste de la marge sur les 132 utiles.
        let gap: CGFloat = medium ? 8 : 6
        let width: CGFloat = medium ? 62 : 38

        VStack(spacing: 0) {
            Text(entry.payload?.title ?? ShortcutFallback.library)
                .font(medium ? .subheadline.weight(.bold) : .caption.weight(.bold))
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .foregroundStyle(PjColors.text)
            Spacer(minLength: 8)
            VStack(spacing: 3) {
                HStack(alignment: .bottom, spacing: gap) {
                    ForEach(corpora, id: \.self) { corpus in
                        ShelfBookView(
                            title: entry.payload?.book(corpus)?.label ?? "",
                            corpus: corpus,
                            width: width,
                            showsTitle: medium)
                    }
                }
                ShelfBoardView().frame(width: CGFloat(corpora.count) * width
                    + CGFloat(corpora.count - 1) * gap + 10)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .widgetURL(URL(string: "petitejerusalem://petite-jerusalem.fr/bibliotheque"))
    }
}

struct LibraryWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "LibraryWidget", provider: LibraryProvider()) { entry in
            LibraryWidgetView(entry: entry).modifier(PjWidgetBackground())
        }
        .configurationDisplayName("Bibliothèque")
        .description("Ouvrir la bibliothèque.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Raccourcis : un livre, un corpus

/// Un raccourci qui n'est qu'un livre, posé sur sa planche : le titre est
/// écrit sur la couverture, il n'a rien à ajouter dessous.
struct BookShortcutView: View {
    let entry: LibraryEntry
    let corpus: String
    let fallbackTitle: String
    let path: String

    var body: some View {
        VStack(spacing: 4) {
            Spacer(minLength: 0)
            ShelfBookView(
                title: entry.payload?.book(corpus)?.label ?? fallbackTitle,
                corpus: corpus,
                width: 78)
            ShelfBoardView().frame(width: 88)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .widgetURL(URL(string: "petitejerusalem://petite-jerusalem.fr\(path)"))
    }
}

struct SidourWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "SidourWidget", provider: LibraryProvider()) { entry in
            BookShortcutView(
                entry: entry, corpus: "sidour", fallbackTitle: ShortcutFallback.sidour,
                path: "/bibliotheque/sidour")
                .modifier(PjWidgetBackground())
        }
        .configurationDisplayName("Sidour")
        .description("Ouvrir le sidour.")
        .supportedFamilies([.systemSmall])
    }
}

struct TehilimWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "TehilimWidget", provider: LibraryProvider()) { entry in
            BookShortcutView(
                entry: entry, corpus: "tehilim", fallbackTitle: ShortcutFallback.tehilim,
                path: "/bibliotheque/tehilim")
                .modifier(PjWidgetBackground())
        }
        .configurationDisplayName("Tehilim")
        .description("Ouvrir les Tehilim.")
        .supportedFamilies([.systemSmall])
    }
}

// MARK: - Raccourci : les horaires

/// L'heure du prochain zman, en grand, et rien d'autre : son nom en dessous
/// dit seulement de quelle heure il s'agit. Il partage la timeline du widget
/// Horaires, qui se replanifie déjà à chaque zman passé.
struct ZmanimShortcutView: View {
    let entry: ZmanimEntry

    var body: some View {
        let accent = PjColors.accent(entry.accent)
        VStack(spacing: 2) {
            Spacer(minLength: 0)
            if let next = entry.next {
                Text(next.time)
                    .font(.system(size: 42, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .minimumScaleFactor(0.6)
                    .foregroundStyle(accent)
                Text(next.label)
                    .font(.caption2)
                    .foregroundStyle(PjColors.textSecondary)
            } else {
                Text(entry.message ?? openAppFallback)
                    .font(.caption)
                    .multilineTextAlignment(.center)
                    .lineLimit(4)
                    .foregroundStyle(PjColors.text)
            }
            Spacer(minLength: 0)
        }
        .lineLimit(1)
        .minimumScaleFactor(0.6)
        .padding(.horizontal, 2)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .widgetURL(URL(string: "petitejerusalem://petite-jerusalem.fr/horaires"))
    }
}

struct ZmanimShortcutWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "ZmanimShortcutWidget", provider: ZmanimProvider()) { entry in
            ZmanimShortcutView(entry: entry).modifier(PjWidgetBackground())
        }
        .configurationDisplayName("Prochain horaire")
        .description("L'heure du prochain zman, et rien d'autre.")
        .supportedFamilies([.systemSmall])
    }
}

// MARK: - Raccourci : la lecture du jour

/// L'anneau de progression : le même rapport que la barre de la carte, mais
/// refermé sur lui-même, pour tenir dans la plus petite tuile.
struct DailyProgressRing: View {
    let ratio: Double
    let accent: Color
    let lineWidth: CGFloat

    var body: some View {
        ZStack {
            Circle().stroke(accent.opacity(0.15), lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: max(0, min(1, ratio)))
                .stroke(accent, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                // L'anneau part du haut, pas de la droite.
                .rotationEffect(.degrees(-90))
        }
    }
}

struct LectureShortcutView: View {
    let entry: DailyEntry

    var body: some View {
        let state = DailyState.of(entry.payload, at: entry.date)
        let accent = PjColors.accent(entry.payload?.accent)
        VStack(spacing: 10) {
            Spacer(minLength: 0)
            ZStack {
                DailyProgressRing(ratio: state.measurable ? state.ratio : 0,
                                  accent: accent, lineWidth: 9)
                if state.measurable {
                    Text("\(Int((state.ratio * 100).rounded()))%")
                        .font(.system(size: 22, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .minimumScaleFactor(0.6)
                        .foregroundStyle(state.allDone ? PjColors.success : PjColors.text)
                } else {
                    // Liste non composée : l'anneau reste vide, le livre dit
                    // de quoi il s'agit, et le message est l'affaire du grand
                    // widget, qui a la place de l'écrire.
                    Image(systemName: "book")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(accent)
                }
            }
            .frame(width: 78, height: 78)
            Text(entry.payload?.title ?? ShortcutFallback.daily)
                .font(.caption.weight(.semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .foregroundStyle(PjColors.text)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .widgetURL(URL(string: "petitejerusalem://petite-jerusalem.fr/bibliotheque/lecture-du-jour"))
    }
}

struct LectureShortcutWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "LectureShortcutWidget", provider: DailyProvider()) { entry in
            LectureShortcutView(entry: entry).modifier(PjWidgetBackground())
        }
        .configurationDisplayName("Avancement de la lecture")
        .description("Un anneau qui se remplit au fil de votre lecture du jour.")
        .supportedFamilies([.systemSmall])
    }
}

// MARK: - Bundle

@main
struct PjWidgetsBundle: WidgetBundle {
    var body: some Widget {
        HorairesWidget()
        EssentialsWidget()
        LectureWidget()
        shortcuts
    }

    /// Les raccourcis, groupés à part : @WidgetBundleBuilder ne prend qu'un
    /// nombre limité de widgets à la file, et un sous-groupe lève la limite.
    @WidgetBundleBuilder private var shortcuts: some Widget {
        LibraryWidget()
        SidourWidget()
        TehilimWidget()
        ZmanimShortcutWidget()
        LectureShortcutWidget()
    }
}
