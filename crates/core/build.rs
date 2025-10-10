// Build script to compile tree-sitter C parsers
use std::path::PathBuf;

fn main() {
    println!("cargo:rerun-if-changed=build.rs");

    // Find tree-sitter parser sources in cargo registry
    let home = std::env::var("CARGO_HOME")
        .or_else(|_| std::env::var("USERPROFILE").map(|p| format!("{}/.cargo", p)))
        .unwrap();

    let registry = PathBuf::from(home).join("registry/src");

    // Try to find and build each parser
    build_parser_if_exists(&registry, "tree-sitter-rust", "rust");
    build_parser_if_exists(&registry, "tree-sitter-javascript", "javascript");
    build_parser_if_exists(&registry, "tree-sitter-typescript", "typescript");
    build_parser_if_exists(&registry, "tree-sitter-python", "python");
}

fn build_parser_if_exists(registry: &PathBuf, crate_name: &str, lang: &str) {
    // Search for the crate directory
    if let Ok(entries) = std::fs::read_dir(registry) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                // Look for the crate
                if let Ok(crate_entries) = std::fs::read_dir(&path) {
                    for crate_entry in crate_entries.flatten() {
                        let crate_path = crate_entry.path();
                        if crate_path.file_name()
                            .and_then(|n| n.to_str())
                            .map(|n| n.starts_with(crate_name))
                            .unwrap_or(false)
                        {
                            build_parser(&crate_path, lang);
                            return;
                        }
                    }
                }
            }
        }
    }
}

fn build_parser(src_dir: &PathBuf, lang: &str) {
    // Special handling for typescript which has subdirectories
    let (parser_c, scanner_c, include_dir) = if lang == "typescript" {
        let ts_dir = src_dir.join("typescript");
        (
            ts_dir.join("src").join("parser.c"),
            ts_dir.join("src").join("scanner.c"),
            ts_dir.join("src"),
        )
    } else {
        (
            src_dir.join("src").join("parser.c"),
            src_dir.join("src").join("scanner.c"),
            src_dir.join("src"),
        )
    };

    if parser_c.exists() {
        cc::Build::new()
            .include(&include_dir)
            .file(&parser_c)
            .warnings(false)
            .compile(&format!("tree-sitter-{}", lang));

        // Some parsers have a scanner.c file
        if scanner_c.exists() {
            cc::Build::new()
                .include(&include_dir)
                .file(&scanner_c)
                .warnings(false)
                .compile(&format!("tree-sitter-{}-scanner", lang));
        }
    }
}
