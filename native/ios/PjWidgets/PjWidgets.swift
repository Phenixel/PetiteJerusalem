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
        let accent = PjColors.accent(entry.accent)
        VStack(alignment: .leading, spacing: 0) {
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
        .widgetURL(URL(string: "petitejerusalem://petite-jerusalem.fr/horaires"))
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
            if #available(iOS 17.0, *) {
                HorairesWidgetView(entry: entry)
                    .containerBackground(for: .widget) { PjColors.background }
            } else {
                HorairesWidgetView(entry: entry).padding().background(PjColors.background)
            }
        }
        .configurationDisplayName("Horaires")
        .description("Le prochain horaire (zman) de votre journée.")
        .supportedFamilies([.systemSmall, .systemMedium])
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

/// La barre de progression de la carte du tableau de bord : un rail à
/// l'accent très pâli, une pastille pleine à la proportion lue.
struct DailyProgressBar: View {
    let ratio: Double
    let accent: Color

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                Capsule().fill(accent.opacity(0.15))
                if ratio > 0 {
                    // Jamais plus fine que haute : une pastille, pas un trait.
                    Capsule().fill(accent).frame(width: max(10, geometry.size.width * ratio))
                }
            }
        }
        .frame(height: 10)
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
    let entry: DailyEntry

    var body: some View {
        let payload = entry.payload
        let state = DailyState.of(payload, at: entry.date)
        let accent = PjColors.accent(payload?.accent)

        // Une ligne, le dessin de la carte du tableau de bord : titre et
        // chevron, progression et pourcentage, barre. Les écarts sont ceux de
        // la carte (16 pt sous le titre, 8 pt au-dessus de la barre) ; les
        // corps, eux, sont ceux d'un widget, plus grands que sur la carte :
        // à trois lignes fines, un format moyen sonnait vide.
        VStack(alignment: .leading, spacing: 0) {
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
                DailyProgressBar(ratio: state.ratio, accent: accent)
            } else {
                Spacer().frame(height: 12)
                Text(state.line)
                    .font(.subheadline)
                    .lineLimit(3)
                    .foregroundStyle(PjColors.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .widgetURL(URL(string: "petitejerusalem://petite-jerusalem.fr/bibliotheque/lecture-du-jour"))
    }
}

struct LectureWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "LectureWidget", provider: DailyProvider()) { entry in
            if #available(iOS 17.0, *) {
                LectureWidgetView(entry: entry)
                    .containerBackground(for: .widget) { PjColors.background }
            } else {
                LectureWidgetView(entry: entry).padding().background(PjColors.background)
            }
        }
        .configurationDisplayName("Lecture du jour")
        .description("Votre lecture quotidienne et sa progression.")
        // Une ligne : le carré n'a pas la largeur qu'il faut à la barre et à
        // son pourcentage, seul le format moyen porte ce dessin.
        .supportedFamilies([.systemMedium])
    }
}

// MARK: - Bundle

@main
struct PjWidgetsBundle: WidgetBundle {
    var body: some Widget {
        HorairesWidget()
        LectureWidget()
    }
}
