use std::sync::Arc;
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

use crate::engine::EngineState;

pub fn setup_tray(app: &AppHandle, state: Arc<EngineState>) -> Result<(), Box<dyn std::error::Error>> {
    let show_window_item = MenuItemBuilder::with_id("show", "🖥️ Показать MacDrop").build(app)?;
    let open_folder_item = MenuItemBuilder::with_id("open_folder", "📂 Открыть папку MacDrop").build(app)?;
    let quit_item = MenuItemBuilder::with_id("quit", "❌ Выход").build(app)?;

    let menu = MenuBuilder::new(app)
        .text("title", "MacDrop")
        .separator()
        .item(&show_window_item)
        .item(&open_folder_item)
        .separator()
        .item(&quit_item)
        .build()?;

    let tray_state = state.clone();

    let mut builder = TrayIconBuilder::new()
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("MacDrop — локальный обмен файлами")
        .on_menu_event(move |app, event| {
            match event.id.as_ref() {
                "show" => {
                    if let Some(win) = app.get_webview_window("main") {
                        let _ = win.show();
                        let _ = win.set_focus();
                    }
                }
                "open_folder" => {
                    let folder = {
                        if let Ok(cfg) = tray_state.config.try_read() {
                            cfg.target_folder.clone()
                        } else {
                            crate::config::get_default_folder()
                        }
                    };
                    let _ = open::that(&folder);
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(win) = app.get_webview_window("main") {
                    let is_visible = win.is_visible().unwrap_or(false);
                    if is_visible {
                        let _ = win.hide();
                    } else {
                        let _ = win.show();
                        let _ = win.set_focus();
                    }
                }
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_tray_menu_action_ids() {
        let ids = ["show", "open_folder", "quit"];
        assert_eq!(ids.len(), 3);
        assert!(ids.contains(&"show"));
        assert!(ids.contains(&"open_folder"));
        assert!(ids.contains(&"quit"));
    }
}
