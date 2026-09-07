<p align="center">
  <img src="public/logo.png" alt="Melodix Logo" width="128" height="128" style="border-radius: 28px; box-shadow: 0 12px 32px rgba(0,0,0,0.5);" />
</p>

<h1 align="center">Melodix (Beta 0.2)</h1>

<p align="center">
  <b>Современный, сверхбыстрый и эстетичный десктопный музыкальный плеер нового поколения.</b><br/>
  Синхронизированные тексты песен, поиск по альбомам и исполнителям, динамический адаптивный фон и отзывчивый интерфейс Material 3.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.2.0_beta-blueviolet?style=for-the-badge" alt="Version 0.2.0 Beta" />
  <img src="https://img.shields.io/badge/platform-Linux_%7C_Windows-0078D6?style=for-the-badge" alt="Linux and Windows" />
  <img src="https://img.shields.io/badge/Electron-30.0-47848F?style=for-the-badge&logo=electron&logoColor=white" alt="Electron" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.4-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/license-GPL--3.0-blue?style=for-the-badge" alt="License GPL v3" />
</p>

<p align="center">
  <img src="Screenshoot.jpg" alt="Melodix Screenshot" width="92%" style="border-radius: 14px; box-shadow: 0 16px 48px rgba(0,0,0,0.7); max-width: 1000px;" />
</p>

---

## ✨ Ключевые возможности

- 🔍 **Умный поиск треков и альбомов**:
  - Мгновенный поиск песен и официальных релизов.
  - Поддержка поиска по каналам и хэндлам (например, `@nyan.mp3` или `nyan.mp3`) с автоматическим извлечением вкладки релизов и видео.
  - Умная фильтрация: отсеивание разговорных видео, реакций, подкастов и обучающих видео.
  - Фильтр-вкладки в поиске: **Все**, **Треки**, **Альбомы**.

- 💿 **Интерактивный просмотр альбомов**:
  - Карточки альбомов с обложками высокого разрешения.
  - Окно альбома с полным треклистом, длительностью треков и общим временем звучания.
  - Кнопки **«Слушать всё»** (воспроизведение с 1-го трека с добавлением альбома в очередь) и **«В очередь»** (добавление треков в текущую очередь без прерывания песни).

- 🎤 **Интерактивные тексты песен (Lyrics)**:
  - Синхронизированный построчный текст (LRC) с плавной кинематографичной автопрокруткой и акцентной подсветкой активной строки.
  - Кликабельные строки текста для мгновенной перемотки к нужной фразе.
  - **Фоллбек для несинхронизированного текста**: если тайминги отсутствуют, плеер аккуратно отображает полный текст песни для комфортного чтения.
  - Быстрое переключение отображения текста кнопкой **«Т»** прямо в полноэкранном плеере.

- ⏱ **Умный предпросмотр на ползунке трека**:
  - При наведении курсора на прогресс-бар (в мини-плеере и в полноэкранном режиме) отображается стильная плашка со временем под курсором и общей длительностью: `текущее / всего` (например, `01:24 / 03:45`).
  - Плавный Direct-DOM RAF-трекинг без лишних перерисовок интерфейса (стабильные 60+ FPS).

- 🎨 **Material 3 Expressive & Динамический фон**:
  - Живое размытие фона в такт обложке воспроизводимого трека (режимы: *Ambient*, *Vibrant*, *Glow*, *Acrylic*).
  - Высокая производительность: оптимизированная композиция без тяжелых полноэкранных фильтров, вызывающих просадки кадров.
  - Сворачиваемый боковой сайдбар с легким доступом к поиску, очереди, избранному, плейлистам и настройкам.

- ⚡ **Надежность и обход блокировок**:
  - Двойной источник аудио: YouTube + мгновенный fallback на SoundCloud при сетевых сбоях или DPI-блокировках.
  - Встроенный бандл `yt-dlp` для Windows и Linux.
  - Кэширование аудиопотоков и поисковых запросов в оперативной памяти для запуска без задержек.

- ⌨ **Горячие клавиши**:
  - <kbd>Space</kbd> — Воспроизведение / Пауза.
  - <kbd>Ctrl</kbd> + <kbd>R</kbd> / <kbd>F5</kbd> — Мгновенная перезагрузка плеера (работает как на английской, так и на русской раскладке).

---

## 🚀 Установка и запуск

### Готовые сборки (Releases)
Перейдите в раздел [Releases](https://github.com/qvkap/Melodix/releases) и скачайте версию для вашей системы:
- **Linux**: `.AppImage` (запуск без установки: `chmod +x Melodix-*.AppImage && ./Melodix-*.AppImage`) или `.deb` пакет.
- **Windows**: Портативный `.exe` или архив `.zip`.

---

### Запуск из исходного кода

1. **Клонируйте репозиторий**:
   ```bash
   git clone https://github.com/qvkap/Melodix.git
   cd Melodix
   ```

2. **Установите зависимости**:
   ```bash
   npm install
   ```

3. **Запустите режим разработки**:
   ```bash
   npm run dev
   ```

4. **Сборка приложения**:
   ```bash
   # Сборка под текущую ОС (AppImage/deb для Linux, exe/zip для Windows)
   npm run build
   ```

---

## 🛠 Технологический стек

- **Runtime**: [Electron 30](https://www.electronjs.org/)
- **Frontend**: [React 18](https://react.dev/), [TypeScript 5](https://www.typescriptlang.org/)
- **UI Framework**: [Material UI (MUI 5)](https://mui.com/), [Emotion](https://emotion.sh/)
- **Сборщик**: [Vite 5](https://vitejs.dev/) + [electron-builder](https://www.electron.build/)
- **Аудиоядро**: [Howler.js](https://howlerjs.com/) + [HLS.js](https://github.com/video-dev/hls.js/)
- **Стриминг и метаданные**: [yt-dlp](https://github.com/yt-dlp/yt-dlp)
- **Тексты песен**: [LRCLIB API](https://lrclib.net/)
- **Хранилище**: `electron-store`

---

## ⚙ Непрерывная интеграция (CI / CD)

В проекте настроен GitHub Actions workflow (`.github/workflows/build.yml`), который автоматически при каждом пуше и создании тега `v*`:
- Собирает Linux-пакеты (`.AppImage`, `.deb`) на `ubuntu-latest`.
- Собирает Windows-пакеты (`.exe`, `.zip`) на `windows-latest`.
- Автоматически публикует готовые бинарники в GitHub Releases.

---

## 📄 Лицензия

Распространяется под лицензией **GNU General Public License v3.0 (GPLv3)**. Подробности в файле [LICENSE](LICENSE).

<p align="center">
  Разработано с ❤️ для любителей качественной музыки и красивых интерфейсов.
</p>
