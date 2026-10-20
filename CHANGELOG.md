# Changelog

Все важные изменения проекта MacDrop фиксируются в этом файле.

## [fix/tauri-transfer-multi-endpoint-retry-and-probe-throttle] - 2026-10-20

### Многоэтапная отказоустойчивая передача файлов и устранение сетевого шторма при запуске
- **Многоэтапный ретрай и автоматический перебор эндпоинтов** ([src-tauri/src/transfer.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/transfer.rs)):
  - Ранее при кратковременном сетевом сбое или пробуждении удаленного ПК производилась единственная попытка повтора через 400 мс, после чего передача сразу завершалась ошибкой `client error (Connect)`.
  - Внедрена прогрессивная схема ретраев с таймингами (0 мс -> 500 мс -> 700 мс -> 800 мс -> 1000 мс).
  - Поддержан автоматический перебор всех доступных сетевых путей: основной порт (52520) -> повтор с перепроверкой обновленного DHCP IP -> альтернативный порт (8384) -> удаленный внешний/VPN IP (`remote_ip` / `remote_port`) -> финальная контрольная попытка.
  - При успехе на альтернативном порту или новом IP адрес в конфигурации `paired_devices` автоматически актуализируется для последующих отправок.
- **Устранение дублирования HTTP-заголовка Content-Length** ([src-tauri/src/transfer.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/transfer.rs)):
  - Метод `reqwest::RequestBuilder::body(Vec<u8>)` автоматически выставляет заголовок `Content-Length`. Ручное добавление `.header("content-length", ...)` приводило к дублированию заголовка в HTTP/1.1 запросе, что на некоторых ОС и прокси вызывало мгновенный сброс TCP-соединения (`TCP RST` / 400 Bad Request) в целях защиты от Request Smuggling. Ручной заголовок убран.
- **Полная цепочка диагностики сетевых ошибок (Error Chain)** ([src-tauri/src/transfer.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/transfer.rs)):
  - Функция `format_error_chain` рекурсивно извлекает полный стек причин из `std::error::Error::source`, позволяя точно локализовать низкоуровневые сбои ядра ОС (`Connection refused (os error 61)`, `No route to host (os error 65)`, `Operation timed out (os error 60)`).
- **Снижение сетевой нагрузки и устранение ARP-шторма фонового сканирования** ([src-tauri/src/discovery.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/discovery.rs)):
  - Фоновый перебор подсети (`probe_subnet`) запускался через 2.5 секунды после старта приложения, параллельно отправляя свыше 1000 запросов по двум подсетям с семафором 40. Это перегружало домашние Wi-Fi роутеры широковещательными ARP-запросами в первые секунды работы и приводило к сбросу TCP-пакетов при попытке отправить файл сразу после открытия приложения.
  - Начальная задержка увеличена до 8 секунд (давая UDP Peer Discovery отработать в штатном легком режиме), интервал сканирования увеличен до 60 секунд, семафор снижен до 16, а сканирование ограничено реальными активными локальными интерфейсами.
  - В ответах на `/api/ping` теперь учитывается поле `remotePort`: актуальный порт 52520 больше не перезаписывается на устаревший 8384 при приеме вторичного пинга.
- **Расширенное логирование отправляемых файлов** ([src-tauri/src/commands.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/commands.rs)):
  - В лог `Engine: Sending N file(s)` добавлены имена передаваемых файлов для мгновенной наглядности в системном журнале.

## [fix/tauri-transfer-resilience-and-notifications] - 2026-10-20

### Повышение отказоустойчивости сетевой передачи и нативные уведомления
- **Динамическое разрешение IP/порта пиров** ([src-tauri/src/transfer.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/transfer.rs)):
  - При отправке файлов проверяется таблица обнаруженных пиров (`discovered_peers`), чтобы всегда использовать свежий локальный IP и порт пира, даже если устройство переподключилось с другим IP по DHCP.
- **Повторная попытка (Retry Backoff) и таймаут подключения** ([src-tauri/src/transfer.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/transfer.rs)):
  - В `reqwest::Client` добавлен `connect_timeout(5s)` для предотвращения зависаний при недоступных хостах.
  - При сбое подключения (`res.is_err()`) добавлена быстрая повторная попытка через 400 мс на основной порт, что сглаживает кратковременные разрывы или фазу запуска удаленного сокета до переключения на альтернативный порт (8384).
- **Устранение модального окна macOS «Where is use_default?»** ([src-tauri/src/engine.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/engine.rs), [src-tauri/src/transfer.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/transfer.rs)):
  - Крейт `notify-rust` на macOS использует зависимость `mac-notification-sys`, которая при вызове уведомления обращается к AppleScript `get id of application "use_default"`. Из-за этого система считала, что требуется запустить приложение `use_default`, и открывала окно выбора приложений `Choose Application`.
  - Добавлена функция `show_desktop_notification`, которая на macOS напрямую отправляет уведомление через нативный `osascript display notification` без использования устаревших хаков Swizzling, а на остальных ОС использует `notify-rust`.

## [fix/tauri-bounded-dropzone-and-bidirectional-progress] - 2026-10-20

### Ограниченная зона сброса, нижний модуль передачи и двусторонний прогресс
- **Строгое ограничение зоны сброса файлов** ([src/renderer/src/hooks/useStableDropZone.ts](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/hooks/useStableDropZone.ts), [src/renderer/src/components/NativeDropZone.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/components/NativeDropZone.tsx)):
  - Сброс файлов больше не перехватывает все окно целиком.
  - Геометрический хит-тестинг (`checkInsideZone`) строго проверяет попадание курсора в прямоугольник зоны сброса (или на карточку пира в боковой панели).
  - Сброс в любую другую область окна (список истории, тулбар, пустое пространство) полностью игнорируется без ложных срабатываний передачи.
  - Добавлены модульные тесты в [useStableDropZone.test.ts](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/hooks/useStableDropZone.test.ts) для подтверждения отсечения дропов вне зоны.
