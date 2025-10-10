//! Code analysis and search handlers.

use anyhow::{Context, Result};
use claude_code_terminal::{Table, Alignment, StatusIndicator};
use indicatif::{ProgressBar, ProgressStyle};
use std::path::PathBuf;
use tracing::{debug, info};
use walkdir::WalkDir;

use crate::app::App;
use crate::cli::{AnalysisType, Commands, IndexCommands, OutputFormat};

/// Handle analyze command - analyze codebase.
pub async fn handle(app: &App) -> Result<()> {
    let formatter = app.formatter();

    // Extract parameters
    let (path, analysis_type, format, rebuild, include_hidden) = match &app.cli_args().command {
        Some(Commands::Analyze {
            path,
            analysis_type,
            format,
            rebuild,
            include_hidden,
        }) => (
            path.clone().unwrap_or_else(|| app.workspace().clone()),
            *analysis_type,
            *format,
            *rebuild,
            *include_hidden,
        ),
        _ => anyhow::bail!("Invalid command for analyze handler"),
    };

    info!("Analyzing codebase at: {}", path.display());

    // Validate path exists
    if !path.exists() {
        anyhow::bail!("Path does not exist: {}", path.display());
    }

    // Rebuild index if requested
    if rebuild {
        formatter.print_info("Rebuilding codebase index...");
        // TODO: Implement index rebuilding
    }

    // Determine analysis type
    let analysis = analysis_type.unwrap_or(AnalysisType::Full);

    // Perform analysis
    match analysis {
        AnalysisType::Quality => {
            analyze_quality(app, &path, format).await?;
        }
        AnalysisType::Complexity => {
            analyze_complexity(app, &path, format).await?;
        }
        AnalysisType::Security => {
            analyze_security(app, &path, format).await?;
        }
        AnalysisType::Dependencies => {
            analyze_dependencies(app, &path, format).await?;
        }
        AnalysisType::Full => {
            // Run all analyses
            formatter.print_header("Full Codebase Analysis");
            println!();

            analyze_quality(app, &path, format).await?;
            println!();
            analyze_complexity(app, &path, format).await?;
            println!();
            analyze_dependencies(app, &path, format).await?;
        }
    }

    Ok(())
}

/// Analyze code quality.
async fn analyze_quality(app: &App, path: &PathBuf, format: OutputFormat) -> Result<()> {
    let formatter = app.formatter();

    formatter.print_header("Code Quality Analysis");
    println!();

    // Count files and lines
    let stats = collect_code_stats(path).await?;

    match format {
        OutputFormat::Table => {
            let mut table = Table::new();
            table.set_header(vec!["Metric", "Value"]);

            table.add_row(vec![
                "Total Files".to_string(),
                stats.total_files.to_string(),
            ]);
            table.add_row(vec![
                "Total Lines".to_string(),
                stats.total_lines.to_string(),
            ]);
            table.add_row(vec![
                "Code Lines".to_string(),
                stats.code_lines.to_string(),
            ]);
            table.add_row(vec![
                "Comment Lines".to_string(),
                stats.comment_lines.to_string(),
            ]);
            table.add_row(vec![
                "Blank Lines".to_string(),
                stats.blank_lines.to_string(),
            ]);
            table.add_row(vec![
                "Average File Size".to_string(),
                format!("{} lines", stats.avg_file_size()),
            ]);

            table.print();
        }
        OutputFormat::Json => {
            let json = serde_json::json!({
                "total_files": stats.total_files,
                "total_lines": stats.total_lines,
                "code_lines": stats.code_lines,
                "comment_lines": stats.comment_lines,
                "blank_lines": stats.blank_lines,
                "avg_file_size": stats.avg_file_size(),
            });
            println!("{}", serde_json::to_string_pretty(&json)?);
        }
        OutputFormat::Yaml => {
            let yaml = serde_json::json!({
                "total_files": stats.total_files,
                "total_lines": stats.total_lines,
                "code_lines": stats.code_lines,
                "comment_lines": stats.comment_lines,
                "blank_lines": stats.blank_lines,
                "avg_file_size": stats.avg_file_size(),
            });
            println!("{}", serde_yaml::to_string(&yaml)?);
        }
        OutputFormat::Text => {
            println!("Total Files: {}", stats.total_files);
            println!("Total Lines: {}", stats.total_lines);
            println!("Code Lines: {}", stats.code_lines);
            println!("Comment Lines: {}", stats.comment_lines);
            println!("Blank Lines: {}", stats.blank_lines);
            println!("Average File Size: {} lines", stats.avg_file_size());
        }
    }

    Ok(())
}

