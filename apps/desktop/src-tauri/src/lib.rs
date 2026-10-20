//! OVERBOOM als Desktop-App: ein Fenster mit dem Web-Build (dist/) als Inhalt.
//! Der Spielcode bleibt derselbe; gerätespezifisches läuft über `packages/platform/src/tauri.ts`.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("OVERBOOM konnte nicht gestartet werden");
}
