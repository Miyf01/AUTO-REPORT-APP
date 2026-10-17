#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use arboard::Clipboard;
use chrono::{Datelike, Local, NaiveDate};
use regex::Regex;
use std::collections::BTreeMap;

#[derive(Debug, Clone)]
struct Entry {
    nama: String,
    kategori: String,
    status: String,
    tanggal: NaiveDate,
}

// Fungsi untuk membaca format "15 oktober 2026"
fn parse_tanggal_indo(line: &str) -> Option<NaiveDate> {
    let mut normalized = line.trim().to_lowercase();
    let bulan_map = [
        ("januari", "01"), ("februari", "02"), ("maret", "03"), ("april", "04"),
        ("mei", "05"), ("juni", "06"), ("juli", "07"), ("agustus", "08"),
        ("september", "09"), ("oktober", "10"), ("november", "11"), ("desember", "12"),
    ];
    for (indo, angka) in bulan_map.iter() {
        normalized = normalized.replace(indo, *angka);
    }
    NaiveDate::parse_from_str(&normalized, "%d %m %Y").ok()
}

#[tauri::command]
async fn generate_laporan(input_text: String) -> Result<String, String> {
    let mut data: Vec<Entry> = Vec::new();
    let mut tanggal_saat_ini = NaiveDate::from_ymd_opt(2000, 1, 1).unwrap();

    // Membaca baris demi baris dari teks yang diketik di aplikasi
    for baris in input_text.lines() {
        let baris = baris.trim();
        if baris.is_empty() { continue; }

        if let Some(parsed_date) = parse_tanggal_indo(baris) {
            tanggal_saat_ini = parsed_date;
        } else if baris.contains(':') {
            let parts: Vec<&str> = baris.splitn(2, ':').collect();
            if parts.len() != 2 { continue; }

            let kiri = parts[0].trim();
            let kanan = parts[1].trim().to_lowercase();

            let status = if kanan.contains("acc") { "ACC" }
            else if kanan.contains("belum") || kanan.contains("besok") { "Belum Desain" }
            else if kanan.contains("proses") { "Proses Desain" }
            else { "Preview" };

            let kategori = if kiri.contains("GR") || kiri.contains("SM") || kiri.contains("SP") || kiri.contains("BR") || kiri.contains("PN") || kiri.contains("FB") { "GR" }
            else if kiri.contains("OR") { "OR" }
            else if kiri.contains("3D") { "3D" }
            else { "UNKNOWN" };

            data.push(Entry {
                nama: kiri.to_string(),
                kategori: kategori.to_string(),
                status: status.to_string(),
                tanggal: tanggal_saat_ini,
            });
        }
    }

    let mut grup_tanggal: BTreeMap<NaiveDate, Vec<Entry>> = BTreeMap::new();
    for entry in data.iter() {
        grup_tanggal.entry(entry.tanggal).or_insert_with(Vec::new).push(entry.clone());
    }

    let mut laporan = String::new();
    laporan.push_str("=== LAPORAN ORDERAN DESAINER ===\n\n");

    let re_angka = Regex::new(r"(\d+)$").unwrap();
    let bulan_indo = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

    for (tanggal, mut entries) in grup_tanggal {
        let nama_bulan = bulan_indo[tanggal.month() as usize - 1];
        laporan.push_str(&format!("{} {} {}\n", tanggal.day(), nama_bulan, tanggal.year()));

        entries.sort_by_key(|e| {
            re_angka.captures(&e.nama).and_then(|c| c[1].parse::<i32>().ok()).unwrap_or(i32::MAX)
        });

        for entry in entries {
            let mut nama_fmt = entry.nama.clone();
            nama_fmt = nama_fmt.replace("GR", "**GR**").replace("OR", "*__OR__*")
                               .replace("SM", "__**SM**__").replace("SP", "__**SP**__")
                               .replace("BR", "__**BR**__").replace("PN", "__**PN**__")
                               .replace("FB", "__**FB**__");

            let status_text = match entry.status.as_str() {
                "Preview" => "Preview", "ACC" => "**ACC**",
                "Belum Desain" => "Belum Desain", "Proses Desain" => "Proses Desain",
                _ => &entry.status,
            };
            laporan.push_str(&format!("{} : {}\n", nama_fmt, status_text));
        }
        laporan.push_str("------------------------------\n\n");
    }

    let hari_ini = Local::now().naive_local().date();
    let mut cetak_rekap = |kategori: &str, is_last: bool| {
        let nama_kategori = match kategori { "OR" => "ORNAMEN", "GR" => "GRILL", "3D" => "EMBLEM 3D", _ => "UNKNOWN" };
        let data_kategori: Vec<&Entry> = data.iter().filter(|d| d.kategori == kategori).collect();
        let hari_ini_count = data_kategori.iter().filter(|d| d.tanggal == hari_ini).count();
        let kemarin_count = data_kategori.iter().filter(|d| d.tanggal < hari_ini).count();

        if (hari_ini_count + kemarin_count) == 0 { return; }

        let count_status = |status: &str| -> usize {
            data_kategori.iter().filter(|d| (d.tanggal == hari_ini || d.tanggal < hari_ini) && d.status == status).count()
        };

        laporan.push_str(&format!("{}\n", nama_kategori));
        laporan.push_str(&format!("DO dibawa : Hari ini {} Kemarin {}\n", hari_ini_count, kemarin_count));
        laporan.push_str(&format!("Belum Desain : {}\n", count_status("Belum Desain")));
        laporan.push_str(&format!("Proses Desain : {}\n", count_status("Proses Desain")));
        laporan.push_str(&format!("Sudah Preview : {}\n", count_status("Preview")));
        laporan.push_str(&format!("ACC : {}\n", count_status("ACC")));

        if !is_last { laporan.push_str("==========\n\n"); }
    };

    cetak_rekap("OR", false);
    cetak_rekap("GR", false);
    cetak_rekap("3D", true);

    let hasil_akhir = laporan.trim_end().to_string();

    // Otomatis Salin ke Clipboard
    if let Ok(mut clipboard) = Clipboard::new() {
        let _ = clipboard.set_text(hasil_akhir.clone());
    }

    Ok(hasil_akhir)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![generate_laporan])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}