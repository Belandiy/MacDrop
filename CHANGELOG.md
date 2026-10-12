# Changelog

Все важные изменения проекта MacDrop фиксируются в этом файле.

## [feat/tauri-migration - Fix 2] - 2026-10-12

### Полное восстановление перетаскивания окна и обнаружения имен устройств в сети
- **Восстановление перемещения окна (Window Dragging)**:
  - В [capabilities/default.json](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/capabilities/default.json) добавлено системное разрешение `core:window:allow-start-dragging`, а также `core:window:allow-minimize`, `core:window:allow-maximize`, `core:window:allow-close`. Без `allow-start-dragging` вызов нативного перетаскивания окна блокировался внутренней подсистемой прав Tauri v2.
  - В [commands.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/commands.rs) и [lib.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/lib.rs) реализована выделенная IPC-команда `start_dragging(window: Window)`.
  - В [bridge/index.ts](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/bridge/index.ts) убран асинхронный `await import`, приводивший к потере системного тика `mousedown` в macOS Cocoa AppKit. Команда `invokeTauri('start_dragging')` теперь срабатывает синхронно во время нажатия клавиши мыши.
- **Отображение имен устройств в радаре поиска (Peer Discovery & Names)**:
  - **Корневая причина:** В структуре `DiscoveredPeer` в Rust поля назывались `id` и `name`, тогда как интерфейс React `DiscoveredPeerItem` ожидал `deviceId` и `deviceName`. В результате имя устройства не выводилось (`undefined`), а устройство не выбиралось по клику.
  - В [engine.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/engine.rs) модель `DiscoveredPeer` дополнена полями `device_id` и `device_name` (с camelCase сериализацией).
  - В [bridge/index.ts](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/bridge/index.ts) методы `getDiscoveredPeers`, `scanNearbyPeers` и событие `onPeersUpdate` получили гарантированную нормализацию: дублирование `deviceId`/`id` и `deviceName`/`name`.
  - В [discovery.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/discovery.rs):
    - Добавлен расчет широковещательных адресов локальных подсетей через `get_broadcast_addrs()` (например, `192.168.x.255`), что предотвращает фильтрацию широковещательных пакетов роутерами на macOS;
    - Реализован мгновенный прямой ответ `unicast reply` при первом же получении пакета от другого устройства, обеспечивая немедленное взаимное обнаружение.
- **Тестирование**:
  - Все **73 теста Vitest** и **13 тестов Rust** проходят успешно (86/86 тестов зеленые).
  - Собрано обновленное релизное приложение [MacDrop.app](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/target/release/bundle/macos/MacDrop.app) (18.48 МБ).

## [feat/tauri-migration - Фаза 3] - 2026-10-12

### Нативный системный трей, оконный менеджмент и тестирование
- **Нативный трей [tray.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/tray.rs)**:
  - Инициализация статус-бара macOS и системного трея Windows через `tauri::tray::TrayIconBuilder`.
  - Монохромная иконка `src-tauri/icons/tray.png` с поддержкой Retina.
  - Клик левой кнопкой мыши по иконке трея мгновенно переключает видимость окна (toggle show/hide + focus).
  - Нативное контекстное меню:
    - Заголовок «MacDrop»;
    - «🖥️ Показать MacDrop»;
    - «📂 Открыть папку MacDrop» (вызов нативного проводника Finder/Explorer через `open`);
    - «❌ Выход» (корректное завершение процесса приложения `app.exit(0)`).
- **Конфигурация окна [tauri.conf.json](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/tauri.conf.json)**:
  - Явный идентификатор окна `"label": "main"` для надежного связывания с оконным менеджером трея.
- **Тестирование**:
  - Написаны и успешно выполнены **13 unit-тестов Rust** (`cargo test`).
  - **70 фронтенд-тестов Vitest** (`npm test`) выполняются со 100% успехом.
  - Release-бинарник собирается за 17 секунд, итоговый вес автономного приложения — **16 МБ**.

