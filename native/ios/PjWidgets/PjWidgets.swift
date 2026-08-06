import SwiftUI
import WidgetKit

/**
 * Widgets iOS « Horaires » et « Lecture du jour » (pendant des providers
 * Android de native/android/).
 *
 * Tout le contenu vient des payloads JSON poussés par l'app via
 * PjWidgetsPlugin dans l'App Group (contrat : src/services/widgetPayloads.ts,
 * libellés déjà localisés). Les widgets ne calculent rien :
 * - Horaires : une entrée de timeline par zman de la fenêtre embarquée (7 j),
 *   WidgetKit affiche donc toujours le prochain horaire sans réveiller l'app ;
 * - Lecture : une entrée maintenant + une à minuit (les coches sont
 *   quotidiennes, le widget repart de zéro sans rouvrir l'app).
 *
 * Fichier à ajouter à la cible d'extension « PjWidgets » du projet Xcode
 * (généré, non versionné) — voir docs/app-widgets.md.
 */

let appGroup = "group.fr.petitejerusalem.app"

func loadPayload<T: Decodable>(_ key: String, as type: T.Type) -> T? {
    guard let raw = UserDefaults(suiteName: appGroup)?.string(forKey: key),
          let data = raw.data(using: .utf8)
    else { return nil }
    return try? JSONDecoder().decode(T.self, from: data)
}

// MARK: - Horaires

struct ZmanTime: Decodable {
    let key: String
    let label: String
    /// Epoch en millisecondes (Date.getTime() côté JS).
    let epoch: Double

    var date: Date { Date(timeIntervalSince1970: epoch / 1000) }
}

struct ZmanimPayload: Decodable {
    let v: Int
    let title: String
    let place: String
    let tzid: String
    let stale: String
    let times: [ZmanTime]
}

struct ZmanimEntry: TimelineEntry {
    let date: Date
    let payload: ZmanimPayload?
    /// Le prochain horaire à l'instant `date`, nil quand la fenêtre est épuisée.
    let next: ZmanTime?
    let following: ZmanTime?
}

struct ZmanimProvider: TimelineProvider {
    func placeholder(in context: Context) -> ZmanimEntry {
        ZmanimEntry(date: Date(), payload: nil, next: nil, following: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (ZmanimEntry) -> Void) {
        completion(entry(at: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ZmanimEntry>) -> Void) {
        guard let payload = loadPayload("zmanim", as: ZmanimPayload.self) else {
            // Pas encore de payload : on retentera quand l'app en poussera un.
            completion(Timeline(entries: [entry(at: Date())], policy: .never))
            return
        }
        let now = Date()
        // Une entrée par zman à venir : chacune affiche le zman suivant.
        var entries: [ZmanimEntry] = [entry(at: now, payload: payload)]
        for time in payload.times where time.date > now {
            entries.append(entry(at: time.date.addingTimeInterval(1), payload: payload))
        }
        completion(Timeline(entries: entries, policy: .atEnd))
    }

    private func entry(at date: Date, payload: ZmanimPayload? = nil) -> ZmanimEntry {
        let payload = payload ?? loadPayload("zmanim", as: ZmanimPayload.self)
        let upcoming = payload?.times.filter { $0.date > date } ?? []
        return ZmanimEntry(
            date: date,
            payload: payload,
            next: upcoming.first,
            following: upcoming.count > 1 ? upcoming[1] : nil
        )
    }
}

struct HorairesWidgetView: View {
    let entry: ZmanimEntry

    private var timeFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        formatter.timeZone = TimeZone(identifier: entry.payload?.tzid ?? "Europe/Paris")
        return formatter
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(entry.payload?.title ?? "Horaires")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.secondary)
                Spacer()
                Text(entry.payload?.place ?? "")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            if let next = entry.next {
                Text(next.label)
                    .font(.footnote)
                    .lineLimit(2)
                Text(timeFormatter.string(from: next.date))
                    .font(.system(size: 30, weight: .bold, design: .rounded))
                if let following = entry.following {
                    Text("Puis \(following.label) à \(timeFormatter.string(from: following.date))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            } else {
                Spacer()
                Text(entry.payload?.stale ?? "Ouvrez Petite Jérusalem pour préparer le widget")
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
    /// Jour civil local (YYYY-MM-DD) auquel les `done` se rapportent.
    let date: String
    let configured: Bool
    let emptyLabel: String
    let allDoneLabel: String
    let items: [DailyItem]
    let parasha: String?
    let parashaDone: Bool
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
        let entry = DailyEntry(date: now, payload: loadPayload("daily", as: DailyPayload.self))
        // À minuit, les coches du jour ne valent plus : la vue re-filtre par
        // date, il suffit de redessiner.
        var midnight = Calendar.current.startOfDay(for: now)
        midnight = Calendar.current.date(byAdding: .day, value: 1, to: midnight) ?? now
        completion(Timeline(entries: [entry], policy: .after(midnight)))
    }
}

struct LectureWidgetView: View {
    let entry: DailyEntry

    /// Les coches ne comptent que si le payload couvre le jour affiché.
    private var isFresh: Bool {
        guard let payload = entry.payload else { return false }
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: entry.date) == payload.date
    }

    var body: some View {
        let payload = entry.payload
        let doneCount = isFresh ? (payload?.items.filter { $0.done }.count ?? 0) : 0
        let nextItem = payload?.items.first { !(isFresh && $0.done) }

        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(payload?.title ?? "Lecture du jour")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.secondary)
                Spacer()
                if let payload, payload.configured {
                    Text("\(doneCount)/\(payload.items.count)")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.secondary)
                }
            }
            if let payload {
                if !payload.configured {
                    Text(payload.emptyLabel).font(.footnote)
                } else {
                    Text(nextItem?.label ?? payload.allDoneLabel)
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(2)
                }
                if let parasha = payload.parasha {
                    Text(payload.parashaDone ? "\(parasha) ✓" : parasha)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            } else {
                Text("Ouvrez Petite Jérusalem pour préparer le widget").font(.footnote)
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