- **Минималистичный главный экран с полноразмерной дроп-зоной и всплывающей плиткой передачи** ([src/renderer/src/designs/classic-native/index.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/designs/classic-native/index.tsx), [src/renderer/src/components/NativeDropZone.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/components/NativeDropZone.tsx)):
  - Журнал передач полностью убран с главного экрана, устранив визуальный шум и освободив максимум пространства для быстрой отправки файлов.
  - Дроп-зона вытянута на всю доступную высоту экрана (`flex-1 min-h-0`), оформлена как просторный, четко очерченный прямоугольник с удобными отступами, крупной иконкой и кнопкой выбора файлов.
  - При запуске передачи внизу дроп-зоны динамически появляется компактная плавающая плитка процесса (`animate-in slide-in-from-bottom-2`) с иконкой направления, бейджем, скоростью, временем до конца передачи, шкалой прогресса и кнопкой отмены. По завершении передачи плитка скрывается.
  - В правом верхнем углу дроп-зоны добавлена кнопка быстрого перехода к папке загрузок («Показать в Finder / Проводнике»).
- **Двустороннее отображение прогресса на передающей и принимающей сторонах** ([src-tauri/src/engine.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/engine.rs), [src-tauri/src/transfer.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/transfer.rs), [src/renderer/src/designs/classic-native/index.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/designs/classic-native/index.tsx)):
  - В `TransferProgress` добавлены поля `percent` и `bytes_per_second` с конструктором `TransferProgress::new`.
  - В Axum `handle_upload` на принимающей стороне интегрирован стриминг с расчетом скорости (байт/сек), процента завершения и отправкой события `progress-update` в окно каждые 50 мс.
  - При завершении передачи статус 100% отображается 600 мс с моментальным обновлением истории через `emit_status_changed()`.
  - В строке активной передачи в UI добавлены динамические бейджи и анимации: изумрудный индикатор получения и синий индикатор отправки, расчет оставшегося времени (ETA), точный размер и скорость передачи.

## [fix/tauri-window-wide-drop-and-transfer-retry] - 2026-10-20

### Полнооконный Drag-and-Drop и улучшенная диагностика передачи
- **Снятие ограничения геометрии дропа файлов** ([src/renderer/src/hooks/useStableDropZone.ts](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/hooks/useStableDropZone.ts), [src/renderer/src/components/DropZone.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/components/DropZone.tsx)):
  - Ранее сброс файлов срабатывал строго при попадании курсора внутрь прямоугольника зоны сброса (`wasOverZone`), из-за чего при перетаскивании на нижнюю половину окна (список истории) или при погрешностях DPR на Retina-дисплеях событие сброса полностью игнорировалось.
  - Теперь файлы, сброшенные в любую область окна MacDrop, гарантированно отправляются выбранному устройству (или конкретной карточке пира, если курсор был наведен на нее).
- **Диагностика резервного порта** ([src-tauri/src/transfer.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/transfer.rs)):
  - При неудачной попытке передачи на альтернативный порт (8384 / 52520) теперь логируется точная сетевая причина ошибки (`std::error::Error::source`).

## [fix/tauri-unlimited-file-transfer-size] - 2026-10-20

### Снятие ограничения на размер передаваемых файлов и детальная диагностика
- **Отключение лимита тела запроса в Axum (`DefaultBodyLimit::disable()`)** ([src-tauri/src/engine.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/engine.rs)):
  - По умолчанию Axum ограничивает входящие HTTP-запросы лимитом 2 МБ. При передаче любых файлов или архивов больше этого размера сервер аварийно сбрасывал соединение (`413 Payload Too Large`), что приводило к ошибке «Failed to send file».
  - Теперь лимит полностью отключен — файлы любого размера (гигабайты) корректно принимаются потоком напрямую на диск.
- **Информативная диагностика передачи файлов** ([src-tauri/src/transfer.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/transfer.rs)):
  - Добавлено подробное логирование HTTP-кодов ответа сервера (включая тело ошибки) и сетевых причин сбоев (причина в цепочке `std::error::Error::source`).

## [fix/tauri-sync-bridge-and-window-focus] - 2026-10-20

### Синхронная инициализация моста и надежное отображение запроса сопряжения
- **Синхронный мост Tauri (`bridge/index.ts`)** ([src/renderer/src/bridge/index.ts](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/bridge/index.ts)):
  - Ранее `initTauriBridge()` был асинхронным с отложенным `await import('@tauri-apps/api')`. Из-за этого при первом монтировании React `window.macdrop` был `undefined`, и хуки `useEffect` не регистрировали слушатели событий (`onPairingRequest`, `onStatusUpdate`, `onPeersUpdate`).
  - Теперь `@tauri-apps/api/core` и `@tauri-apps/api/event` импортируются статически, а `window.macdrop` создается синхронно с первой миллисекунды работы приложения.
- **Разворачивание окна и фокус при сопряжении** ([src-tauri/src/engine.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/engine.rs)):
  - При поступлении входящего запроса на сопряжение окно Windows автоматически восстанавливается из свернутого состояния (`unminimize`), отображается (`show`) и переводится в фокус (`set_focus`), чтобы диалоговое окно подтверждения сразу появлялось перед пользователем.
  - Событие `pairing-request` отправляется как в окно `main`, так и в общий `app_handle`.

## [fix/tauri-pairing-bidirectional-sync] - 2026-10-20

