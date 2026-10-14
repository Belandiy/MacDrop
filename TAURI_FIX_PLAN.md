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

- [ ] **3.1. Реализация сетевого Handshake в `pair_device`**
  - *Связанные пункты чеклиста:* `4.1, 5.3 – 5.5`
  - *Файлы:* [src-tauri/src/commands.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/commands.rs), [src-tauri/src/engine.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/engine.rs)
  - *Root Cause:* Команда `commands::pair_device` в Rust была заглушкой и не отправляла HTTP-запрос `POST /api/pair` целевому узлу. В результате получатель никогда не открывал `PairingRequestModal`.
  - *Решение:*
    - Отправлять HTTP `POST http://<peer_ip>:<port>/api/pair` с информацией о текущем устройстве.
    - В обработчике `handle_pair` эмитить Tauri Event `pairing-request`.
    - По нажатию «Принять» генерировать взаимный токен и сохранять узел в `config.pairedDevices`.
- [ ] **3.2. Добавление поля ручного ввода IP / PIN-кода в UI**
  - *Связанные пункты чеклиста:* `5.1, 5.2`
  - *Файлы:* [PairingModal.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/components/PairingModal.tsx)
  - *Root Cause:* В интерфейсе модального окна физически отсутствует текстовое поле для ручного ввода адреса узла.
  - *Решение:* Добавить инпут ввода IP/PIN с валидацией формата и кнопкой прямого вызова `onPairWithCode`.
- [ ] **3.3. Автоматический фоновый опрос и очистка устаревших узлов (Radar Heartbeat)**
  - *Связанные пункты чеклиста:* `4.3, 4.4`
  - *Файлы:* [src-tauri/src/discovery.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/discovery.rs)
  - *Root Cause:* Радар полагался на ручной триггер сканирования.
  - *Решение:* Настроить регулярную рассылку UDP-анонсов каждые 2–3 сек и удаление узлов, не подававших сигнал более 6 сек.

---

## 📅 Фаза 4: Передача файлов и Mobile AirBridge (Web Drop)

> **Цель:** Устранить ошибки передачи файлов и восстановить двусторонний мобильный веб-клиент.

### Задачи:

- [ ] **4.1. Унификация сетевого порта передачи файлов (Фикс 8384 -> 52520)**
  - *Связанный пункт чеклиста:* `3.1`
  - *Файлы:* [src-tauri/src/config.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/config.rs), [src-tauri/src/engine.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/engine.rs), [src-tauri/src/transfer.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/transfer.rs)
  - *Root Cause:* Ошибка `error sending request for url (http://192.168.0.102:8384/api/upload)` возникала из-за устаревшего порта `8384` в fallback-логике конфига.
  - *Решение:* Заменить все дефолтные порты на единый актуальный порт `52520`.
- [ ] **4.2. Полноценный мобильный клиент AirBridge и виртуальное устройство «Телефон»**
  - *Связанные пункты чеклиста:* `7.3, 7.4`
  - *Файлы:* [src-tauri/src/engine.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/engine.rs), [src/main/mobileWeb.ts](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/main/mobileWeb.ts)
  - *Root Cause:*
    - В сгенерированном Rust HTML отсутствует интерфейс для скачивания файлов из `mobile_queue` и вкладка истории.
    - В `getStatus().pairedDevices` не подставляется виртуальный узел `mobile-web` при активной сессии телефона.
  - *Решение:*
    - Перенести верстку мобильного клиента из `src/main/mobileWeb.ts` в `engine.rs` (скачивание файлов, очередь, история).
    - При активной сессии (heartbeat < 30 сек) динамически добавлять узел `mobile-web` в сайдбар Mac, позволяя сбрасывать файлы прямо на телефон.
- [ ] **4.3. Определение реального IP-адреса при смене сети (Wi-Fi ↔ Новая сеть)**
  - *Связанный пункт чеклиста:* `10.2`
  - *Файлы:* [src-tauri/src/commands.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/commands.rs)
  - *Root Cause:* Функция `local_ip_address::local_ip()` возвращает кэшированный или первый попавшийся адаптер.
  - *Решение:* Фильтровать системные интерфейсы (`en0`, `en1`), исключая loopback (`127.0.0.1`) и виртуальные мосты, гарантируя актуальный IP для QR-кода.

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
- [ ] **5.3. Системный автозапуск (macOS Login Items)**
  - *Связанный пункт чеклиста:* `8.4`
  - *Файлы:* [src-tauri/src/commands.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/commands.rs)
  - *Root Cause:* Изменялся только JSON-конфиг без фактической регистрации в системе.
  - *Решение:* Добавить плагин `tauri-plugin-autostart` или генерацию LaunchAgent `.plist`.

---

## 🚀 Порядок исполнения и верификация

1. **Итерация 1 (Фаза 1 + Фаза 5):** Быстрые критические UX-фиксы (тумблеры настроек, логи, размытие Vibrancy, Zoom шапки).
2. **Итерация 2 (Фаза 2):** Реализация нативного перетаскивания файлов через `onDragDropEvent` и диалогов выбора файлов/папок.
3. **Итерация 3 (Фаза 3 + Фаза 4.1):** Сетевое сопряжение (Handshake), инпут для IP в модалке и исправление портов трансфера.
4. **Итерация 4 (Фаза 4.2 + Фаза 4.3 + Фаза 5.3):** Мобильный AirBridge клиент, переключение сетей и системный автозапуск.
