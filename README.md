# Petite Jérusalem

Petite Jerusalem is a web application developed with VueJs, allowing users to create and join religious text study chains.
The goal is to create a platform that centralizes several useful "apps" for the Jewish community.

## 🚀 Features

- **Authentication**: Secure login (via Firebase).
- **Session Management**: Create, view, and manage study sessions (Limoud).
- **Text Reservation**: Users can reserve parts of texts to study.
- **Internationalization (i18n)**: Multi-language support (French, English, Hebrew).
- **Modern Interface**: Responsive and polished design with TailwindCSS.

## 🛠️ Tech Stack

- **Front-end Framework**: [Vue 3](https://vuejs.org/) (Composition API)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styles**: [TailwindCSS](https://tailwindcss.com/)
- **Backend / Auth**: [Firebase](https://firebase.google.com/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Tests**: [Vitest](https://vitest.dev/)

## 📦 Installation

To run the project locally:

1. **Clone the repository**

   ```bash
   git clone git@github.com:Phenixel/PetiteJerusalem.git
   cd petite-jerusalem
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start the development server**

   ```bash
   npm run dev
   ```

   > ⚠️ With `npm run dev` alone, the app talks to the **local Firebase
   > emulators** (see below). Without them running, login and session
   > creation will fail. Use `npm run dev:local` to start everything at once.

### 🔥 Local Firebase (emulators)

In development the app automatically connects to the Firebase **Auth** and
**Firestore** emulators (see `firebase.ts`), so you can sign up, log in and
create sessions entirely offline, with no access to the cloud project needed.

**Prerequisites**

- **Node 22**, required by the Firebase CLI. The repo ships a `.nvmrc`:
  ```bash
  nvm use        # switches to Node 22
  ```
- **Java (JDK 21+)**, required by the Firestore emulator (`java -version`). On
  macOS the `npm run emulators` script auto-selects an installed JDK 21+ if your
  `JAVA_HOME`/`PATH` points at an older one (e.g. a pinned `openjdk@11`).
- **Firebase CLI**:
  ```bash
  npm install -g firebase-tools
  ```

**Run the app + emulators together**

```bash
npm run dev:local
```

This runs the Vite dev server and the emulators in parallel. Then:

- App: http://localhost:5473
- Emulator UI (inspect Firestore data & Auth users): http://localhost:8473
- Auth emulator: `localhost:8471` · Firestore emulator: `localhost:8470`

> This project uses a **dedicated port range** (`5473` for Vite, `8470`–`8476`
> for the emulators) instead of the Firebase/Vite defaults, so it can run in
> parallel with other Firebase projects without port clashes. The ports live in
> `firebase.json` (`emulators` block) and `firebase.ts` (client `connect*Emulator`
> calls) — keep the two in sync. On startup the emulator script also reaps any
> orphaned emulator left holding one of these ports, and on exit it shuts the
> emulators down cleanly so none is orphaned.

**Create your first session locally**

1. Open the app, go to **Login → Register**, and create an account with any
   email/password (the Auth emulator accepts anything, no real email needed).
2. Once logged in, create a session as usual.

Data created in the emulators is **persisted** to `./.emulator-data` on exit
(`Ctrl+C`) and re-imported on the next start, so your test sessions survive
restarts. You can also start only the emulators with `npm run emulators`.

4. **Verify code (Lint & Type-check)**

   ```bash
   npm run verify
   ```

5. **Format code**
   ```bash
   npm run format
   ```

## 🤝 Contribution

Contributions are welcome! Please check the [CONTRIBUTING.md](CONTRIBUTING.md) file for more details on how to contribute to the project.

## 📄 License

This project is licensed under the **Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)**.
You are **not** allowed to use this code for commercial purposes.
See the [LICENSE](LICENSE) file for more details.