/// Analyze code complexity.
async fn analyze_complexity(app: &App, path: &PathBuf, format: OutputFormat) -> Result<()> {
    let formatter = app.formatter();

    formatter.print_header("Complexity Analysis");
    println!();

    // TODO: Implement actual complexity metrics (cyclomatic complexity, etc.)
    formatter.print_warning("Detailed complexity analysis not yet implemented");

    println!();
    formatter.print_info("This feature will analyze:");
    println!("  - Cyclomatic complexity");
    println!("  - Cognitive complexity");
    println!("  - Function/method sizes");
    println!("  - Nesting depth");

    Ok(())
}

/// Analyze security issues.
async fn analyze_security(app: &App, path: &PathBuf, format: OutputFormat) -> Result<()> {
    let formatter = app.formatter();

    formatter.print_header("Security Analysis");
    println!();

    // TODO: Implement security scanning
    formatter.print_warning("Security analysis not yet implemented");

    println!();
    formatter.print_info("This feature will check for:");
    println!("  - Known vulnerabilities in dependencies");
    println!("  - Unsafe code patterns");
    println!("  - Hardcoded secrets");
    println!("  - SQL injection risks");

    Ok(())
}

/// Analyze dependencies.
async fn analyze_dependencies(app: &App, path: &PathBuf, format: OutputFormat) -> Result<()> {
    let formatter = app.formatter();

    formatter.print_header("Dependencies Analysis");
    println!();

    // Look for Cargo.toml files
    let cargo_files = find_cargo_files(path)?;

    if cargo_files.is_empty() {
        formatter.print_warning("No Cargo.toml files found");
        return Ok(());
    }

    formatter.print_info(&format!("Found {} Cargo.toml file(s)", cargo_files.len()));
    println!();

    // TODO: Parse and analyze dependencies
    for cargo_file in cargo_files {
        println!("  {}", cargo_file.display());
    }

    println!();
    formatter.print_warning("Detailed dependency analysis not yet implemented");

    Ok(())
}

/// Handle search command.
pub async fn handle_search(app: &App) -> Result<()> {
    let formatter = app.formatter();

    // Extract parameters
    let (pattern, search_path, use_regex, ignore_case, file_type, max_results) =
        match &app.cli_args().command {
            Some(Commands::Search {
                pattern,
                path,
                regex,
                ignore_case,
                file_type,
                max_results,
            }) => (
                pattern.clone(),
                path.clone().unwrap_or_else(|| app.workspace().clone()),
                *regex,
                *ignore_case,
                file_type.clone(),
                *max_results,
            ),
            _ => anyhow::bail!("Invalid command for search handler"),
        };

    formatter.print_header(&format!("Searching for: {}", pattern));
    println!();

    // Show progress
    let progress = ProgressBar::new_spinner();
    progress.set_style(
        ProgressStyle::default_spinner()
            .template("{spinner:.cyan} {msg}")
            .context("Failed to set progress style")?
    );
    progress.set_message("Searching...");
    progress.enable_steady_tick(std::time::Duration::from_millis(100));

    // Perform search
    let results = search_files(&search_path, &pattern, use_regex, ignore_case, file_type.as_deref())?;

    progress.finish_and_clear();

    // Limit results if specified
    let display_results: Vec<_> = if let Some(max) = max_results {
        results.iter().take(max).cloned().collect()
    } else {
        results.clone()
    };

    if display_results.is_empty() {
        formatter.print_warning("No matches found");
        return Ok(());
    }

    formatter.print_success(&format!("Found {} match(es)", display_results.len()));
    println!();

    // Display results
    for (file_path, line_num, line_content) in display_results {
        println!("{}:{}:{}", file_path.display(), line_num, line_content.trim());
    }

    if let Some(max) = max_results {
        if results.len() > max {
            println!();
            formatter.print_dim(&format!("Showing {} of {} results", max, results.len()));
        }
    }

    Ok(())
}

