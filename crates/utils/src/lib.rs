//! Shared utilities and helpers for AIrchitect CLI

pub mod config;
pub mod error;
pub mod logging;

/// A simple utility function
pub fn get_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_version() {
        assert!(!get_version().is_empty());
    }
}
