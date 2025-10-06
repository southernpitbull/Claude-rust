//! Natural language command parser.
//!
//! This module provides functionality to parse natural language input into
//! structured commands with intent detection and entity extraction.

use super::types::{
    AICommand, CodeAnalysisCommand, Command, CommandIntent, Confidence, FileOperationCommand,
    GitCommand, SystemCommand,
};
use regex::Regex;
use std::collections::HashMap;
use std::path::PathBuf;

/// Parser for natural language commands
#[derive(Debug)]
pub struct CommandParser {
    /// Intent patterns for matching user input
    intent_patterns: HashMap<CommandIntent, Vec<Regex>>,
}

impl CommandParser {
    /// Create a new command parser with default patterns
    pub fn new() -> Self {
        let mut parser = Self {
            intent_patterns: HashMap::new(),
        };
        parser.initialize_patterns();
        parser
    }

    /// Initialize intent detection patterns
    fn initialize_patterns(&mut self) {
        // File operations
        self.add_pattern(
            CommandIntent::ReadFile,
            vec![
                r"(?i)^read\s+(?:file\s+)?(.+)$",
                r"(?i)^show\s+(?:me\s+)?(?:file\s+)?(.+)$",
                r"(?i)^cat\s+(.+)$",
                r"(?i)^display\s+(.+)$",
            ],
        );

        self.add_pattern(
            CommandIntent::WriteFile,
            vec![
                r"(?i)^write\s+(.+)\s+to\s+(.+)$",
                r"(?i)^create\s+(?:file\s+)?(.+)\s+with\s+(.+)$",
                r"(?i)^save\s+(.+)\s+(?:to\s+|in\s+)?(.+)$",
            ],
        );

        self.add_pattern(
            CommandIntent::EditFile,
            vec![
                r"(?i)^edit\s+(.+)$",
                r"(?i)^modify\s+(.+)$",
                r"(?i)^replace\s+(.+)\s+with\s+(.+)\s+in\s+(.+)$",
                r"(?i)^change\s+(.+)\s+to\s+(.+)\s+in\s+(.+)$",
            ],
        );

        self.add_pattern(
            CommandIntent::Delete,
            vec![
                r"(?i)^delete\s+(.+)$",
                r"(?i)^remove\s+(.+)$",
                r"(?i)^rm\s+(.+)$",
            ],
        );

        self.add_pattern(
            CommandIntent::Copy,
            vec![
                r"(?i)^copy\s+(.+)\s+to\s+(.+)$",
                r"(?i)^cp\s+(.+)\s+(.+)$",
            ],
        );

        self.add_pattern(
            CommandIntent::Move,
            vec![
                r"(?i)^move\s+(.+)\s+to\s+(.+)$",
                r"(?i)^mv\s+(.+)\s+(.+)$",
                r"(?i)^rename\s+(.+)\s+to\s+(.+)$",
            ],
        );

        self.add_pattern(
            CommandIntent::List,
            vec![
                r"(?i)^list\s+(?:files\s+in\s+)?(.+)$",
                r"(?i)^ls\s+(.+)$",
                r"(?i)^show\s+(?:files\s+in\s+)?(.+)$",
            ],
        );

        // Code analysis
        self.add_pattern(
            CommandIntent::Analyze,
            vec![
                r"(?i)^analyze\s+(.+)$",
                r"(?i)^analyze\s+codebase(?:\s+(.+))?$",
                r"(?i)^inspect\s+(.+)$",
            ],
        );

        self.add_pattern(
            CommandIntent::Search,
            vec![
                r"(?i)^search\s+(?:for\s+)?(.+)$",
                r"(?i)^find\s+(.+)$",
                r"(?i)^grep\s+(.+)$",
                r"(?i)^look\s+for\s+(.+)$",
            ],
        );

        self.add_pattern(
            CommandIntent::Index,
            vec![
                r"(?i)^index\s+(.+)$",
                r"(?i)^index\s+codebase(?:\s+(.+))?$",
            ],
        );

        self.add_pattern(
            CommandIntent::FindSymbol,
            vec![
                r"(?i)^find\s+(?:symbol\s+)?(.+)$",
                r"(?i)^locate\s+(?:symbol\s+)?(.+)$",
            ],
        );

        self.add_pattern(
            CommandIntent::Metrics,
            vec![
                r"(?i)^metrics\s+(?:for\s+)?(.+)$",
                r"(?i)^(?:get\s+)?code\s+metrics\s+(?:for\s+)?(.+)$",
            ],
        );

        // Git operations
        self.add_pattern(
            CommandIntent::GitStatus,
            vec![
                r"(?i)^git\s+status$",
                r"(?i)^status$",
                r"(?i)^show\s+git\s+status$",
            ],
        );

        self.add_pattern(
            CommandIntent::GitCommit,
            vec![
                r"(?i)^git\s+commit\s+(.+)$",
                r"(?i)^commit\s+(.+)$",
            ],
        );

        self.add_pattern(
            CommandIntent::GitPush,
            vec![
                r"(?i)^git\s+push(?:\s+(.+))?$",
                r"(?i)^push(?:\s+(.+))?$",
            ],
        );

        self.add_pattern(
            CommandIntent::GitPull,
            vec![
                r"(?i)^git\s+pull(?:\s+(.+))?$",
                r"(?i)^pull(?:\s+(.+))?$",
            ],
        );

        self.add_pattern(
            CommandIntent::GitBranch,
            vec![
                r"(?i)^git\s+branch\s+(.+)$",
                r"(?i)^(?:create\s+)?branch\s+(.+)$",
            ],
        );

        self.add_pattern(
            CommandIntent::GitDiff,
            vec![
                r"(?i)^git\s+diff$",
                r"(?i)^diff$",
                r"(?i)^show\s+(?:git\s+)?diff$",
            ],
        );

        self.add_pattern(
            CommandIntent::GitAdd,
            vec![
                r"(?i)^git\s+add\s+(.+)$",
                r"(?i)^stage\s+(.+)$",
            ],
        );

        // System commands
        self.add_pattern(
            CommandIntent::Execute,
            vec![
                r"(?i)^execute\s+(.+)$",
                r"(?i)^run\s+(.+)$",
                r"(?i)^exec\s+(.+)$",
            ],
        );

        // AI commands
        self.add_pattern(
            CommandIntent::Query,
            vec![
                r"(?i)^ask\s+(.+)$",
                r"(?i)^query\s+(.+)$",
                r"(?i)^question:\s*(.+)$",
            ],
        );

        self.add_pattern(
            CommandIntent::Explain,
            vec![
                r"(?i)^explain\s+(.+)$",
                r"(?i)^what\s+does\s+(.+)\s+do\??$",
                r"(?i)^describe\s+(.+)$",
            ],
        );

        self.add_pattern(
            CommandIntent::Generate,
            vec![
                r"(?i)^generate\s+(.+)$",
                r"(?i)^create\s+code\s+(?:for\s+)?(.+)$",
                r"(?i)^write\s+code\s+(?:for\s+)?(.+)$",
            ],
        );

        self.add_pattern(
            CommandIntent::Review,
            vec![
                r"(?i)^review\s+(.+)$",
                r"(?i)^check\s+(.+)$",
                r"(?i)^analyze\s+code\s+(.+)$",
            ],
        );

        self.add_pattern(
            CommandIntent::Refactor,
            vec![
                r"(?i)^refactor\s+(.+)$",
                r"(?i)^improve\s+(.+)$",
                r"(?i)^optimize\s+(.+)$",
            ],
        );
    }