## [feat/tauri-migration - Фаза 2] - 2026-10-12

### Сеть и Передача: UDP Discovery, AirDrop Radar, ZIP Архивация и Unit-тесты
- **Сетевое обнаружение пиров [discovery.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/discovery.rs)**:
  - Фоновый асинхронный сокет `tokio::net::UdpSocket` на порту `8385`.
  - Периодический бродкаст присутствия (`DiscoveryMessage`) каждые 2.5 сек на `255.255.255.255:8385`.
  - Автоматическое определение платформы пира (`darwin` / `win32`) по сигнатуре или имени хоста.
  - Мгновенная трансляция найденных узлов на фронтенд через `app_handle.emit("peers-update", ...)` для нативного AirDrop Radar.
  - Поддержка принудительного сканирования через `scan_nearby_peers`.
- **Модуль передачи данных и архивации [transfer.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/transfer.rs)**:
  - Прямая отправка файлов целевым пирам через HTTP POST `/api/upload` с валидацией auth-токена.
  - Архивация каталогов в `.zip` на лету через `zip::ZipWriter` с сохранением структуры вложенных папок.
  - Обновление прогресса отправки в реальном времени (`progress-update`) и сохранение в историю передач.
- **Тестирование**:
  - Написано и успешно пройдено **12 unit-тестов Rust** (`cargo test`):
    - `test_zip_directory` — рекурсивная архивация папок;
    - `test_guess_platform` — эвристика распознавания macOS и Windows;
    - `test_discovery_message_serde` — сериализация сетевых сообщений;
    - `test_path_traversal_blocked` — блокировка атак выхода из каталога;
    - `test_valid_path_resolution` — безопасное разрешение путей;
    - `test_non_conflicting_path` — автоматическое разрешение коллизий имен;
    - `test_urlencoding_decode` — декодирование URL-имен;
    - `test_logger_*` — буфер и очистка логов;
    - `test_config_*` — генерация ключей и roundtrip сериализации настроек.
  - **70 фронтенд-тестов Vitest** (`npm test`) выполняются со 100% успехом.
  - Итоговый release-бинарник со всеми сетевыми протоколами весит **16 МБ**.

## [feat/tauri-migration - Фаза 1] - 2026-10-12

### Ядро на Rust: Config, Logger, Axum HTTP Server и IPC Commands
- **Модуль конфигурации [config.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/config.rs)**:
  - 100% обратная совместимость со структурой `settings.json` из Electron (автоматический подхват существующих настроек из `~/Library/Application Support/MacDrop/settings.json` на macOS и `%APPDATA%\MacDrop` на Windows).
  - Строгая типизация моделей `AppConfig` и `PairedDevice` с сериализацией serde camelCase.
- **Модуль логирования [logger.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/logger.rs)**:
  - Потокобезопасный `AppLogger` с кольцевым in-memory буфером (до 1000 записей).
  - Автоматическая ротация лог-файла `macdrop.log` при достижении 5 МБ в папке конфигурации.
- **Движок и сетевой сервер [engine.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/engine.rs)**:
  - Асинхронный HTTP-сервер на базе `Axum` и `Tokio` с CORS и потоковым приемом данных.
  - Реализованы эндпоинты: `/api/status`, `/api/ping`, `/api/pair`, `/api/upload`.
  - Мобильный шлюз Web Drop: `/mobile`, `/api/mobile/status`, `/api/mobile/upload`, `/api/mobile/files`, `/api/mobile/download/{filename}` для прямой отправки и скачивания файлов с телефонов.
  - Безопасность: валидация путей против Path Traversal (`get_safe_resolved_path`), алгоритм защиты от перезаписи существующих файлов (`get_non_conflicting_path`), нативные системные уведомления через `notify-rust`.
