# План исправления дефектов миграции MacDrop (Tauri v2)

Документ составлен на основе ручного тестирования из [TAURI_MIGRATION_CHECKLIST.md](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/TAURI_MIGRATION_CHECKLIST.md). Задачи сгруппированы в 5 фаз по принципу архитектурных зависимостей.

---

## 📅 Фаза 1: Окно, macOS Vibrancy и базовые элементы управления

> **Цель:** Привести визуальное оформление и поведение безрамочного окна в полное соответствие с нативными гайдлайнами macOS.

### Задачи:

- [X] **1.1. Восстановление размытия фона (Window Vibrancy / Травмобезопасная прозрачность)**
  - *Связанный пункт чеклиста:* `1.10`
  - *Файлы:* [App.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/App.tsx), [classic-native/index.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/designs/classic-native/index.tsx), [index.html](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/index.html), [src-tauri/src/lib.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/lib.rs)
  - *Root Cause:* Жестко заданные непрозрачные CSS-цвета `bg-[#161616]` и `bg-[#1E1E1E]` полностью блокируют нативный слой размытия `UnderWindowBackground`, а в коде Rust `apply_vibrancy` не вызывался.
  - *Решение:* Подключен `window_vibrancy::apply_vibrancy` в `src-tauri/src/lib.rs`, заменены фоны на полупрозрачные альфа-каналы (`bg-[#161616]/80`, `bg-[#1E1E1E]/75`, `bg-[#232326]/85`).
- [X] **1.2. Двойной клик по панели заголовка (Window Zoom)**
  - *Связанный пункт чеклиста:* `1.2`
  - *Файлы:* [classic-native/index.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/designs/classic-native/index.tsx)
  - *Root Cause:* На элементе `<header>` отсутствовал слушатель события `onDoubleClick`.
  - *Решение:* Добавлен `onDoubleClick` с проверкой no-drag элементов и вызовом `window.macdrop?.maximizeWindow?.()`.
- [X] **1.3. Плавный Zoom / Maximize (Зеленая кнопка)**
  - *Связанный пункт чеклиста:* `1.4`
  - *Файлы:* [src-tauri/src/commands.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/commands.rs)
  - *Root Cause:* Метод `window.maximize()` в кастомном безрамочном окне грубо ресайзил фрейм с переносом координат верхнего угла без нативной системной анимации macOS.
  - *Решение:* Реализовано переключение через нативный полноэкранный режим macOS `window.set_fullscreen(!is_fs)` с плавной анимацией системных пространств.

---

## 📅 Фаза 2: Нативный Drag & Drop и файловые диалоги (Критический блок)

> **Цель:** Восстановить перетаскивание файлов из Finder и работу нативных диалогов с поддержкой мультивыбора и папок.

### Задачи:

- [X] **2.1. Переход на нативный Tauri Webview DragDrop API**
  - *Связанные пункты чеклиста:* `2.1 – 2.7`
  - *Файлы:* [useStableDropZone.ts](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/hooks/useStableDropZone.ts), [bridge/index.ts](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/bridge/index.ts), [vite-env.d.ts](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/vite-env.d.ts)
  - *Root Cause:* В движке Safari WebKit на macOS стандартный DOM `event.dataTransfer.files[0].path` **всегда `undefined`**. Кроме того, Webview в Tauri перехватывает OS-drop раньше HTML5 DOM-слушателей.
  - *Решение:*
    - Реализован метод `window.macdrop.onDragDrop` в `bridge/index.ts`, использующий `getCurrentWebview().onDragDropEvent(...)`.
    - В `useStableDropZone.ts` поддержаны события `enter`, `over`, `drop`, `leave` с масштабированием физических координат `position / window.devicePixelRatio`.
    - Добавлен хит-тестинг как для плиток в дропзоне, так и для устройств в сайдбаре (`[data-device-id]`), с подсветкой целевого устройства при ховере.
    - Реализован счетчик файлов при пакетном сбросе (`+N`).
    - Исправлен `urlencoding_decode` в `engine.rs` для корректной распаковки кириллицы и спецсимволов.