    /// Add patterns for an intent
    fn add_pattern(&mut self, intent: CommandIntent, patterns: Vec<&str>) {
        let compiled_patterns: Vec<Regex> = patterns
            .into_iter()
            .filter_map(|p| Regex::new(p).ok())
            .collect();
        self.intent_patterns.insert(intent, compiled_patterns);
    }

    /// Parse natural language input into a command
    pub fn parse(&self, input: &str) -> ParseResult {
        let input = input.trim();

        // Try to detect intent
        let (intent, confidence, captures) = self.detect_intent(input);

        // Convert intent and captures into a structured command
        match self.build_command(&intent, captures, input) {
            Ok(command) => ParseResult {
                command: Some(command),
                intent,
                confidence,
                raw_input: input.to_string(),
            },
            Err(_) => ParseResult {
                command: None,
                intent: CommandIntent::Unknown,
                confidence: Confidence::new(0.0),
                raw_input: input.to_string(),
            },
        }
    }

    /// Detect intent from input
    fn detect_intent(&self, input: &str) -> (CommandIntent, Confidence, Vec<String>) {
        let mut best_match: Option<(CommandIntent, Confidence, Vec<String>)> = None;

        for (intent, patterns) in &self.intent_patterns {
            for pattern in patterns {
                if let Some(caps) = pattern.captures(input) {
                    // Calculate confidence based on pattern match quality
                    let confidence = self.calculate_confidence(input, &caps);

                    // Extract captures
                    let captures: Vec<String> = caps
                        .iter()
                        .skip(1) // Skip the full match
                        .filter_map(|m| m.map(|m| m.as_str().to_string()))
                        .collect();

                    // Keep the best match
                    if best_match.is_none()
                        || confidence > best_match.as_ref().unwrap().1
                    {
                        best_match = Some((intent.clone(), confidence, captures));
                    }
                }
            }
        }

        best_match.unwrap_or((CommandIntent::Unknown, Confidence::new(0.0), vec![]))
    }