- **Tauri IPC мост [commands.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/commands.rs)**:
  - Реализованы все методы: `get_config`, `save_config`, `get_status`, `select_folder` (нативный диалог `rfd`), `open_folder` (нативное открытие в Finder/Explorer через `open`), `open_file`, `get_logs`, `clear_logs`, `open_logs_folder`, `get_mobile_share_info`, `regenerate_mobile_token`, управление окном (`minimize`, `maximize`, `close`, `resize`).
- **Сборка и метрики**:
  - `cargo check` проходит за **1.27с**.
  - Итоговый автономный release-бинарник `macdrop` весит всего **13 МБ** (сокращение размера более чем в **13 раз** по сравнению со связкой Electron + Chromium).

## [feat/tauri-migration - Фаза 0] - 2026-10-12

### Инициализация стека Tauri v2 и Compatibility Bridge
- **Ветка `feat/tauri-migration`**:
  - Создана выделенная ветка для постепенной миграции приложения с Electron на Tauri v2.
- **Инициализация Rust Backend (`src-tauri/`)**:
  - Установлены зависимости `@tauri-apps/cli@^2` и `@tauri-apps/api@^2`.
  - Создан крейт `macdrop` (`macdrop_lib`) с таргетом staticlib/cdylib/rlib.
  - Настроен [tauri.conf.json](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/tauri.conf.json) с размерами окна `760×480` (min `640×400`), бесшовным frameless режимом (`decorations: false`).
- **Сборка фронтенда**:
  - Добавлен независимый [vite.config.tauri.ts](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/vite.config.tauri.ts) для чистого SPA без привязки к Electron-плагинам.
  - Добавлены скрипты `npm run dev:tauri` и `npm run build:tauri`.
- **Tauri Compatibility Bridge**:
  - Создан [bridge/index.ts](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/bridge/index.ts): эмулирует интерфейс `window.macdrop`, направляя вызовы в Tauri `invoke()` и слушая события `listen()`. Защищает React UI от ошибок `undefined` при отсутствии бэкенда Electron.
  - Подключен в точку входа [main.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/main.tsx).
- **Результаты проверки**:
  - React бандл собирается за 0.98с.
  - Rust ядро собирается за 5.5с.

## [private/classic-native] - 2026-10-12

### Изоляция дизайна Classic Native и очистка интерфейса
- **Выделена отдельная ветка `private/classic-native`**:
  - Единственным активным интерфейсом оставлен дизайн [Classic Native (macOS)](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/designs/classic-native).
  - Удалены альтернативные модули дизайнов (`default`, `studio-titanium`, `vision-spatial`).
  - Полностью убрана верхняя системная панель переключения дизайнов (`DevToolbar`).
  - Окно приложения `BrowserWindow` перенастроено под нативные пропорции десктопного split-view (`760×480`, `minWidth: 640`, `minHeight: 400`, фоновый цвет `#161616`).
- **Нативный радар поиска устройств (AirDrop Radar UI)**:
  - Полностью переработано модальное окно сопряжения [PairingModal.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/components/PairingModal.tsx) в стиле Apple AirDrop Radar.
  - Анимированные концентрические круги радара с эффектом расширяющихся волн (`radarWave`) и непрерывным вращающимся лучом сканирования (`radarSweep`).
  - Распознавание платформ клиентов в локальной сети: для Windows — иконка логотипа Windows (четыре плитки), для Mac — нативные глифы MacBook / iMac.
  - Поле ручного ввода кода удалено.
  - Добавлена кнопка «QR-код» рядом со статусом «Готов к подключению» для быстрого подключения мобильного телефона через локальный Web Drop.
  - В [discovery.ts](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/main/discovery.ts) добавлена передача `platform: process.platform` в UDP-бродкастах и автоматическая эвристика определения ОС.


## [2.3.8] - 2026-09-28