- [X] **2.2. Множественный выбор файлов в системном диалоге**
  - *Связанный пункт чеклиста:* `3.2`
  - *Файлы:* [src-tauri/src/commands.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/commands.rs)
  - *Root Cause:* Ограничения вызова `rfd::AsyncFileDialog` на платформе macOS без активации фокуса приложения.
  - *Решение:*
    - В `commands.rs` добавлен вызов `activateIgnoringOtherApps: true` на macOS для гарантированного перехвата клавиш Cmd/Shift в `NSOpenPanel`.
    - Добавлено автоопределение стартовой директории из `config.target_folder` / `dirs::download_dir()`.
- [X] **2.3. Универсальный выбор файлов и папок (Единая кнопка с мультиселектом)**
  - *Связанный пункт чеклиста:* `3.3`
  - *Файлы:* [NativeDropZone.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/components/NativeDropZone.tsx), [src-tauri/src/commands.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/commands.rs), [src-tauri/src/transfer.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/transfer.rs), [src-tauri/src/engine.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/engine.rs)
  - *Root Cause:* Наличие двух раздельных кнопок («Выбрать файлы» и «Выбрать папку») усложняло UI, а стандартный `rfd::AsyncFileDialog` не позволяет выбирать файлы и папки одновременно в одном окне диалога.
  - *Решение:*
    - В `NativeDropZone.tsx` оставлена одна единая нативная кнопка: «Выбрать файлы и папки...».
    - В `commands.rs` реализован нативный вызов `NSOpenPanel` через `objc2` с флагами `setCanChooseFiles: true`, `setCanChooseDirectories: true` и `setAllowsMultipleSelection: true`, позволяющий выбирать файлы и папки в любых комбинациях.
    - В `transfer.rs` и `engine.rs` папки автоматически упаковываются в отдельные `.zip` архивы и передаются получателю с последующей очисткой временных файлов.

---

## 📅 Фаза 3: Сопряжение (Pairing Handshake) и радар устройств

> **Цель:** Восстановить сетевое сопряжение устройств по локальной сети, добавить ручной ввод IP и автоматический опрос радара.

### Задачи:

- [X] **3.1. Реализация сетевого Handshake в `pair_device`**
  - *Связанные пункты чеклиста:* `4.1, 5.3 – 5.5`
  - *Файлы:* [src-tauri/src/commands.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/commands.rs), [src-tauri/src/engine.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/engine.rs), [src-tauri/src/lib.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/lib.rs)
  - *Root Cause:* Команда `commands::pair_device` в Rust была заглушкой и не отправляла HTTP-запрос `POST /api/pair` целевому узлу. В результате получатель никогда не открывал `PairingRequestModal`.
  - *Решение:*
    - В `commands.rs` реализован сетевой HTTP-запрос `POST /api/pair` с взаимной передачей токена и метаданных.
    - В `engine.rs` `handle_pair` поддержана проверка уже сопряженных устройств (авто-ответ 200 OK) и генерация интерактивного запроса сопряжения через `tokio::sync::oneshot` с таймаутом 30 секунд.
    - Реализована команда `commands::respond_pairing_request`, эмитящая событие `status-changed` и разрешающая или отклоняющая соединение.
- [X] **3.2. Добавление поля ручного ввода IP в UI**
  - *Связанные пункты чеклиста:* `5.1, 5.2`
  - *Файлы:* [PairingModal.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/components/PairingModal.tsx), [ru.ts](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/i18n/locales/ru.ts), [en.ts](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/i18n/locales/en.ts)
  - *Root Cause:* В интерфейсе модального окна физически отсутствует текстовое поле для ручного ввода адреса узла.
  - *Решение:* Добавлен инпут ручного ввода IP/хоста с валидацией формата, обработкой клавиши Enter, спиннером отправки и кнопкой «Подключить» без использования лишних PIN-кодов.