    /// Calculate confidence score for a match
    fn calculate_confidence(&self, input: &str, captures: &regex::Captures) -> Confidence {
        // Base confidence on how much of the input was matched
        let matched_len: usize = captures
            .iter()
            .skip(1)
            .filter_map(|m| m.map(|m| m.as_str().len()))
            .sum();

        let input_len = input.len();
        let coverage = if input_len > 0 {
            matched_len as f64 / input_len as f64
        } else {
            0.0
        };

        // Boost confidence if we have multiple captures
        let capture_bonus = (captures.len() - 1) as f64 * 0.1;
        let confidence = (coverage + capture_bonus).min(1.0);

        Confidence::new(confidence)
    }

    /// Build a command from intent and captures
    fn build_command(
        &self,
        intent: &CommandIntent,
        captures: Vec<String>,
        input: &str,
    ) -> Result<Command, String> {
        match intent {
            CommandIntent::ReadFile => {
                let path = captures.first().ok_or("Missing file path")?;
                Ok(Command::FileOperation(FileOperationCommand::Read {
                    path: PathBuf::from(path),
                    encoding: None,
                }))
            }
            CommandIntent::WriteFile => {
                if captures.len() >= 2 {
                    Ok(Command::FileOperation(FileOperationCommand::Write {
                        path: PathBuf::from(&captures[1]),
                        content: captures[0].clone(),
                        create_dirs: true,
                    }))
                } else {
                    Err("Missing path or content".to_string())
                }
            }
            CommandIntent::EditFile => {
                let path = captures.first().ok_or("Missing file path")?;
                Ok(Command::FileOperation(FileOperationCommand::Edit {
                    path: PathBuf::from(path),
                    search: String::new(),
                    replace: String::new(),
                    all_occurrences: false,
                }))
            }
            CommandIntent::Delete => {
                let path = captures.first().ok_or("Missing path")?;
                Ok(Command::FileOperation(FileOperationCommand::Delete {
                    path: PathBuf::from(path),
                    recursive: false,
                }))
            }
            CommandIntent::Copy => {
                if captures.len() >= 2 {
                    Ok(Command::FileOperation(FileOperationCommand::Copy {
                        from: PathBuf::from(&captures[0]),
                        to: PathBuf::from(&captures[1]),
                        overwrite: false,
                    }))
                } else {
                    Err("Missing source or destination".to_string())
                }
            }
            CommandIntent::Move => {
                if captures.len() >= 2 {
                    Ok(Command::FileOperation(FileOperationCommand::Move {
                        from: PathBuf::from(&captures[0]),
                        to: PathBuf::from(&captures[1]),
                        overwrite: false,
                    }))
                } else {
                    Err("Missing source or destination".to_string())
                }
            }
            CommandIntent::List => {
                let path = captures.first().map(|p| PathBuf::from(p)).unwrap_or_else(|| PathBuf::from("."));
                Ok(Command::FileOperation(FileOperationCommand::List {
                    path,
                    recursive: false,
                    show_hidden: false,
                }))
            }
            CommandIntent::Analyze => {
                let path = captures.first().map(|p| PathBuf::from(p)).unwrap_or_else(|| PathBuf::from("."));
                Ok(Command::CodeAnalysis(CodeAnalysisCommand::Analyze {
                    path,
                    depth: None,
                }))
            }
            CommandIntent::Search => {
                let pattern = captures.first().ok_or("Missing search pattern")?;
                Ok(Command::CodeAnalysis(CodeAnalysisCommand::Search {
                    pattern: pattern.clone(),
                    path: None,
                    case_sensitive: false,
                    regex: false,
                }))
            }
            CommandIntent::Index => {
                let path = captures.first().map(|p| PathBuf::from(p)).unwrap_or_else(|| PathBuf::from("."));
                Ok(Command::CodeAnalysis(CodeAnalysisCommand::Index {
                    path,
                    exclude_patterns: vec![],
                }))
            }
            CommandIntent::FindSymbol => {
                let symbol = captures.first().ok_or("Missing symbol name")?;
                Ok(Command::CodeAnalysis(CodeAnalysisCommand::FindSymbol {
                    symbol: symbol.clone(),
                    path: None,
                }))
            }
            CommandIntent::Metrics => {
                let path = captures.first().map(|p| PathBuf::from(p)).unwrap_or_else(|| PathBuf::from("."));
                Ok(Command::CodeAnalysis(CodeAnalysisCommand::Metrics { path }))
            }
            CommandIntent::GitStatus => Ok(Command::Git(GitCommand::Status { path: None })),
            CommandIntent::GitCommit => {
                let message = captures.first().ok_or("Missing commit message")?;
                Ok(Command::Git(GitCommand::Commit {
                    message: message.clone(),
                    all: false,
                }))
            }
            CommandIntent::GitPush => Ok(Command::Git(GitCommand::Push {
                remote: None,
                branch: None,
            })),
            CommandIntent::GitPull => Ok(Command::Git(GitCommand::Pull {
                remote: None,
                branch: None,
            })),
            CommandIntent::GitBranch => {
                let name = captures.first().ok_or("Missing branch name")?;
                Ok(Command::Git(GitCommand::Branch {
                    name: name.clone(),
                    checkout: false,
                }))
            }
            CommandIntent::GitDiff => Ok(Command::Git(GitCommand::Diff { staged: false })),
            CommandIntent::GitAdd => {
                let paths: Vec<PathBuf> = captures.iter().map(|p| PathBuf::from(p)).collect();
                if paths.is_empty() {
                    return Err("Missing files to add".to_string());
                }
                Ok(Command::Git(GitCommand::Add { paths }))
            }
            CommandIntent::Execute => {
                let command = captures.first().ok_or("Missing command")?;
                Ok(Command::System(SystemCommand {
                    command: command.clone(),
                    args: vec![],
                    working_dir: None,
                    env: HashMap::new(),
                    timeout: None,
                }))
            }
            CommandIntent::Query => {
                let question = captures.first().ok_or("Missing question")?;
                Ok(Command::AI(AICommand::Query {
                    question: question.clone(),
                    context: None,
                }))
            }
            CommandIntent::Explain => {
                let code = captures.first().ok_or("Missing code")?;
                Ok(Command::AI(AICommand::Explain {
                    code: code.clone(),
                    language: None,
                }))
            }
            CommandIntent::Generate => {
                let description = captures.first().ok_or("Missing description")?;
                Ok(Command::AI(AICommand::Generate {
                    description: description.clone(),
                    language: None,
                }))
            }
            CommandIntent::Review => {
                let code = captures.first().ok_or("Missing code")?;
                Ok(Command::AI(AICommand::Review {
                    code: code.clone(),
                    language: None,
                }))
            }
            CommandIntent::Refactor => {
                let code = captures.first().ok_or("Missing code")?;
                Ok(Command::AI(AICommand::Refactor {
                    code: code.clone(),
                    instructions: "Refactor this code".to_string(),
                    language: None,
                }))
            }
            CommandIntent::Unknown => Err(format!("Unknown command: {}", input)),
        }
    }