### Взаимная синхронизация сопряжения и кэша обнаружения
- **Немедленное обновление `discovered_peers` при сопряжении** ([src-tauri/src/engine.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/engine.rs)):
  - При получении запроса `/api/pair` (как при повторном сопряжении Re-pairing, так и при новом) устройство теперь сразу добавляется в кэш `discovered_peers` и вызывается событие `peers-update`. Это гарантирует, что даже если входящий UDP был заблокирован фаерволом, устройство сразу появится на радаре и в окне сопряжения.
- **Взаимный обратный пинг (Reciprocal Ping)** ([src-tauri/src/engine.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/engine.rs)):
  - После завершения сопряжения сервер асинхронно отправляет `/api/ping` на удаленное устройство, чтобы обе стороны синхронно перевели статус соединения в `local`.
- **Передача информации о платформе** ([src-tauri/src/commands.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/commands.rs)):
  - В тело запроса сопряжения добавлено поле `platform` (`darwin` / `win32`) для корректного отображения системных иконок.

## [fix/windows-firewall-auto-rules] - 2026-10-20

### Автоматическое открытие портов Windows Firewall
- **Новый модуль `firewall.rs`** ([src-tauri/src/firewall.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/firewall.rs)):
  - При запуске на Windows автоматически проверяет наличие правил Windows Firewall для TCP (52520, 8384) и UDP (8385).
  - Если правил нет — добавляет через `netsh advfirewall`. Идемпотентно (не дублирует существующие правила).
  - При отсутствии прав администратора не крашит приложение — логирует предупреждение с инструкцией.
- **NSIS Installer hooks** ([src-tauri/nsis-hooks.nsi](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/nsis-hooks.nsi)):
  - При установке через NSIS-инсталлер правила firewall добавляются автоматически (инсталлер запускается с правами админа).
  - При удалении — правила удаляются.
- **Улучшено сообщение об ошибке pair** ([src-tauri/src/commands.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/commands.rs)):
  - В ошибку подключения добавлена явная подсказка про Windows Firewall и номера портов.
- **Причина бага**: Windows Firewall по умолчанию блокирует все входящие подключения для нового приложения. Без явных правил: Windows не получает UDP discovery (не видит Mac), а Mac не может подключиться к Windows по TCP (pair/upload).

## [fix/tauri-cross-platform-discovery-and-pairing] - 2026-10-20

### Полный паритет сетевого обнаружения и сопряжения с Electron
- **Фильтрация виртуальных адаптеров и приоритизация Wi-Fi на Windows ([src-tauri/src/net_utils.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/net_utils.rs))**:
  - Расширен черный список виртуальных сетевых интерфейсов для Windows: теперь исключаются `vethernet*` (WSL2 / Hyper-V switch), `hyper-v*`, `wsl*`, `virtualbox*`, `tailscale*`, `zerotier*`, `tap*`, `tun*`, `npcap*`. Ранее на ПК с WSL виртуальный адаптер с адресом `172.24.x.x` ошибочно становился основным, из-за чего Windows транслировал UDP-пакеты и сканировал подсеть внутри виртуальной машины, а не в локальной сети `192.168.0.x`.
  - Добавлена система приоритизации (+95 очков) для интерфейсов Windows Wi-Fi (`"Wi-Fi"`, `"WiFi"`, `"Wireless"`, `"Беспроводная сеть"`), а также Ethernet-адаптеров Windows (+85).
- **Кросс-сканирование подсетей и периодический радар ([src-tauri/src/discovery.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/discovery.rs))**:
  - В `probe_subnet` добавлено автоматическое перекрестное сканирование смежных подсетей (при наличии `192.168.0.x` автоматически зондируется `192.168.1.x` и наоборот) точно так же, как в Electron-версии.
  - Добавлен периодический фоновый HTTP-радар каждые 30 секунд: если приложение на втором устройстве запустилось позже или брандмауэр Windows заблокировал входящий UDP-пакет на порт 8385, устройства автоматически обнаружат друг друга по HTTP.
  - На всех клиентах HTTP-сканирования установлен флаг `.no_proxy()`, исключающий влияние системных прокси и VPN-маршрутов на локальную связь.
- **Активный поиск при сопряжении по коду ([src-tauri/src/commands.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/commands.rs))**:
  - В `pair_device` перенесен механизм из Electron: если устройство с введенным кодом или именем еще не обнаружено в UDP-кэше, MacDrop не выдает ошибку, а немедленно запускает быстрое сканирование подсети `probe_subnet`, после чего находит устройство.
  - Устранена утечка IP-адреса VPN (`utun17`): в полезной нагрузке сопряжения (`payload.ip`) теперь передается фактический IP физического адаптера (`get_local_network_ips()`), а не адрес VPN-туннеля.
- **HTTP Health Check сопряженных устройств и предотвращение ложного оффлайна ([src-tauri/src/discovery.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/discovery.rs))**:
  - В цикл отслеживания устройств перенесен механизм `startHealthCheck` из Electron: перед тем как пометить устройство статусом `offline`, выполняется прямой HTTP-запрос `/api/ping` на сохраненный IP:порт сопряженного устройства. Если устройство отвечает по HTTP, его статус остается `local` (онлайн). Это устраняет проблему, когда брандмауэр Windows блокирует входящий UDP-радар (порт 8385), из-за чего через 8 секунд устройство ошибочно становилось «ОФЛАЙН».
  - В `probe_subnet()` добавлено автоматическое обновление времени последнего контакта (`last_seen`) и восстановление статуса `local` для сопряженных устройств при успешном HTTP-сканировании.
- **Повторные попытки рукопожатия и подробные причины ошибок ([src-tauri/src/commands.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/commands.rs))**:
  - В `pair_device` добавлены автоматические повторные попытки (retries) с паузой 350 мс при сбоях установки соединения, защищающие от кратковременных пауз сетевого сокета при старте приложения.
  - В сообщение об ошибке подключения выводится подробная цепочка причин (`cause`), полученная из системного сокета.