- [X] **3.3. Автоматический фоновый опрос и очистка устаревших узлов (Radar Heartbeat)**
  - *Связанные пункты чеклиста:* `4.3, 4.4`
  - *Файлы:* [src-tauri/src/discovery.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/discovery.rs)
  - *Root Cause:* Радар полагался на ручной триггер сканирования, а статус сопряженных устройств не обновлялся при выходе из сети.
  - *Решение:*
    - Рассылка UDP-анонсов каждые 2.5 сек.
    - Фоновый таймер (каждые 2 сек) автоматически удаляет необнаруженные более 6 сек узлы из `discovered_peers` с событием `peers-update`.
    - Для сопряженных устройств выставляется статус `local` при приеме пакета и `offline` при отсутствии сигнала более 8 сек с эмитом `status-changed`.

---

## 📅 Фаза 4: Передача файлов и Mobile AirBridge (Web Drop)

> **Цель:** Устранить ошибки передачи файлов и восстановить двусторонний мобильный веб-клиент.

### Задачи:

- [X] **4.1. Унификация сетевого порта передачи файлов (Фикс 8384 -> 52520)**
  - *Связанный пункт чеклиста:* `3.1`
  - *Файлы:* [src-tauri/src/config.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/config.rs), [src-tauri/src/engine.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/engine.rs), [src-tauri/src/discovery.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/discovery.rs)
  - *Root Cause:* Ошибка `error sending request for url (http://192.168.0.102:8384/api/upload)` возникала из-за устаревшего порта `8384` в fallback-логике конфига.
  - *Решение:* Заменены все дефолтные порты на единый актуальный порт `52520`, добавлена автоматическая миграция старых конфигураций в `load_config`.
- [X] **4.2. Полноценный мобильный клиент AirBridge и виртуальное устройство «Телефон»**
  - *Связанные пункты чеклиста:* `7.3, 7.4`
  - *Файлы:* [src-tauri/src/mobile_web.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/mobile_web.rs), [src-tauri/src/engine.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/engine.rs), [src-tauri/src/transfer.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/transfer.rs), [src-tauri/src/discovery.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/discovery.rs)
  - *Root Cause:*
    - В Rust HTML-заглушке отсутствовал полноценный мобильный веб-интерфейс (скачивание с ПК, прогресс-бар, таймер, расчет скорости, переключение табов).
    - В `getStatus().pairedDevices` не подставлялся виртуальный узел `mobile-web` при активной сессии телефона, а отправка файлов с Mac на телефон возвращала ошибку поиска целевого устройства.
  - *Решение:*
    - Создан автономный модуль [mobile_web.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/mobile_web.rs) с двухвкладочным мобильным веб-клиентом (отправка с расчетом скорости `B/s` / `KB/s` / `MB/s`, скачивание файлов из `mobile_queue`, heartbeat каждые 15 сек, логотип `/api/mobile/logo`).
    - В [engine.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/engine.rs) добавлено отслеживание `last_mobile_seen` и динамическая инжекция виртуального устройства `mobile-web` («Телефон (Web Drop)») в `paired_devices` при активности телефона (<60 сек) или наличии файлов в очереди.
    - В фоновом цикле [discovery.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/discovery.rs) реализовано автоматическое удаление `mobile-web` при таймауте с эмитом события `status-changed`.
    - В [transfer.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/transfer.rs) добавлена обработка передачи файлов и папок на целевое устройство `mobile-web` (архивация директорий в ZIP, помещение в `mobile_queue`, эмит прогресса и запись в историю).
