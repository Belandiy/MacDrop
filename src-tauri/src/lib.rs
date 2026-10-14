pub mod commands;
pub mod config;
pub mod discovery;
pub mod engine;
pub mod logger;
pub mod transfer;
pub mod tray;

use std::sync::Arc;
use tauri::Manager;

use crate::config::load_config;
use crate::engine::{start_http_server, EngineState};
use crate::logger::AppLogger;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let cfg = load_config();
    let app_logger = AppLogger::new();
    let engine_state = Arc::new(EngineState::new(cfg, app_logger.clone()));

    // Launch background HTTP server
    let server_state = engine_state.clone();
    tauri::async_runtime::spawn(async move {
        start_http_server(server_state).await;
    });

    // Launch background UDP Peer Discovery (AirDrop radar)
    let discovery_state = engine_state.clone();
    tauri::async_runtime::spawn(async move {
        crate::discovery::start_peer_discovery(discovery_state).await;
    });

    tauri::Builder::default()
        .setup({
            let state_for_setup = engine_state.clone();
            move |app| {
                state_for_setup.set_app_handle(app.handle().clone());
                app.manage(state_for_setup.clone());
                let _ = crate::tray::setup_tray(app.handle(), state_for_setup);

                #[cfg(target_os = "macos")]
                {
                    if let Some(win) = app.get_webview_window("main") {
                        let _ = win.set_shadow(true);
                        let win_clone = win.clone();
                        let _ = app.run_on_main_thread(move || {
                            let _ = window_vibrancy::apply_vibrancy(
                                &win_clone,
                                window_vibrancy::NSVisualEffectMaterial::UnderWindowBackground,
                                Some(window_vibrancy::NSVisualEffectState::Active),
                                Some(14.0),
                            );

                            if let Ok(ns_window_raw) = win_clone.ns_window() {
                                unsafe {
                                    use objc2::runtime::AnyObject;
                                    let ns_window = ns_window_raw as *mut AnyObject;

                                    // Ensure contentView layer clips to match 14px rounded corners
                                    let content_view: *mut AnyObject = objc2::msg_send![ns_window, contentView];
                                    if !content_view.is_null() {
                                        let () = objc2::msg_send![content_view, setWantsLayer: true];
                                        let layer: *mut AnyObject = objc2::msg_send![content_view, layer];
                                        if !layer.is_null() {
                                            let () = objc2::msg_send![layer, setCornerRadius: 14.0f64];
                                            let () = objc2::msg_send![layer, setMasksToBounds: true];
                                        }
                                    }

                                    // Invalidate shadow to recalculate native drop shadow for rounded borders
                                    let () = objc2::msg_send![ns_window, invalidateShadow];
                                }
                            }
                        });
                    }
                }

                Ok(())
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_config,
            commands::save_config,
            commands::get_status,
            commands::select_folder,
            commands::open_folder,
            commands::open_file,
            commands::get_logs,
            commands::clear_logs,
            commands::open_logs_folder,
            commands::get_mobile_share_info,
            commands::regenerate_mobile_token,
            commands::get_discovered_peers,
            commands::scan_nearby_peers,
            commands::pair_device,
            commands::unpair_device,
            commands::update_device_name,
            commands::remove_device,
            commands::toggle_device_receive,
            commands::get_device_history,
            commands::toggle_autostart,
            commands::minimize_window,
            commands::maximize_window,
            commands::fill_window,
            commands::close_window,
            commands::start_dragging,
            commands::resize_window,
            commands::send_dropped_files,
            commands::pick_and_send_files,
            commands::pick_and_send_folder,
            commands::cancel_transfer,
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