- **Прямой локальный транспорт файлов ([src-tauri/src/transfer.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/transfer.rs))**:
  - В клиенте отправки файлов `transfer.rs` включен режим `.no_proxy()` для предотвращения сбоев при передаче файлов по локальной сети при включенных VPN/прокси.

## [feat/tauri-windows-portable-and-ui-fix] - 2026-10-20

### Сборка Portable-версии для Windows, исправление прозрачности и устранение двойного заголовка
- **Сборка Portable-версии для Windows**:
  - Добавлен скрипт [scripts/copy-tauri-portable.js](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/scripts/copy-tauri-portable.js), который извлекает скомпилированный бинарник `macdrop.exe` из `src-tauri/target/release` и публикует его в `release/MacDrop-{version}-portable.exe` и `release/MacDrop-portable.exe`, а также копирует NSIS-инсталлятор.
  - В [package.json](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/package.json) добавлены команды:
    - `npm run package:tauri:win:portable` — быстрая сборка портативной версии без оверхеда на упаковку NSIS.
    - `npm run package:tauri:win:all` — полная сборка как NSIS-инсталлятора, так и Portable .exe.
    - `npm run package:tauri:win` теперь также автоматически копирует портативную версию в `release/`.
  - В [.github/workflows/build-tauri.yml](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/.github/workflows/build-tauri.yml) добавлен шаг подготовки портативных исполняемых файлов для автоматического включения в артефакты CI/CD.
- **Устранение двойного верхнего меню на Windows**:
  - В [src/renderer/src/designs/classic-native/index.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/designs/classic-native/index.tsx) кастомная панель заголовка `<header>` со светофорными кнопками Mac и дублирующимся заголовком "MacDrop" теперь отображается **только на macOS** (`{isMac && ...}`). На Windows используется нативный системный заголовок окна DWM.
  - Кнопка настроек (шестеренка) на Windows вынесена в правый верхний угол блока устройств в сайдбаре (`ПОДКЛЮЧЕННЫЕ УСТРОЙСТВА`) и в правый угол строки отправки в [src/renderer/src/components/NativeDropZone.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/components/NativeDropZone.tsx) (`headerRight`).
- **Исправление прозрачности окна и артефактов границ на Windows**:
  - В [src-tauri/src/lib.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/lib.rs) добавлен блок `#[cfg(target_os = "windows")]` с аппаратной поддержкой Windows 11 Mica (в темной теме), а также автоматическим фолбэком на Tabbed и Acrylic на Windows 10.
  - В [src-tauri/tauri.conf.json](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/tauri.conf.json) в `windowEffects.effects` добавлен эффект `"micaDark"`.
  - В [src/renderer/src/App.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/App.tsx) корневой контейнер адаптирован под платформу: на macOS сохраняется скругление `rounded-[14px]` и `bg-transparent`, а на Windows применяется фоновое размытие с благородным темным оттенком `bg-[#121318]/85 backdrop-blur-2xl` и прямыми углами `rounded-none border-0`, что убирает артефакты дыр в углах окна и делает текст контрастным и легко читаемым.
  - В [src/renderer/src/designs/classic-native/index.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/designs/classic-native/index.tsx) скорректирован фон сайдбара на Windows (`bg-[#0e0f14]/70`) для создания четкой визуальной иерархии между сайдбаром и основной областью.

## [fix/tauri-pairing-and-status-events] - 2026-10-14

### Исправление сопряжения и обновления списка устройств в Tauri
- **Параллельное HTTP-сканирование подсети (`discovery.rs`)**:
  - В [src-tauri/src/discovery.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/discovery.rs) реализована функция `probe_subnet()` с асинхронным пулом (семафор на 40 воркеров). Она сканирует адреса подсети (`192.168.0.1..254`) по портам 52520 и 8384 через эндпоинт `/api/ping`. Это позволяет находить устройства в сети, даже когда UDP-радар (порт 8385) блокируется роутером (AP Isolation) или брандмауэром. Сканирование автоматически стартует через 2.5 сек после запуска и при каждом ручном обновлении радара.
- **Устранение взаимной блокировки (Deadlock) при сопряжении (`engine.rs`)**:
  - В [src-tauri/src/engine.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/engine.rs) внутри `handle_pair` захватывался `RwLockWriteGuard` (`state.config.write().await`), после чего сразу вызывался `state.emit_status_changed().await`, который внутри вызывал `get_status()` и пытался взять лок на чтение (`self.config.read().await`). Поскольку `tokio::sync::RwLock` не является реентерабельным, асинхронная задача мгновенно зависала намертво: эмит события не происходил, а HTTP-ответ клиенту не отправлялся. Лок на запись изолирован в явный блок, освобождаемый до вызова `emit_status_changed()`.
- **Эмит статуса в Rust-бэкенде (`src-tauri`)**:
  - В [src-tauri/src/engine.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/engine.rs) метод `emit_status_changed()` теперь эмитит оба события: `status-update` и `status-changed`. Фронтенд-мост MacDrop ожидает именно `status-update`, поэтому при входящем и исходящем сопряжении список устройств в UI не обновлялся.
  - Все прямые вызовы `handle.emit("status-changed")` в `engine.rs`, `commands.rs` и `discovery.rs` переведены на вызов единого метода `state.emit_status_changed().await`.
- **Фолбэк портов и сохранение активного порта при сопряжении (`commands.rs`)**:
  - В [src-tauri/src/commands.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/commands.rs) логика фолбэка между портами 52520 и 8384 отвязана от флага `has_explicit_port`: теперь при ошибке соединения на любой стандартный порт автоматически опрашивается альтернативный порт MacDrop (52520 ↔ 8384).
  - При успешном сопряжении в конфигурацию сохраняется `actual_port` (порт, ответивший на запрос), а не исходный порт до фолбэка.
  - В случае ошибки рукопожатия в лог выводится подробное описание сетевой ошибки (`err`), а не общая маскирующая фраза.