    /// Fuzzy match command names
    pub fn fuzzy_match(&self, input: &str, candidates: &[&str]) -> Vec<(String, f64)> {
        let input_lower = input.to_lowercase();
        let mut matches: Vec<(String, f64)> = candidates
            .iter()
            .map(|candidate| {
                let score = self.calculate_similarity(&input_lower, &candidate.to_lowercase());
                (candidate.to_string(), score)
            })
            .filter(|(_, score)| *score > 0.3) // Filter low scores
            .collect();

        matches.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        matches
    }

    /// Calculate similarity between two strings (Levenshtein-based)
    fn calculate_similarity(&self, s1: &str, s2: &str) -> f64 {
        let len1 = s1.len();
        let len2 = s2.len();

        if len1 == 0 {
            return if len2 == 0 { 1.0 } else { 0.0 };
        }

        let distance = self.levenshtein_distance(s1, s2);
        let max_len = len1.max(len2);
        1.0 - (distance as f64 / max_len as f64)
    }

    /// Calculate Levenshtein distance
    fn levenshtein_distance(&self, s1: &str, s2: &str) -> usize {
        let len1 = s1.len();
        let len2 = s2.len();
        let mut matrix = vec![vec![0; len2 + 1]; len1 + 1];

        for i in 0..=len1 {
            matrix[i][0] = i;
        }
        for j in 0..=len2 {
            matrix[0][j] = j;
        }

        for (i, c1) in s1.chars().enumerate() {
            for (j, c2) in s2.chars().enumerate() {
                let cost = if c1 == c2 { 0 } else { 1 };
                matrix[i + 1][j + 1] = *[
                    matrix[i][j + 1] + 1,
                    matrix[i + 1][j] + 1,
                    matrix[i][j] + cost,
                ]
                .iter()
                .min()
                .unwrap();
            }
        }

        matrix[len1][len2]
    }
}