- [X] **4.3. Определение реального IP-адреса при смене сети (Wi-Fi ↔ Новая сеть)**
  - *Связанный пункт чеклиста:* `10.2`
  - *Файлы:* [src-tauri/src/net_utils.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/net_utils.rs), [src-tauri/src/commands.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/commands.rs), [src-tauri/src/discovery.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/discovery.rs)
  - *Root Cause:* Функция `local_ip_address::local_ip()` возвращала первый попавшийся или виртуальный интерфейс (loopback `127.0.0.1`, `utun*`, `bridge*`, `vmnet*`), что приводило к неработающим QR-кодам и ссылкам.
  - *Решение:* Создан модуль [net_utils.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/net_utils.rs) с интеллектуальной фильтрацией сетевых адаптеров через `list_afinet_netifas()`. Приоритет отдается физическим Wi-Fi/Ethernet интерфейсам (`en0`, `en1`), исключаются VPN, виртуалки и APIPA (`169.254.*`). Функция используется в `get_mobile_share_info`, `get_status` и для расчета широковещательных UDP адресов в `discovery.rs`.

---

## 📅 Фаза 5: Настройки, логи и системная интеграция

> **Цель:** Устранить баги состояния настроек, наладить очистку логов и системный автозапуск.

### Задачи:

- [X] **5.1. Устранение бага взаимоисключающих тумблеров настроек**
  - *Связанные пункты чеклиста:* `8.3, 8.4`
  - *Файлы:* [src/renderer/src/hooks/useAppLogic.ts](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/hooks/useAppLogic.ts), [src-tauri/src/commands.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/commands.rs)
  - *Root Cause:* Вызовы `saveConfig({ autoStart: enable })` передавали неполный JSON, а Rust-десериализатор сбрасывал отсутствующие поля.
  - *Решение:* В TypeScript передается полный слитый объект (`saveConfig({ ...config, autoStart: enable })`), а в Rust `commands::save_config` поддержано частичное слияние полей без сброса существующего конфига.
- [X] **5.2. Исправление очистки логов**
  - *Связанный пункт чеклиста:* `9.3`
  - *Файлы:* [src-tauri/src/commands.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/commands.rs), [src/renderer/src/components/settings/LogsSection.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/components/settings/LogsSection.tsx)
  - *Root Cause:* Команда `clear_logs` в Rust не отправляла событие `logs-cleared` во фронтенд, а в UI не было немедленной очистки стейта.
  - *Решение:* Добавлен эмит события `logs-cleared` в Rust и принудительная локальная очистка стейта `setLogs([])` в React.
- [X] **5.3. Системный автозапуск (macOS Login Items)**
  - *Связанный пункт чеклиста:* `8.4`
  - *Файлы:* [src-tauri/src/autostart.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/autostart.rs), [src-tauri/src/commands.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/commands.rs), [src-tauri/src/lib.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/lib.rs)
  - *Root Cause:* Изменялся только JSON-конфиг без фактической регистрации автозапуска в операционной системе.
  - *Решение:* Создан модуль [autostart.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/autostart.rs) для управления системным `LaunchAgent` macOS (`~/Library/LaunchAgents/com.macdrop.desktop.plist`). При включении тумблера «Запуск при старте системы» автоматически генерируется и сохраняется plist-манифест с путем к исполняемому файлу приложения; при выключении манифест удаляется. При старте приложения также выполняется синхронизация системного состояния.

---

## 🚀 Порядок исполнения и верификация

1. **Итерация 1 (Фаза 1 + Фаза 5):** Быстрые критические UX-фиксы (тумблеры настроек, логи, размытие Vibrancy, Zoom шапки).
2. **Итерация 2 (Фаза 2):** Реализация нативного перетаскивания файлов через `onDragDropEvent` и диалогов выбора файлов/папок.
3. **Итерация 3 (Фаза 3 + Фаза 4.1):** Сетевое сопряжение (Handshake), инпут для IP в модалке и исправление портов трансфера.
4. **Итерация 4 (Фаза 4.2 + Фаза 4.3 + Фаза 5.3):** Мобильный AirBridge клиент, переключение сетей и системный автозапуск.