- **Сохранение портов удаленных устройств (`config.rs`)**:
  - В [src-tauri/src/config.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/config.rs) удалена перезапись портов сопряженных устройств в цикле миграции с 8384 на 52520, ломавшая подключение к Electron-клиентам.
- **Изоляция исходников Electron (`src/`)**:
  - Все ранее внесенные изменения в каталог `src/` полностью отменены. Папка `src/` оставлена в исходном неизменном состоянии.

## [feat/tauri-fixes - Итерация 7 (Фаза 4 + 5.3: Мобильный клиент AirBridge, виртуальное устройство «Телефон», реальный IP и автозапуск)] - 2026-10-14

### Мобильный веб-клиент Web Drop, виртуальный узел `mobile-web`, фильтрация IP и системный автозапуск
- **4.2. Полноценный мобильный клиент AirBridge (Web Drop) в Rust-бэкенде**:
  - Создан автономный модуль [src-tauri/src/mobile_web.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/mobile_web.rs) с двухвкладочным мобильным веб-клиентом (чистый HTML/CSS/JS без внешних CDN):
    - Вкладка «Отправить на ПК»: загрузка любых файлов и медиа с расчетом скорости `formatBytes(speedBytes) + '/с'`, динамическим прогресс-баром и тактильным откликом `navigator.vibrate`.
    - Вкладка «Скачать с ПК»: автоматический опрос `/api/mobile/files?token=...`, список доступных файлов с форматированным временем и размером, индивидуальное и пакетное скачивание.
    - Встроенный Heartbeat: периодический пинг `/api/mobile/status?token=...` каждые 15 секунд для поддержания активной сессии.
    - Эндпоинт логотипа: `/api/mobile/logo`, отдающий стильный векторный SVG-логотип MacDrop.
  - В [src-tauri/src/engine.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/engine.rs):
    - Добавлено поле `last_mobile_seen` и методы `is_mobile_session_active()` и `mark_mobile_activity()`.
    - При активной сессии телефона (<60 сек) или наличии файлов в очереди `mobile_queue`, в `getStatus().pairedDevices` автоматически подставляется виртуальное устройство `mobile-web` («Телефон (Web Drop)», `port: 52520`, `connectionMode: "local"`, `platform: "mobile"`).
    - Обновление активности мобильного клиента интегрировано во все эндпоинты: `/mobile`, `/api/mobile/status`, `/api/mobile/upload`, `/api/mobile/files`, `/api/mobile/download`.
  - В [src-tauri/src/discovery.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/discovery.rs):
    - В цикле фоновой очистки реализован таймаут мобильной сессии: если телефон неактивен более 60 секунд и очередь пуста, сессия сбрасывается с мгновенным эмитом `status-changed` (виртуальное устройство исчезает из сайдбара).
  - В [src-tauri/src/transfer.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/transfer.rs):
    - В функции `execute_peer_transfer` реализована отправка на устройство `mobile-web`: директории автоматически архивируются в ZIP через `zip_directory`, файлы помещаются в начало `mobile_queue`, эмитится событие прогресса и запись в историю (`peer_device_id: "mobile-web"`, `status: "completed"`).
- **4.3. Определение реального IP-адреса сети при смене сети (Wi-Fi ↔ Новая сеть)**:
  - Создан модуль [src-tauri/src/net_utils.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/net_utils.rs) с функцией `get_local_network_ips()` на базе `local_ip_address::list_afinet_netifas()`:
    - Интеллектуальный расчет приоритетов интерфейсов: высший приоритет для `en0` (+100) и `en1` (+90) (основной Wi-Fi / Ethernet на macOS).
    - Полная фильтрация виртуальных и туннельных адаптеров (`utun*` VPN, `bridge*`, `vmnet*`, `vboxnet*`, `p2p*`, `awdl*`, `llw*`, `gif*`, `stf*`), а также loopback `127.*` и APIPA `169.254.*`.
    - Использование реальных IP в `commands::get_mobile_share_info` (первый адрес берется для формирования QR-кода), в `EngineState::get_status()` и в расчете широковещательных UDP адресов `discovery::get_broadcast_addrs`.
- **5.3. Системный автозапуск (macOS Login Items через LaunchAgent)**:
  - Создан модуль [src-tauri/src/autostart.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/autostart.rs), управляющий файлом `~/Library/LaunchAgents/com.macdrop.desktop.plist`.
  - При включении или выключении автозапуска через `toggle_autostart` или `save_config` состояние мгновенно синхронизируется с операционной системой.
  - При старте приложения в [lib.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/lib.rs) выполняется верификация и синхронизация системного автозапуска.
- **Кросс-версионная сетевая совместимость (Dual-Port Engine 52520 + 8384)**:
  - **Динамический фолбэк портов в `pair_device`**: при прямом вводе IP без указания порта код автоматически проверяет кэш обнаруженных и сопряженных устройств (`discovered_peers` / `paired_devices`). Если узел слушает порт 8384 (например, ПК с Electron или старой сборкой), подключение автоматически идет на 8384. При отказе соединения (`Connection refused`) выполняется автоматическая попытка на альтернативный порт (`52520 <-> 8384`).
  - **Передача реального порта в `PairingModal.tsx`**: при клике по найденному устройству теперь передается `${peer.ip}:${peer.port}` (ранее передавался чистый `peer.ip` и порт терялся).
  - **Dual-Port HTTP Server**: в [engine.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/engine.rs) параллельно с основным портом 52520 запущен фоновый compatibility-листенер на порту 8384 для бесшовного приема запросов от любых клиентов.
  - **Авто-переключение порта при передаче файлов**: в [transfer.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/transfer.rs) при сбое соединения к сопряженному устройству трансфер автоматически повторяется на альтернативный порт с сохранением актуального порта в конфиг.