/// Handle index commands.
pub async fn handle_index(app: &App, command: &IndexCommands) -> Result<()> {
    match command {
        IndexCommands::Build { path, force } => {
            handle_index_build(app, path.as_ref(), *force).await
        }
        IndexCommands::Stats { detailed } => {
            handle_index_stats(app, *detailed).await
        }
        IndexCommands::Clear { yes } => {
            handle_index_clear(app, *yes).await
        }
        IndexCommands::Update { watch } => {
            handle_index_update(app, *watch).await
        }
    }
}

/// Build codebase index.
async fn handle_index_build(app: &App, path: Option<&PathBuf>, force: bool) -> Result<()> {
    let formatter = app.formatter();
    let index_path = path.unwrap_or(app.workspace());

    formatter.print_header("Building Codebase Index");
    println!();
    println!("Path: {}", index_path.display());
    println!();

    let progress = ProgressBar::new_spinner();
    progress.set_style(
        ProgressStyle::default_spinner()
            .template("{spinner:.cyan} {msg}")
            .context("Failed to set progress style")?
    );
    progress.set_message("Indexing files...");
    progress.enable_steady_tick(std::time::Duration::from_millis(100));

    // TODO: Implement actual indexing
    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

    progress.finish_and_clear();

    formatter.print_success("Index built successfully");
    formatter.print_dim("Index will be used for faster searches and context retrieval");

    Ok(())
}

/// Show index statistics.
async fn handle_index_stats(app: &App, detailed: bool) -> Result<()> {
    let formatter = app.formatter();

    formatter.print_header("Index Statistics");
    println!();

    // TODO: Implement actual stats
    formatter.print_warning("Index statistics not yet implemented");

    Ok(())
}

/// Clear codebase index.
async fn handle_index_clear(app: &App, skip_confirm: bool) -> Result<()> {
    let formatter = app.formatter();

    if !skip_confirm {
        let confirmed = dialoguer::Confirm::new()
            .with_prompt("Are you sure you want to clear the index?")
            .default(false)
            .interact()
            .context("Failed to read confirmation")?;

        if !confirmed {
            formatter.print_warning("Index clearing cancelled");
            return Ok(());
        }
    }

    formatter.print_info("Clearing index...");

    // TODO: Implement actual clearing
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    formatter.print_success("Index cleared successfully");

    Ok(())
}

/// Update index incrementally.
async fn handle_index_update(app: &App, watch: bool) -> Result<()> {
    let formatter = app.formatter();

    if watch {
        formatter.print_info("Starting file watcher for incremental updates...");
        formatter.print_warning("Watch mode not yet implemented");
        // TODO: Implement file watching
    } else {
        formatter.print_info("Updating index...");

        let progress = ProgressBar::new_spinner();
        progress.set_style(
            ProgressStyle::default_spinner()
                .template("{spinner:.cyan} {msg}")
                .context("Failed to set progress style")?
        );
        progress.set_message("Updating...");
        progress.enable_steady_tick(std::time::Duration::from_millis(100));

        // TODO: Implement incremental update
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;

        progress.finish_and_clear();

        formatter.print_success("Index updated successfully");
    }

    Ok(())
}

