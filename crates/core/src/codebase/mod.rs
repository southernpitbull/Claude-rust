pub mod analyzer;
pub mod indexer;
pub mod scanner;

pub use analyzer::{AnalysisResult, CodeAnalyzer, CodeMetrics, Dependency, DependencyKind, Function, Symbol, SymbolKind, Class};
pub use indexer::{CodebaseIndex, IndexEntry, Symbol as IndexSymbol, SymbolKind as IndexSymbolKind};
pub use scanner::{CodeFile, CodebaseError, CodebaseResult, CodebaseScanner, CodebaseStatistics, ScannerConfig};