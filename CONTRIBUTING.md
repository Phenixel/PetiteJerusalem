# Contributing Guide

Thank you for your interest in **Petite Jérusalem**! We appreciate your help in improving this platform for the community.

## 🚀 How to Contribute?

### Report a Bug

If you find a bug, please let us know! You have two options:

1. **GitHub Issues**: Open an "Issue" describing what you did, what you expected, and what actually happened.
2. **Notion Form**: You can also report bugs via our [Feedback Form](https://phenixel.notion.site/26b35db90d4d809aada8e077937652d4).

### Suggest an Improvement

Have a feature idea?

- Open an Issue on GitHub to discuss it before coding.
- Or use our [Feedback Form](https://phenixel.notion.site/26b35db90d4d809aada8e077937652d4) to submit your ideas.

### Submit a Pull Request (PR)

1. **Fork** the project.
2. Create a branch for your feature (`git checkout -b feature/my-new-feature`).
3. Make your changes.
4. Ensure the code is clean and tests pass:
   ```bash
   npm run verify
   ```
5. Commit your changes (`git commit -m 'Add my new feature'`).
6. Push to your branch (`git push origin feature/my-new-feature`).
7. Open a Pull Request on the main repository.

## 📐 Code Standards

- **TypeScript**: We use TypeScript for strong typing. Avoid `any` as much as possible.
- **Vue 3**: Use the **Composition API** with `<script setup>`.
- **Style**: The project uses `eslint` and `prettier`. Run `npm run format` before committing.
- **CSS**: Use **TailwindCSS** utility classes whenever possible.

## ⚠️ Important

This project is intended for community use and is **non-commercial**.
By contributing, you agree that your code will be part of this project under the **CC BY-NC 4.0** license.
