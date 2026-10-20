// Unter Windows kein zusätzliches Konsolenfenster im Release-Build
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    overboom_lib::run()
}