- **Тестирование**:
  - Добавлены юнит-тесты `test_generate_launch_agent_plist` в `autostart.rs`, `test_mobile_web_generation` в `mobile_web.rs`, `test_get_local_network_ips_not_empty` в `net_utils.rs`, `test_mobile_session_and_virtual_device` в `engine.rs` и `test_transfer_to_mobile_web` в `transfer.rs`. Все 18 тестов успешно проходят.

## [feat/tauri-fixes - Итерация 6 (Фаза 3: Сопряжение устройств, радар и унификация портов)] - 2026-10-14

### Сетевое сопряжение (Pairing Handshake), ручной ввод IP, Heartbeat радара и единый порт
- **3.1. Сетевой Handshake в `pair_device` и взаимная авторизация**:
  - В [src-tauri/src/commands.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/commands.rs): команда `pair_device` полностью переписана — парсит IP/порт или находит устройство в кэше `discovered_peers`, генерирует локальный токен безопасности и отправляет сетевой HTTP-запрос `POST /api/pair` с таймаутом 35 секунд.
  - В [src-tauri/src/engine.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/engine.rs):
    - В обработчике `handle_pair` поддержана проверка уже сопряженных устройств (автоматический ответ 200 OK без повторных модальных окон).
    - Для новых устройств генерируется `requestId`, регистрируется канал `tokio::sync::oneshot` и эмитится Tauri Event `pairing-request`.
    - Подключен `ConnectInfo<SocketAddr>` для точного определения IP-адреса входящего узла.
  - Реализована команда `commands::respond_pairing_request` (зарегистрирована в [src-tauri/src/lib.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/lib.rs)), передающая вердикт пользователя (`approved`) в канал ожидания. При одобрении устройство сохраняется в `cfg.paired_devices` с эмитом `status-changed` в интерфейс. При отклонении возвращается HTTP 403 Forbidden, а при бездействии — HTTP 408 Request Timeout.
- **3.2. Ручной ввод IP-адреса в UI модального окна сопряжения**:
  - В [PairingModal.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/components/PairingModal.tsx) добавлен нативный блок прямого подключения по IP без необходимости вводить PIN-коды.
  - Реализована строгая валидация формата (IPv4 / IPv6 / хостнейм, поддержка порта вида `192.168.1.50:52520`), обработка клавиши Enter и отображение спиннера ожидания.
  - Добавлены ключи локализации в [ru.ts](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/i18n/locales/ru.ts) и [en.ts](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/i18n/locales/en.ts).
- **3.3. Автоматический фоновый опрос и очистка устаревших узлов (Radar Heartbeat)**:
  - В [src-tauri/src/discovery.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/discovery.rs) запущен фоновый цикл очистки (каждые 2 сек):
    - Необнаруженные более 6 секунд узлы удаляются из `discovered_peers` с мгновенным эмитом `peers-update`.
    - Сопряженные устройства получают статус `local` при приеме UDP-пакета и автоматически переводятся в `offline` при отсутствии сигнала более 8 секунд с отправкой события `status-changed`.
- **4.1. Унификация сетевого порта передачи файлов (8384 -> 52520)**:
  - В [src-tauri/src/config.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/config.rs), [src-tauri/src/engine.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/engine.rs) и [src-tauri/src/discovery.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/discovery.rs) все дефолтные порты заменены на единый актуальный порт `52520`.
  - В `load_config` добавлена автоматическая миграция существующих конфигураций на диске с порта `8384` на `52520`.

## [feat/tauri-fixes - Итерация 5 (Единый нативный пикер файлов и папок с авто-архивацией)] - 2026-10-14

### Единая кнопка выбора и гибридный мультиселект (файлы + папки)
- **Унификация кнопки дропзоны**:
  - В [NativeDropZone.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/components/NativeDropZone.tsx) удалена раздельная кнопка «Выбрать папку». Теперь в дропзоне расположена одна универсальная кнопка macOS: «Выбрать файлы и папки...» (`chooseFilesBtn`).
  - Обновлены языковые файлы [ru.ts](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/i18n/locales/ru.ts) и [en.ts](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/i18n/locales/en.ts).
- **Нативный гибридный диалог macOS (NSOpenPanel через objc2)**:
  - Ограничение крейта `rfd` (который принудительно разделяет выбор файлов и папок) преодолено прямой интеграцией с `NSOpenPanel` через `objc2`:
    - `setCanChooseFiles: true`
    - `setCanChooseDirectories: true`
    - `setAllowsMultipleSelection: true`
  - Вызов модального окна безопасно выполняется в основном потоке AppKit через `app.run_on_main_thread` с каналом `tokio::sync::oneshot`.
  - Пользователь может в одном диалоге с зажатыми Cmd/Shift выделить одновременно любое количество файлов и папок.
- **Автоматическая архивация папок в ZIP и очистка временных файлов**:
  - В [src-tauri/src/transfer.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/transfer.rs): папки автоматически упаковываются в индивидуальные архивы `{folder_name}.zip` через `zip_directory`, а временные файлы удаляются сразу после завершения отправки.
  - В [src-tauri/src/engine.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/engine.rs): веб-интерфейс мобильной раздачи (`handle_mobile_download`) также поддерживает скачивание сброшенных папок в виде ZIP.

## [feat/tauri-fixes - Итерация 4 (Фаза 2: Нативный Drag & Drop и файловые диалоги)] - 2026-10-12

