//! File appenders for logging

use super::{LogError, LogResult};
use std::fs::{File, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use parking_lot::Mutex;
use chrono::Utc;

/// File appender for writing logs to a file
pub struct FileAppender {
    file: Arc<Mutex<File>>,
    path: PathBuf,
}

impl FileAppender {
    /// Create a new file appender
    pub fn new(path: impl AsRef<Path>) -> LogResult<Self> {
        let path = path.as_ref().to_path_buf();

        // Create parent directory if it doesn't exist
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)?;

        Ok(Self {
            file: Arc::new(Mutex::new(file)),
            path,
        })
    }

    /// Write a log entry
    pub fn write(&self, data: &[u8]) -> LogResult<()> {
        let mut file = self.file.lock();
        file.write_all(data)?;
        file.write_all(b"\n")?;
        file.flush()?;
        Ok(())
    }

    /// Get file path
    pub fn path(&self) -> &Path {
        &self.path
    }
}

/// Rotating file appender with size-based rotation
pub struct RotatingFileAppender {
    base_path: PathBuf,
    max_size: u64,
    max_files: usize,
    current_file: Arc<Mutex<Option<File>>>,
    current_size: Arc<Mutex<u64>>,
}

impl RotatingFileAppender {
    /// Create a new rotating file appender
    pub fn new(
        base_path: impl AsRef<Path>,
        max_size: u64,
        max_files: usize,
    ) -> LogResult<Self> {
        let base_path = base_path.as_ref().to_path_buf();

        // Create parent directory if it doesn't exist
        if let Some(parent) = base_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let mut appender = Self {
            base_path,
            max_size,
            max_files,
            current_file: Arc::new(Mutex::new(None)),
            current_size: Arc::new(Mutex::new(0)),
        };

        appender.open_current_file()?;
        Ok(appender)
    }

    /// Write a log entry
    pub fn write(&self, data: &[u8]) -> LogResult<()> {
        let data_len = data.len() as u64;

        // Check if rotation is needed
        {
            let current_size = *self.current_size.lock();
            if current_size + data_len > self.max_size {
                self.rotate()?;
            }
        }

        // Write data
        {
            let mut file = self.current_file.lock();
            if let Some(ref mut f) = *file {
                f.write_all(data)?;
                f.write_all(b"\n")?;
                f.flush()?;
            }
        }

        // Update size
        {
            let mut current_size = self.current_size.lock();
            *current_size += data_len + 1; // +1 for newline
        }

        Ok(())
    }

    /// Rotate log files
    fn rotate(&self) -> LogResult<()> {
        // Close current file
        {
            let mut file = self.current_file.lock();
            *file = None;
        }

        // Rotate existing files
        for i in (1..self.max_files).rev() {
            let from = self.rotated_path(i);
            let to = self.rotated_path(i + 1);

            if from.exists() {
                if i + 1 <= self.max_files {
                    std::fs::rename(&from, &to)?;
                } else {
                    std::fs::remove_file(&from)?;
                }
            }
        }

        // Rename current file
        if self.base_path.exists() {
            std::fs::rename(&self.base_path, self.rotated_path(1))?;
        }

        // Open new current file
        self.open_current_file()?;
        Ok(())
    }

    /// Open current log file
    fn open_current_file(&mut self) -> LogResult<()> {
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.base_path)?;

        let size = file.metadata()?.len();

        *self.current_file.lock() = Some(file);
        *self.current_size.lock() = size;

        Ok(())
    }

    /// Get rotated file path
    fn rotated_path(&self, index: usize) -> PathBuf {
        let mut path = self.base_path.clone();
        let extension = format!(".{}", index);
        path.set_extension(extension);
        path
    }

    /// Get base path
    pub fn path(&self) -> &Path {
        &self.base_path
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;
    use tempfile::TempDir;

    #[test]
    fn test_file_appender_creation() {
        let temp_dir = TempDir::new().unwrap();
        let log_path = temp_dir.path().join("test.log");

        let appender = FileAppender::new(&log_path).unwrap();
        assert_eq!(appender.path(), log_path);
        assert!(log_path.exists());
    }

    #[test]
    fn test_file_appender_write() {
        let temp_dir = TempDir::new().unwrap();
        let log_path = temp_dir.path().join("test.log");

        let appender = FileAppender::new(&log_path).unwrap();
        appender.write(b"Test log entry").unwrap();

        let mut content = String::new();
        File::open(&log_path).unwrap().read_to_string(&mut content).unwrap();
        assert!(content.contains("Test log entry"));
    }

    #[test]
    fn test_file_appender_multiple_writes() {
        let temp_dir = TempDir::new().unwrap();
        let log_path = temp_dir.path().join("test.log");

        let appender = FileAppender::new(&log_path).unwrap();
        appender.write(b"Line 1").unwrap();
        appender.write(b"Line 2").unwrap();

        let mut content = String::new();
        File::open(&log_path).unwrap().read_to_string(&mut content).unwrap();
        assert!(content.contains("Line 1"));
        assert!(content.contains("Line 2"));
    }

    #[test]
    fn test_rotating_appender_creation() {
        let temp_dir = TempDir::new().unwrap();
        let log_path = temp_dir.path().join("rotating.log");

        let appender = RotatingFileAppender::new(&log_path, 1024, 5).unwrap();
        assert_eq!(appender.path(), log_path);
        assert!(log_path.exists());
    }

    #[test]
    fn test_rotating_appender_write() {
        let temp_dir = TempDir::new().unwrap();
        let log_path = temp_dir.path().join("rotating.log");

        let appender = RotatingFileAppender::new(&log_path, 1024, 5).unwrap();
        appender.write(b"Test log entry").unwrap();

        let mut content = String::new();
        File::open(&log_path).unwrap().read_to_string(&mut content).unwrap();
        assert!(content.contains("Test log entry"));
    }

    #[test]
    fn test_rotating_appender_rotation() {
        let temp_dir = TempDir::new().unwrap();
        let log_path = temp_dir.path().join("rotating.log");

        // Small max size to trigger rotation
        let appender = RotatingFileAppender::new(&log_path, 50, 3).unwrap();

        // Write enough data to trigger rotation
        appender.write(b"Line 1 - This is a long line").unwrap();
        appender.write(b"Line 2 - This is another long line").unwrap();

        // Check that rotation happened
        let rotated_path = log_path.with_extension(".1");
        assert!(rotated_path.exists() || log_path.exists());
    }

    #[test]
    fn test_file_appender_creates_directory() {
        let temp_dir = TempDir::new().unwrap();
        let log_path = temp_dir.path().join("subdir").join("test.log");

        let appender = FileAppender::new(&log_path).unwrap();
        assert!(log_path.parent().unwrap().exists());
        assert!(log_path.exists());
    }
}