### Новый дизайн: VisionOS Frosted Glass & Spatial Minimal
- **Добавлен модуль дизайна `VisionOS Spatial Glass` (`src/renderer/src/designs/vision-spatial`)**:
  - Полная поддержка единого контракта `DesignProps` и автоматическая регистрация через `import.meta.glob`.
  - Эстетика VisionOS: многослойные панели из матового стекла (`glass-panel`, `glass-pill`), атмосферные градиентные ауры, преломляющие капсулы светофора macOS и зеркальные блики (`shadow-specular`).
  - Пространственный Bento Grid (780×520 px, соотношение 3:2):
    - **Spatial Peer Radar**: карточки обнаруженных устройств с градиентными иконками, пингом и сопряжением по PIN.
    - **Хранилище Vault**: папка назначения со стеклянной иконкой, градиентным индикатором емкости и быстрым переходом в Finder.
    - **Drop Reactor & Liquid HUD**: пространственная интерактивная зона сброса файлов, поддержка drag-and-drop по нескольким целевым устройствам и жидкий круговой индикатор прогресса передачи со скоростью в реальном времени.
    - **История передач**: карточки последних отправлений с бейджами типов файлов и статусом.
    - **Mobile Web Bridge**: QR-код прямого подключения с мобильных устройств через Safari/Chrome.
  - Полноэкранный лист настроек (`Spatial Sheet`) со всеми функциями (язык, хранилище, узлы, обновления, логи).
  - Стили и ключевые кадры анимаций (`gentlePulse`, `iridescentShift`, `progress-liquid`) добавлены в `src/renderer/src/index.css`.
  - **Pixel-perfect оптимизация под окно 780×520 px**: динамическая сетка `minmax(0, 1fr)` исключает появление вертикальных полос прокрутки и обрезок элементов даже при активной панели разработчика `DevToolbar`. Оптимизированы внутренние отступы карточек, размер центральной сферы, кругового индикатора HUD (`r=26`) и QR-кода.
- **Автоматическая интеграция в панель разработчика (`DevToolbar`)**: дизайн доступен для выбора и тестирования наряду со `Studio Titanium Precision` и `Classic Native`.

## [2.3.7] - 2026-09-27


### Масштабируемая i18n архитектура и полная локализация приложения
- **Централизованная система интернационализации (`src/renderer/src/i18n`)**:
  - Полностью ликвидирован антипаттерн inline-тернарников (`{lang === 'en' ? ... : ...}`).
  - Создана типизированная схема `LocaleSchema` и словари `ru.ts` и `en.ts` со строгим контрактом TypeScript.
  - Реализован провайдер `<LanguageProvider>` и хук `useTranslation()` с поддержкой dot-нотации (`t('nav.transfer')`), интерполяции параметров (`{count}`, `{name}`, `{version}`) и автоматическим fallback на русский язык.
  - Масштабируемость до 10+ языков без изменения компонентов интерфейса: достаточно добавить файл `locales/<lang>.ts` и зарегистрировать код в `SUPPORTED_LANGUAGES`.
- **Полная локализация всех экранов и компонентов интерфейса**:
  - Дизайн `Studio Titanium Precision`: панель навигации, телеметрия HUD, Drop-зона, сетка узлов, папка назначения, история и встроенные вкладки настроек.
  - Дизайн `Classic Native (macOS)`: сайдбар устройств, нативная дроп-зона, фильтрация истории передач (All / Active / Completed), строка состояния.
  - Компоненты базового дизайна: `Header`, `DropZone`, `NativeDropZone`, `DeviceList`, `RecentTransfers`, `FolderSection`, `DeviceDetailView`, `PairingModal`, `PairingRequestModal`, `StatusCard`.
  - Модальное окно настроек (`SettingsModal`) и все его секции: `ConnectedDevicesSection`, `TargetFolderSetting`, `UpnpStatusSection`, `UpdatesSection`, `LogsSection`.
- **100% совместимость с тестами**:
  - Все 70 unit-тестов Vitest (включая изолированные тесты `UpdatesSection`, `LogsSection`, `CircularUpdateProgress`) проходят без изменений.

## [2.3.6] - 2026-09-24