### Нативный Drag & Drop Webview API, хит-тестинг и диалоги macOS
- **2.1. Переход на нативный Tauri Webview DragDrop API (WebKit Safari)**:
  - В [src/renderer/src/bridge/index.ts](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/bridge/index.ts) и [src/renderer/src/vite-env.d.ts](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/vite-env.d.ts) реализован подписчик `window.macdrop.onDragDrop`, вызывающий `getCurrentWebview().onDragDropEvent(...)`.
  - В [useStableDropZone.ts](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/hooks/useStableDropZone.ts) реализована обработка нативных событий `enter`, `over`, `drop`, `leave` с физическим пересчетом координат курсора через `position / window.devicePixelRatio`.
  - Предотвращено задвоение событий с DOM в среде Tauri при сохранении полной обратной совместимости с HTML5 Drag & Drop для Electron/Vitest.
  - Добавлен динамический счетчик файлов при пакетном сбросе (например, `document.pdf (+4)`).
  - Устранена порча кириллических имен и спецсимволов: в [src-tauri/src/engine.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/engine.rs) функция `urlencoding_decode` переведена на надежный парсер `urlencoding::decode` с обработкой пробелов и UTF-8.
- **2.2. Множественный выбор файлов в системном диалоге (Cmd/Shift multi-select)**:
  - В [src-tauri/src/commands.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/commands.rs) добавлен вызов `activateIgnoringOtherApps: true` на macOS для гарантированной передачи фокуса и обработки системных модификаторов клавиш Cmd/Shift в `NSOpenPanel`.
  - Добавлена подстановка стартовой директории из `config.target_folder` / `dirs::download_dir()`.
- **2.3. Кнопка выбора папки и интеграция с сайдбаром**:
  - В [NativeDropZone.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/components/NativeDropZone.tsx) добавлен нативный блок кнопок macOS («Выбрать файлы» и «Выбрать папку») с иконками и локализацией `t('dropzone.chooseFolder')`.
  - В [useAppLogic.ts](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/hooks/useAppLogic.ts) и [classic-native/index.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/designs/classic-native/index.tsx) экспортирован и подключен вызов `handleChooseFolder`.
  - Реализован хит-тестинг устройств в сайдбаре: узлы помечены атрибутом `data-device-id`, при наведении файла из Finder плитка устройства в сайдбаре подсвечивается синим (`ring-1 ring-[#007AFF]`), а сброс файла отправляет его напрямую на выбранный узел.

## [feat/tauri-fixes - Итерация 3 (Native macOS Traffic Lights & Smooth Corners)] - 2026-10-12

### Нативные кнопки macOS и аппаратное скругление всех 4 углов окна
- **Устранение дефекта квадратных нижних углов (Sharp 90° Bottom Corners Artifact)**:
  - В [tauri.conf.json](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/tauri.conf.json) конфигурация окна переведена на `"decorations": true`, `"titleBarStyle": "Overlay"` и `"hiddenTitle": true`. В связке с `NSWindowStyleMask::Titled | NSWindowStyleMask::FullSizeContentView` Window Server macOS теперь аппаратно скругляет **все 4 угла окна** (и верхние, и нижние) с одинаковым системным радиусом 14px и плавной тенью, устраняя квадратную рамку в нижних углах.
  - В [src-tauri/src/lib.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/lib.rs) слой `contentView.layer` настраивается на `cornerRadius: 14.0` и `masksToBounds: true`, а также вызывается `[ns_window invalidateShadow]`, синхронизируя тень Window Server с границами размытия.
- **Подключение настоящих нативных кнопок Traffic Lights (красный, желтый, зеленый)**:
  - В [tauri.conf.json](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/tauri.conf.json) задан `trafficLightPosition: { "x": 16, "y": 20 }` и `"acceptFirstMouse": true`. Нативные кнопки системно центрируются по вертикальной оси кастомной шапки окна высотой 38px.
  - В [src-tauri/src/lib.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/lib.rs) нативные кнопки (`Close`, `Miniaturize`, `Zoom`) остаются видимыми и активными.
  - В [classic-native/index.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/designs/classic-native/index.tsx) на macOS вместо simulated HTML-кнопок выделен прозрачный контейнер `w-[68px] pointer-events-none`. Пользователь получает:
    - Системные иконки (`x`, `-`, `+`) при наведении курсора;
    - Аппаратное затемнение/десатурацию кнопок при неактивном окне;
    - Нативное контекстное меню тайлинга окон macOS Sequoia / Sonoma при наведении на зеленую кнопку;
    - Сохранение кастомного поведения `Fill` при двойном клике по пустому пространству шапки.
    - Fallback: на других ОС (Windows/Linux) отображаются стилизованные веб-кнопки управления.

## [feat/tauri-fixes - Итерация 2 (Frosted Glass Modals)] - 2026-10-12