impl Default for CommandParser {
    fn default() -> Self {
        Self::new()
    }
}

/// Result of parsing a command
#[derive(Debug, Clone)]
pub struct ParseResult {
    /// Parsed command (if successful)
    pub command: Option<Command>,
    /// Detected intent
    pub intent: CommandIntent,
    /// Confidence score
    pub confidence: Confidence,
    /// Raw input string
    pub raw_input: String,
}

impl ParseResult {
    /// Check if parsing was successful
    pub fn is_success(&self) -> bool {
        self.command.is_some()
    }

    /// Check if confidence is acceptable (>= 0.5)
    pub fn has_acceptable_confidence(&self) -> bool {
        !self.confidence.is_low()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_read_file() {
        let parser = CommandParser::new();
        let result = parser.parse("read file test.txt");

        assert!(result.is_success());
        assert_eq!(result.intent, CommandIntent::ReadFile);
        assert!(result.confidence.value() > 0.5);

        if let Some(Command::FileOperation(FileOperationCommand::Read { path, .. })) =
            result.command
        {
            assert_eq!(path, PathBuf::from("test.txt"));
        } else {
            panic!("Expected ReadFile command");
        }
    }

    #[test]
    fn test_parse_git_status() {
        let parser = CommandParser::new();
        let result = parser.parse("git status");

        assert!(result.is_success());
        assert_eq!(result.intent, CommandIntent::GitStatus);
        assert!(matches!(
            result.command,
            Some(Command::Git(GitCommand::Status { .. }))
        ));
    }

    #[test]
    fn test_parse_search() {
        let parser = CommandParser::new();
        let result = parser.parse("search for TODO");

        assert!(result.is_success());
        assert_eq!(result.intent, CommandIntent::Search);

        if let Some(Command::CodeAnalysis(CodeAnalysisCommand::Search { pattern, .. })) =
            result.command
        {
            assert_eq!(pattern, "TODO");
        } else {
            panic!("Expected Search command");
        }
    }

    #[test]
    fn test_fuzzy_match() {
        let parser = CommandParser::new();
        let candidates = vec!["execute", "explain", "export"];
        let matches = parser.fuzzy_match("exec", &candidates);

        assert!(!matches.is_empty());
        assert_eq!(matches[0].0, "execute");
    }

    #[test]
    fn test_levenshtein_distance() {
        let parser = CommandParser::new();
        assert_eq!(parser.levenshtein_distance("kitten", "sitting"), 3);
        assert_eq!(parser.levenshtein_distance("saturday", "sunday"), 3);
        assert_eq!(parser.levenshtein_distance("test", "test"), 0);
    }

    #[test]
    fn test_calculate_similarity() {
        let parser = CommandParser::new();
        assert!(parser.calculate_similarity("test", "test") > 0.99);
        assert!(parser.calculate_similarity("test", "best") > 0.7);
        assert!(parser.calculate_similarity("test", "xyz") < 0.3);
    }

    #[test]
    fn test_parse_copy_command() {
        let parser = CommandParser::new();
        let result = parser.parse("copy src.txt to dest.txt");

        assert!(result.is_success());
        assert_eq!(result.intent, CommandIntent::Copy);

        if let Some(Command::FileOperation(FileOperationCommand::Copy { from, to, .. })) =
            result.command
        {
            assert_eq!(from, PathBuf::from("src.txt"));
            assert_eq!(to, PathBuf::from("dest.txt"));
        } else {
            panic!("Expected Copy command");
        }
    }

    #[test]
    fn test_confidence_calculation() {
        let parser = CommandParser::new();
        let high_conf = parser.parse("git status");
        let low_conf = parser.parse("xyz abc 123");

        assert!(high_conf.confidence.value() > low_conf.confidence.value());
    }
}