### Бесшовное автообновление (In-App Auto-Update & UX)
- **Нативное обновление на macOS без перенаправления в браузер**:
  - Устранена заглушка с принудительным открытием страницы релизов в браузере при клике «Обновить» на macOS.
  - Реализован автоматический механизм in-place обновления неподписанного приложения (unsigned macOS bundle): извлечение скачанного `.zip` архива через системную утилиту `/usr/bin/ditto -xk`, снятие карантинного атрибута Gatekeeper (`xattr -cr`), атомарная замена бандла `.app` через фоновый скрипт с ожиданием завершения процесса и автоматический перезапуск обновленного приложения (`open -n`).
  - Отключен `autoInstallOnAppQuit` на macOS во избежание сбоев проверки сигнатуры со стороны Squirrel.Mac.
- **Круговой прогресс скачивания на главной панели (Header)**:
  - Компонент `CircularUpdateProgress`: компактная иконка стрелки вниз с круговым SVG-прогрессбаром, заполняющимся по часовой стрелке строго пропорционально проценту скачивания (0–100%).
  - Убраны громоздкие текстовые плашки и бейджи из верхней панели во время загрузки.
  - При завершении загрузки кружок плавно переходит в состояние 100% (изумрудная индикация) с возможностью перезапуска приложения в один клик.
- **Вкладка «Обновление» в окне настроек (`UpdatesSection`)**:
  - Добавлена полноценная секция управления обновлениями в `SettingsModal` с карточкой текущей версии и состояния.
  - Явное отображение процентов загрузки, объема скачанных данных (МБ / общий объем) и текущей скорости соединения.
  - Кнопка ручной проверки обновлений («Проверить обновления») и кнопка «Перезагрузить и установить» по окончании загрузки.
  - Интерактивный бейдж в заголовке вкладки с живым процентом скачивания.

## [2.3.5] - 2026-09-24