### Полупрозрачность и матовое стекло во всех модальных окнах
- **Унификация оверлеев и карточек модальных окон под нативный macOS Frosted Glass**:
  - **Оверлеи (Backdrop scrim)**: переведены с плотного `bg-black/65 backdrop-blur-sm` на элегантный `bg-black/40 backdrop-blur-md` во всех модальных диалогах, что позволяет системному размытию (Vibrancy) и фону десктопа мягко просвечивать сквозь диалог.
  - **Карточки диалогов (Modal Cards)**: заменены глухие сплошные заливки (`bg-[#161616]`, `bg-[#1C1C1F]`) на полупрозрачные контейнеры матового стекла `bg-[#1c1c20]/80 backdrop-blur-2xl border border-white/10 rounded-[14px] shadow-[0_24px_50px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.08)]`.
  - **Шапки и элементы управления (Headers & Controls)**:
    - [SettingsModal.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/components/SettingsModal.tsx): полупрозрачная шапка `bg-white/[0.04] backdrop-blur-md border-b border-white/[0.08]`, сегментированные переключатели `bg-black/30 border border-white/[0.08]`, активные вкладки `bg-white/[0.14] text-white shadow-sm`.
    - [TargetFolderSetting.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/components/settings/TargetFolderSetting.tsx): стеклянный блок пути и кнопка выбора.
    - [ToggleSetting.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/components/settings/ToggleSetting.tsx) и [UpnpStatusSection.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/components/settings/UpnpStatusSection.tsx): аккуратные полупрозрачные подложки и разделители `border-white/[0.08]`.
    - [UpdatesSection.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/components/settings/UpdatesSection.tsx): карточки статусов и кнопки перезапуска переведены на `bg-black/30` и `bg-white/[0.08]`.
    - [LogsSection.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/components/settings/LogsSection.tsx): поисковая строка, сегментированный фильтр уровней, терминальный блок логов и кнопки управления адаптированы под полупрозрачный стиль.
    - [PairingModal.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/components/PairingModal.tsx): радар связи, кнопки вызова QR и карточка выбора интерфейса переведены на стеклянные токены.
    - [PairingRequestModal.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/components/PairingRequestModal.tsx): карточка входящего запроса на сопряжение и блок устройства оформлены в стиле macOS HUD.
    - [DeviceContextMenu.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/components/DeviceMenu/DeviceContextMenu.tsx): контекстное меню устройств получило `bg-[#1c1c20]/90 backdrop-blur-2xl border border-white/10`.
    - [DeviceRenameModal.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/components/DeviceMenu/DeviceRenameModal.tsx), [DeviceHistoryModal.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/components/DeviceMenu/DeviceHistoryModal.tsx), [DeviceUnpairModal.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/components/DeviceMenu/DeviceUnpairModal.tsx): все модальные окна управления устройствами приведены к единому стандарту матового стекла.

## [feat/tauri-fixes - Итерация 1 (Фаза 1 + Фаза 5.1/5.2)] - 2026-10-12

### macOS Vibrancy, оконный зум, надежность настроек и очистка логов
- **Восстановление размытия фона macOS (Window Vibrancy, пункт 1.10 чеклиста)**:
  - В [src-tauri/Cargo.toml](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/Cargo.toml) включена обязательная для прозрачности фича `macos-private-api` в зависимостях `tauri`.
  - В [src-tauri/tauri.conf.json](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/tauri.conf.json) добавлены `"macOSPrivateApi": true` и нативная конфигурация `"windowEffects"` с эффектом `"underWindowBackground"` и скруглением 14px.
  - В [src-tauri/src/lib.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/lib.rs) вызов `apply_vibrancy` обернут в `app.run_on_main_thread` для безопасного выполнения в главном UI-потоке AppKit.
  - В [App.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/App.tsx) и [classic-native/index.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/designs/classic-native/index.tsx) устранены наслоения темных фонов (`bg-[#161616]/80` поверх `bg-[#161616]/80`), установлена чистая прозрачность корневых контейнеров с легким матовым стеклом на панелях (`bg-[#1e1e22]/50`, `bg-[#141416]/50`).
- **Разделение режимов окна: Fill по шапке и Zoom по зеленой кнопке (пункты 1.2, 1.4 чеклиста)**:
  - Добавлена выделенная команда `fill_window` в [src-tauri/src/commands.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/commands.rs) и метод `fillWindow` в [bridge/index.ts](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/bridge/index.ts).
  - Двойной клик по шапке окна теперь вызывает **Fill** (максимизирует и восстанавливает размер окна на рабочем столе без смены Spaces).
  - Зеленая кнопка Traffic Lights продолжает отвечать за **Zoom / Fullscreen** с системной анимацией macOS.
- **Устранение взаимного сброса тумблеров настроек (пункты 8.3, 8.4 чеклиста)**:
  - В [src/renderer/src/hooks/useAppLogic.ts](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/hooks/useAppLogic.ts) `handleToggleAutoStart`, `handleToggleNotifications` и `handleSetLanguage` теперь передают полный объединенный объект конфига (`{ ...config, ... }`).
  - В [src-tauri/src/commands.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/commands.rs) команда `save_config` дополнена поддержкой частичного слияния полей JSON, предотвращая перезапись неуказанных настроек.
- **Исправление очистки логов (пункт 9.3 чеклиста)**:
  - В [src-tauri/src/commands.rs](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/src/commands.rs) команда `clear_logs` отправляет системное событие `logs-cleared` во фронтенд через `app.emit("logs-cleared", ())`.
  - В [src/renderer/src/components/settings/LogsSection.tsx](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/components/settings/LogsSection.tsx) добавлено немедленное локальное обнуление стейта `setLogs([])` и `setExpandedIds({})`.

## [feat/tauri-migration - Logo Update] - 2026-10-12

### Обновление логотипа приложения и генерация иконок для всех платформ
- **Новый минималистичный логотип (3D Matte Glass Apple + Windows)**:
  - Исходник [Minimalist_app_icon_with_logos_2K_20261012132749.jpg](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/Minimalist_app_icon_with_logos_2K_20261012132749.jpg) обработан: геометрически вырезана матовая эмблема с сохранением мягких рассеянных теней.
  - Применен эталонный Apple HIG squircle с 4x суперсэмплингом и прозрачным фоном.
  - Обновлены ключевые ассеты: [public/icon.png](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/public/icon.png) и [src/renderer/src/assets/logo.png](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src/renderer/src/assets/logo.png).
  - Выполнена перегенерация всех иконок Tauri (`icon.icns`, `icon.ico`, `icon.png`, Android/iOS наборы).
  - Собрано и протестировано обновленное релизное приложение [MacDrop.app](file:///Users/andrey/Developer/active/project-macdrop/MacDrop/src-tauri/target/release/bundle/macos/MacDrop.app) (19.28 МБ).
  - Сброшен кэш иконок Finder.


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