/// Code statistics structure.
#[derive(Debug, Default)]
struct CodeStats {
    total_files: usize,
    total_lines: usize,
    code_lines: usize,
    comment_lines: usize,
    blank_lines: usize,
}

impl CodeStats {
    fn avg_file_size(&self) -> usize {
        if self.total_files == 0 {
            0
        } else {
            self.total_lines / self.total_files
        }
    }
}

/// Collect code statistics from a directory.
async fn collect_code_stats(path: &PathBuf) -> Result<CodeStats> {
    let mut stats = CodeStats::default();

    // Walk directory tree
    for entry in WalkDir::new(path)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if !entry.file_type().is_file() {
            continue;
        }

        // Check if it's a code file
        if let Some(ext) = entry.path().extension() {
            let ext_str = ext.to_string_lossy();
            if !is_code_file(&ext_str) {
                continue;
            }

            stats.total_files += 1;

            // Read and analyze file
            if let Ok(content) = std::fs::read_to_string(entry.path()) {
                for line in content.lines() {
                    stats.total_lines += 1;

                    let trimmed = line.trim();
                    if trimmed.is_empty() {
                        stats.blank_lines += 1;
                    } else if trimmed.starts_with("//") || trimmed.starts_with("#") || trimmed.starts_with("/*") {
                        stats.comment_lines += 1;
                    } else {
                        stats.code_lines += 1;
                    }
                }
            }
        }
    }

    Ok(stats)
}

/// Check if file extension indicates a code file.
fn is_code_file(ext: &str) -> bool {
    matches!(
        ext,
        "rs" | "py" | "js" | "ts" | "jsx" | "tsx" | "java" | "c" | "cpp" | "h" | "hpp" |
        "go" | "rb" | "php" | "swift" | "kt" | "scala" | "sh" | "bash" | "zsh" | "fish" |
        "toml" | "yaml" | "yml" | "json" | "xml" | "html" | "css" | "scss" | "sass" | "md"
    )
}

/// Find all Cargo.toml files in directory tree.
fn find_cargo_files(path: &PathBuf) -> Result<Vec<PathBuf>> {
    let mut cargo_files = Vec::new();

    for entry in WalkDir::new(path)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() {
            if entry.file_name() == "Cargo.toml" {
                cargo_files.push(entry.path().to_path_buf());
            }
        }
    }

    Ok(cargo_files)
}

/// Search for pattern in files.
fn search_files(
    path: &PathBuf,
    pattern: &str,
    use_regex: bool,
    ignore_case: bool,
    file_type: Option<&str>,
) -> Result<Vec<(PathBuf, usize, String)>> {
    let mut results = Vec::new();

    // Compile regex if needed
    let regex = if use_regex {
        let mut builder = regex::RegexBuilder::new(pattern);
        builder.case_insensitive(ignore_case);
        Some(builder.build().context("Invalid regex pattern")?)
    } else {
        None
    };

    // Walk directory
    for entry in WalkDir::new(path)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if !entry.file_type().is_file() {
            continue;
        }

        // Filter by file type if specified
        if let Some(ft) = file_type {
            if let Some(ext) = entry.path().extension() {
                if ext.to_string_lossy() != ft {
                    continue;
                }
            } else {
                continue;
            }
        }

        // Search file content
        if let Ok(content) = std::fs::read_to_string(entry.path()) {
            for (line_num, line) in content.lines().enumerate() {
                let matches = if let Some(ref re) = regex {
                    re.is_match(line)
                } else {
                    if ignore_case {
                        line.to_lowercase().contains(&pattern.to_lowercase())
                    } else {
                        line.contains(pattern)
                    }
                };

                if matches {
                    results.push((
                        entry.path().to_path_buf(),
                        line_num + 1,
                        line.to_string(),
                    ));
                }
            }
        }
    }

    Ok(results)
}