### Оптимизация производительности (Холодный старт на слабых ПК и Windows)
- **Устранение сетевой блокировки рендеринга (Google Fonts)**: удалены внешние блокирующие HTTP-запросы шрифтов в `<head>`. Добавлен нативный системный стек шрифтов Windows (`Segoe UI`, `Roboto`) и macOS (`-apple-system`, `SF Pro Display`).
- **Мгновенный CSS-скелетон (Instant Skeleton UI)**: в `index.html` встроен inline-скелетон приложения с фоном `#090a0f`. Окно отображается пользователю за ~200-300 мс без эффекта пустого или белого экрана, пока V8 парсит бандл.
- **Асинхронная инициализация Main Process**:
  - Приоритетный запуск UI: создание окна и системного трея выполняется сразу, а тяжелые сетевые серверы (`SyncEngine`, `PeerDiscovery`) переведены на отложенный запуск `setImmediate()`.
  - Отложенный запуск UPnP и Auto-Updater (таймаут 3 секунды), чтобы не нагружать процессор и сеть во время запуска.
  - Устранена блокировка потока I/O: убраны циклические проверки несуществующих дисков (`E:\`) и закэшированы пути к системным иконкам.
  - Флаги командной строки Chromium для Windows: отключен расчет окклюзии окон (`CalculateNativeWinOcclusion`), предотвращающий микрофризы оконного менеджера Windows, включена плавная GPU-растеризация.
  - Добавлена обработка события `second-instance`: при повторном запуске приложение мгновенно разворачивает и фокусирует существующее окно из трея.
- **Мгновенный отклик UI (Zero-lag Modals)**:
  - Модальные окна (`SettingsModal`, `PairingModal`, `DeviceDetailView`, `PairingRequestModal`) загружаются монолитно в память: устранен `React.lazy`, вызывавший 1-секундную задержку при клике на «Настройки» и смене окон из-за асинхронного чтения чанков с диска.
  - Сборщик настроен на целевой стандарт `target: 'esnext'` без лишних полифилов и с быстрой esbuild-минимизацией.

### Добавлено
- **Встроенная система диагностики и просмотрщик логов в реальном времени (Log Viewer)**:
  - Модуль логирования `AppLogger` (`src/main/logger.ts`): кольцевой буфер в памяти на 1000 записей, авторотация файла логов при достижении 5 МБ (`macdrop.log` и `macdrop.1.log`), безопасная кроссплатформенная очистка файла через `truncate` без конфликтов файловых дескрипторов на Windows.
  - Структурированное логирование жизненного цикла: запуск приложения (с фиксацией ОС, версии и архитектуры), сетевой сервер HTTP/UPnP, события безопасности (сопряжения устройств, блокировка неавторизованных загрузок, Path Traversal), входящие и исходящие пакетные передачи файлов.
  - IPC-мост (`get-logs`, `clear-logs`, `open-logs-folder`) со стримингом событий `new-log-entry` и `logs-cleared` в реальном времени через Preload-контекст.
  - Вкладка «Логи» в окне «Настройки» (`LogsSection.tsx`):
    - Фильтрация по уровням важности (Все, Ошибки, Варнинги, Инфо) со счетчиками записей и бейджем количества ошибок в заголовке вкладки.
    - Полнотекстовый живой поиск по сообщениям, тегам и деталям.
    - Терминальный моноширинный вид списка с бейджами уровней и автопрокруткой вниз (`autoScroll`).
    - Аккордеон деталей для разворачивания стек-трейсов и JSON-пейлоадов.
    - Кнопки быстрых действий: копирование форматированного журнала в буфер обмена («Скопировать»), открытие папки с файлом логов в системном проводнике («Папка») и очистка журнала («Очистить»).
  - Набор модульных тестов для бэкенда логгера (`logger.test.ts`) и React-компонента (`LogsSection.test.tsx`) — 100% pass (60/60 тестов).

### Исправлено
- **Динамический статус сессии Web Drop**: виртуальное устройство «Телефон (Web Drop)» теперь появляется в списке только при активной сессии браузера смартфона или наличии файлов в очереди, и автоматически удаляется по таймауту неактивности. Устранен ложный перманентный статус `isConnected = true`.
- **Устранение мерцания DropZone при перетаскивании файлов из ОС**:
  - Геометрическое отслеживание курсора на уровне `window.dragover` через `getBoundingClientRect()`, не зависящее от дерева DOM;
  - Устранена ложная деактивация в `dragleave`: в Chromium при внешнем drag из ОС `relatedTarget === null`, а координаты `clientX/clientY` всегда равны `0, 0`. Вместо мгновенного сброса реализован watchdog-таймаут (80 мс), который непрерывно сбрасывается последующими событиями `dragover`, исключая ложное срабатывание при переходах между дочерними элементами;
  - Добавлен 8px гистерезисный буфер на границы дроп-зоны (`isInsideZone`) и `min-h-[44px]` на текстовый контейнер, устранившие микроколебания и мерцание при удержании курсора на внешней кромке рамки;
  - Удален временный отладочный HUD;
  - Удален ложный слушатель `window.blur`, вызывавший сброс состояния при неактивном окне приложения во время drag из Finder;
  - **Исправлен Dev Server URL в Electron**: заменена неверная переменная `ELECTRON_RENDERER_URL` на `VITE_DEV_SERVER_URL` в `src/main/index.ts`, из-за которой приложение в dev-режиме загружало устаревший статичный файл `dist/index.html` вместо живого dev-сервера;
  - Лаконичный однострочный текст подзаголовка в `DropZone` («Прямая P2P-передача» вместо длинной двухстрочной надписи с пояснением про zip).

## [2.2.1] - 2026-09-22

### Безопасность и Web Drop
- **Изолированная очередь передачи для Mobile Web Drop**: устранена уязвимость прямого доступа мобильного клиента к целевой папке ПК.
- **Виртуальное мобильное устройство**: при подключении телефона через QR-код в списке устройств появляется сессионное устройство «Mobile (Web Drop)» с выделенной иконкой смартфона.
- **Безопасная передача PC-to-Phone**: файлы, перетаскиваемые на виртуальное мобильное устройство, помещаются в изолированную сессионную очередь `mobileSessionQueue` и доступны для скачивания только авторизованному мобильному клиенту.
- **Ограничение опасных действий**: для временного мобильного пира отключены неподдерживаемые операции (удаление пира, запрос файлов).

## [2.2.0] - 2026-09-22

### Безопасность
- **Исправление обхода авторизации (Auth Bypass)**: исправлена проверка токенов в `engine.ts` (`peer.authToken && peer.authToken !== reqToken`), блокирующая запросы без токена; добавлены вызовы `req.destroy()` на сокетах с ошибками 400/401/403.
- **Устранение XSS в Mobile Web**: переход от `innerHTML` к безопасным DOM API (`document.createElement`, `.textContent`) при рендеринге списков файлов.
- **Защита от Timing Attacks**: сверка сессионных токенов через `crypto.timingSafeEqual` с предварительной проверкой байтовой длины буферов.

### Производительность
- **O(1) поиск связанных устройств**: введен Map-индекс `deviceMap` в `SyncEngine` вместо O(N) линейного перебора массива.
- **Параллельный опрос пиров**: конкурентный health-check оффлайн/онлайн пиров через `Promise.all` вместо последовательных таймаутов по 700 мс.
- **Неблокирующий асинхронный I/O**: рекурсивный подсчет размера папок (`getFolderSize`), чтение директорий и очередей передачи переведены на `fs.promises`.

### Архитектура и рефакторинг UI
- **Декомпозиция `App.tsx`**: состояние, подписки и IPC вынесены в кастомный хук `useAppLogic` (файл сокращен с 285 до 46 строк).
- **Модуляризация компонентов**: `DeviceDetailView`, `SettingsModal`, `Header`, `PairingModal`, `DropZone`, `DeviceList` разбиты на изолированные подкомпоненты.
- **Структурирование Mobile Web**: разделение генерации HTML/CSS/JS на модульные функции `getCss()`, `getHtmlBody()`, `getScripts()`.

### Тестирование
- **Инфраструктура Vitest**: настроен единый раннер тестов с поддержкой JSDOM (`vitest.config.ts`, `vitest.setup.ts`).
- **Тестовое покрытие**: добавлены тесты для `isPrivateIp`, `getSafeResolvedPath`, `getNonConflictingPath`, `calculateBroadcast`, `isArchiveFile`, `useSmoothProgress`, `getDefaultFolder`, `getServiceDir` (48 тестов, 100% pass).

## [2.1.0] - 2026-09-15

### Добавлено
- **Пакетная передача файлов без мерцания (Batch Transfer Awareness)**:
  - Реализован метод `sendBatch` в `engine.ts` и `ipc.ts`: расчет совокупного объема пачки файлов/папок и единая сессия передачи без промежуточного сброса состояния прогресса.
  - Поддержка пакетных HTTP-заголовков (`x-batch-index`, `x-batch-total`, `x-batch-total-bytes`): получатель также отображает единый накопительный прогресс всей пачки.
  - Группировка уведомлений: операционные уведомления выводятся один раз по завершении всей пачки («Получено 15 файлов»), предотвращая спам в центре уведомлений macOS/Windows.
  - Интерфейс прогресса в `DeviceList` и `DeviceDetailView`: бейдж очереди «3 из 15», плавное непрерывное заполнение полосы от 0% до 100% за всю пачку и суммарный размер переданных данных.
  - Хук сглаживания `useSmoothProgress` с плавными CSS-переходами высоты и прозрачности контейнера.
- **Поддержка отправки папок и архивов**:
  - Существующие архивы (`.zip`, `.rar`, `.7z`, `.tar`, `.gz`, `.tgz`, `.bz2`, `.xz`, `.iso`, `.dmg` и др.) теперь отправляются напрямую как единые файлы без лишнего сжатия.
  - Папки (директории) автоматически упаковываются приложением в кроссплатформенный `.zip` архив (`FolderName.zip`) с сохранением структуры каталога.
  - В процессе сжатия отображается статус и объем обработанных данных в интерфейсе.
  - Временные файлы архивов автоматически удаляются после завершения передачи или при отмене.
  - Добавлены выделенные кнопки выбора папок («Папку (.zip)») в интерфейс `DropZone` и `DeviceDetailView`, исключающие платформенные конфликты диалогов выбора на Windows и macOS.

## [2.0.0] - 2026-09-14

### Добавлено
- **Нативный заголовок окна для macOS (Demo 1 Style)**:
  - Реализован верхний бар в стиле Demo 1 для macOS: три нативные кнопки «светофор» (закрыть в трей, свернуть, развернуть) слева, центрированный логотип MacDrop с бейджем версии по центру и кнопка настроек справа;
  - Заголовок для Windows сохранен в исходном виде.
- **Обновление брендинга и иконок**:
  - Интегрирован новый логотип во все форматы сборки: `public/icon.png` (1024x1024), `public/icon.ico` (multi-size 16-256px для Windows), `src/renderer/src/assets/logo.png` и веб-интерфейс Web Drop;
  - Добавлены оптимизированные платформенные иконки трея: `public/tray-icon-mac.png` (с поддержкой Template Image для темного/светлого меню macOS) и `public/tray-icon-win.png` (для трея Windows).
- **Полный визуальный редизайн интерфейса (v2.0 Pro Design System)**:
  - Интегрирована новая дизайн-система в эстетике Apple HIG / Raycast с акцентами Indigo (`#6366f1`), Cyan (`#06b6d4`), Emerald (`#10b981`);
  - Подключены современные шрифты *Plus Jakarta Sans* и *JetBrains Mono*;
  - Обновлены темные многослойные поверхности (`canvas` `#090a0f`, `surface-1` `#111319`, `surface-2` `#171a23`, `surface-3` `#1f2330`);
  - Реализованы орбитальная подсветка дроп-зоны, Apple-style переключатели в настройках, линейный градиентный таймер подтверждения сопряжения и неоновый прогресс-бар активной передачи файлов.

## [1.3.0] - 2026-09-14

### Добавлено
- **Web Drop для Android и мобильных устройств**:
  - Встроенный автономный HTTP-сервер для браузерного взаимодействия без необходимости сборки или установки `.apk`.
  - Модуль [`src/main/mobileWeb.ts`](file:///Users/andrey/project-macdrop/MacDrop/src/main/mobileWeb.ts): генерация адаптивного веб-клиента с поддержкой темной темы, Drag & Drop, выбора фото/видео из галереи и индикации прогресса загрузки с виброоткликом.
  - Безопасные эндпоинты в [`src/main/engine.ts`](file:///Users/andrey/project-macdrop/MacDrop/src/main/engine.ts):
    - `GET /mobile` — выдача автономной веб-страницы клиенту;
    - `POST /api/mobile/upload` — потоковый прием файлов с защитой путей `getSafeResolvedPath`, генерацией истории и уведомлений десктопа;
    - `GET /api/mobile/files` — получение списка недавних файлов на ПК;
    - `GET /api/mobile/download/:filename` — безопасное скачивание файлов с ПК на смартфон.
  - Защита сессий: криптографический сессионный токен доступа (`token`) и обход CORS для доверенных мобильных запросов.
  - Редизайн окна сопряжения **«Unified Hub»** в [`PairingModal.tsx`](file:///Users/andrey/project-macdrop/MacDrop/src/renderer/src/components/PairingModal.tsx):
    - Убраны лишние вкладки;
    - Единый QR-код по центру с прямой ссылкой на Web Drop;
    - Плашка кода текущего компьютера с быстрым копированием;
    - Отображение устройств в локальной Wi-Fi сети и поле для ручного ввода кода другого ПК в едином экране.


