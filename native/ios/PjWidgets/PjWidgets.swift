import SwiftUI
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
 * epochs, rien d'autre.
 *
 * - Horaires : une entrée de timeline par zman à venir (fenêtre bornée, les
 *   entrées ne portent que leurs chaînes, pas le payload entier) ; fenêtre
 *   épuisée → une entrée « rouvrez l'app » en .never, l'app relancera tout au
 *   prochain push.
 * - Lecture : une entrée maintenant, redessin à l'échéance du payload
 *   (expiresAt, minuit local calculé côté app).
 *
 * Fichier à ajouter à la cible d'extension « PjWidgets » du projet Xcode
 * (généré, non versionné), voir docs/app-widgets.md.
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
    let nextLabel: String?
    let nextTime: String?
    /// Fenêtre épuisée ou payload absent : message à afficher seul.
    let message: String?
}

extension ZmanimEntry {
    /// L'entrée vide : un message seul, sans jour ni horaire.
    static func message(_ text: String, at date: Date, place: String = "") -> ZmanimEntry {
        ZmanimEntry(
            date: date, place: place, hebrewDate: "", parasha: nil, tachanun: nil,
            tachanunStrong: false, nextLabel: nil, nextTime: nil, message: text)
    }
}

struct ZmanimProvider: TimelineProvider {
    /// Nombre maximal d'entrées par timeline (~3 jours de zmanim) : WidgetKit
    /// redemande la suite en fin de timeline (.atEnd), inutile d'archiver plus.
    static let maxEntries = 45

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
                entries: [.message(payload.stale, at: now, place: payload.place)],
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
            entries.append(ZmanimEntry(
                date: at,
                place: payload.place,
                hebrewDate: day?.hebrewDate ?? "",
                parasha: day?.parasha,
                tachanun: day?.tachanun,
                tachanunStrong: day?.tachanunStrong ?? false,
                nextLabel: next.label,
                nextTime: next.time,
                message: nil))
        }
        return Timeline(entries: entries, policy: .atEnd)
    }
}

struct HorairesWidgetView: View {
    let entry: ZmanimEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(entry.hebrewDate)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                Spacer()
                Text(entry.place)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            if let label = entry.nextLabel, let time = entry.nextTime {
                Text(label)
                    .font(.footnote)
                    .lineLimit(2)
                Text(time)
                    .font(.system(size: 30, weight: .bold, design: .rounded))
                if let parasha = entry.parasha {
                    Text(parasha)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                if let tachanun = entry.tachanun {
                    // Les jours sans tahanoun se repèrent d'un coup d'œil.
                    Text(tachanun)
                        .font(entry.tachanunStrong ? .caption.weight(.bold) : .caption)
                        .foregroundStyle(entry.tachanunStrong ? .primary : .secondary)
                        .lineLimit(1)
                }
            } else {
                Spacer()
                Text(entry.message ?? openAppFallback)
                    .font(.footnote)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetURL(URL(string: "petitejerusalem://petite-jerusalem.fr/horaires"))
    }
}

struct HorairesWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "HorairesWidget", provider: ZmanimProvider()) { entry in
            if #available(iOS 17.0, *) {
                HorairesWidgetView(entry: entry).containerBackground(.background, for: .widget)
            } else {
                HorairesWidgetView(entry: entry).padding()
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

struct LectureWidgetView: View {
    let entry: DailyEntry

    var body: some View {
        // Les coches ne valent que jusqu'au minuit local du payload, simple
        // comparaison d'epochs, aucun calendrier en jeu.
        let payload = entry.payload
        let isFresh = payload.map { entry.date < $0.expiryDate } ?? false
        let doneCount = isFresh ? (payload?.items.filter { $0.done }.count ?? 0) : 0
        let nextItem = payload?.items.first { !(isFresh && $0.done) }
        let parashaLine = payload?.parasha.map { payload!.parashaDone ? "\($0) ✓" : $0 }
        // Chnei mikra seul : la paracha EST la lecture, pas de décompte quotidien.
        let parashaOnly = (payload?.configured ?? false) && payload?.items.isEmpty == true

        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(payload?.title ?? "Lecture du jour")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.secondary)
                Spacer()
                if let payload, payload.configured, !parashaOnly {
                    Text("\(doneCount)/\(payload.items.count)")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.secondary)
                }
            }
            if let payload {
                if !payload.configured {
                    Text(payload.emptyLabel).font(.footnote)
                } else if parashaOnly {
                    Text(parashaLine ?? payload.emptyLabel)
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(2)
                } else {
                    Text(nextItem?.label ?? payload.allDoneLabel)
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(2)
                    if let parashaLine {
                        Text(parashaLine)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
            } else {
                Text(openAppFallback).font(.footnote)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetURL(URL(string: "petitejerusalem://petite-jerusalem.fr/bibliotheque/lecture-du-jour"))
    }
}

struct LectureWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "LectureWidget", provider: DailyProvider()) { entry in
            if #available(iOS 17.0, *) {
                LectureWidgetView(entry: entry).containerBackground(.background, for: .widget)
            } else {
                LectureWidgetView(entry: entry).padding()
            }
        }
        .configurationDisplayName("Lecture du jour")
        .description("Votre lecture quotidienne et sa progression.")
        .supportedFamilies([.systemSmall, .systemMedium])
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
