//! File System Operations
//! 
//! Async file operations with safety features

use std::path::{Path, PathBuf};
use std::io;
use std::fs::Metadata;
use tokio::fs;
use tracing::{debug, error, info};

/// File operation result type
pub type FileResult<T> = Result<T, FileError>;

/// File operation errors
#[derive(Debug, thiserror::Error)]
pub enum FileError {
    #[error("IO error: {0}")]
    Io(#[from] io::Error),
    
    #[error("Serialization error: {0}")]
    Serialization(String),
    
    #[error("Backup error: {0}")]
    Backup(String),
}

/// File operation options
#[derive(Debug, Clone)]
pub struct FileOptions {
    pub create_backup: bool,
    pub atomic_write: bool,
    pub preserve_permissions: bool,
}

impl Default for FileOptions {
    fn default() -> Self {
        Self {
            create_backup: true,
            atomic_write: true,
            preserve_permissions: true,
        }
    }
}

/// File system operations
pub struct FileOps;

impl FileOps {
    /// Read a file asynchronously
    pub async fn read_file<P: AsRef<Path>>(path: P) -> FileResult<String> {
        let path = path.as_ref();
        debug!("Reading file: {:?}", path);
        
        let contents = fs::read_to_string(path).await
            .map_err(FileError::Io)?;
        
        Ok(contents)
    }

    /// Read file as bytes asynchronously
    pub async fn read_file_bytes<P: AsRef<Path>>(path: P) -> FileResult<Vec<u8>> {
        let path = path.as_ref();
        debug!("Reading file as bytes: {:?}", path);
        
        let contents = fs::read(path).await
            .map_err(FileError::Io)?;
        
        Ok(contents)
    }

    /// Write a file asynchronously
    pub async fn write_file<P: AsRef<Path>, C: AsRef<[u8]>>(path: P, contents: C) -> FileResult<()> {
        let path = path.as_ref();
        let contents = contents.as_ref();
        debug!("Writing file: {:?}", path);
        
        fs::write(path, contents).await
            .map_err(FileError::Io)?;
        
        Ok(())
    }

    /// Write a file with options (backup, permissions, etc.)
    pub async fn write_file_with_options<P: AsRef<Path>, C: AsRef<[u8]>>(
        path: P,
        contents: C,
        options: &FileOptions,
    ) -> FileResult<()> {
        let path = path.as_ref();
        let contents = contents.as_ref();
        
        debug!("Writing file with options: {:?}", path);
        
        // Create backup if requested
        if options.create_backup && path.exists() {
            let backup_path = Self::create_backup_path(path);
            fs::copy(path, &backup_path).await
                .map_err(|e| FileError::Backup(format!("Failed to create backup: {}", e)))?;
            info!("Created backup: {:?}", backup_path);
        }

        // Write the file
        if options.atomic_write {
            Self::atomic_write(path, contents).await?;
        } else {
            fs::write(path, contents).await
                .map_err(FileError::Io)?;
        }

        // Preserve permissions if requested and source exists
        #[cfg(unix)]
        if options.preserve_permissions {
            if let Some(parent) = path.parent() {
                if parent.exists() {
                    // Set permissions similar to the parent directory
                    use std::os::unix::fs::PermissionsExt;
                    let _ = fs::set_permissions(path, fs::metadata(parent).await.map(|m| m.permissions()).unwrap_or_else(|_| std::fs::Permissions::from_mode(0o644))).await;
                }
            }
        }

        Ok(())
    }

    /// Perform an atomic write by writing to a temporary file first
    async fn atomic_write<P: AsRef<Path>>(path: P, contents: &[u8]) -> FileResult<()> {
        let path = path.as_ref();
        let temp_path = path.with_extension(format!("{}.tmp", path.extension().unwrap_or_default().to_string_lossy()));

        // Write to temporary file
        fs::write(&temp_path, contents).await
            .map_err(FileError::Io)?;

        // Rename the temporary file to the target file (atomic on most systems)
        fs::rename(&temp_path, path).await
            .map_err(FileError::Io)?;

        Ok(())
    }

    /// Copy a file
    pub async fn copy_file<P: AsRef<Path>, Q: AsRef<Path>>(from: P, to: Q) -> FileResult<()> {
        let from = from.as_ref();
        let to = to.as_ref();
        debug!("Copying file from {:?} to {:?}", from, to);
        
        fs::copy(from, to).await
            .map_err(FileError::Io)?;
        
        Ok(())
    }

    /// Move (rename) a file
    pub async fn move_file<P: AsRef<Path>, Q: AsRef<Path>>(from: P, to: Q) -> FileResult<()> {
        let from = from.as_ref();
        let to = to.as_ref();
        debug!("Moving file from {:?} to {:?}", from, to);
        
        fs::rename(from, to).await
            .map_err(FileError::Io)?;
        
        Ok(())
    }

    /// Delete a file
    pub async fn delete_file<P: AsRef<Path>>(path: P) -> FileResult<()> {
        let path = path.as_ref();
        debug!("Deleting file: {:?}", path);
        
        fs::remove_file(path).await
            .map_err(FileError::Io)?;
        
        Ok(())
    }

    /// Check if a file exists
    pub async fn file_exists<P: AsRef<Path>>(path: P) -> bool {
        let path = path.as_ref();
        path.exists() && path.is_file()
    }

    /// Check if a directory exists
    pub async fn dir_exists<P: AsRef<Path>>(path: P) -> bool {
        let path = path.as_ref();
        path.exists() && path.is_dir()
    }

    /// Create a directory and all its parent components if they are missing
    pub async fn create_dir_all<P: AsRef<Path>>(path: P) -> FileResult<()> {
        let path = path.as_ref();
        debug!("Creating directory: {:?}", path);
        
        fs::create_dir_all(path).await
            .map_err(FileError::Io)?;
        
        Ok(())
    }

    /// Get file metadata
    pub async fn metadata<P: AsRef<Path>>(path: P) -> FileResult<Metadata> {
        let path = path.as_ref();
        let metadata = fs::metadata(path).await
            .map_err(FileError::Io)?;
        
        Ok(metadata)
    }

    /// Get file size
    pub async fn file_size<P: AsRef<Path>>(path: P) -> FileResult<u64> {
        let metadata = Self::metadata(path).await?;
        Ok(metadata.len())
    }

    /// Create a backup path for a file
    fn create_backup_path(path: &Path) -> PathBuf {
        let mut backup_path = path.to_path_buf();
        let mut count = 1;
        
        while backup_path.exists() {
            let new_filename = if let Some(stem) = path.file_stem() {
                let ext = path.extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
                format!("{}.backup.{}{}", stem.to_string_lossy(), count, ext)
            } else {
                format!("{}.backup.{}", path.display(), count)
            };
            
            backup_path.set_file_name(new_filename);
            count += 1;
        }
        
        backup_path
    }
}

// Additional utility functions
impl FileOps {
    /// Read JSON file
    pub async fn read_json<T, P: AsRef<Path>>(path: P) -> FileResult<T>
    where
        T: serde::de::DeserializeOwned,
    {
        let contents = Self::read_file(path).await?;
        let value: T = serde_json::from_str(&contents)
            .map_err(|e| FileError::Serialization(e.to_string()))?;
        
        Ok(value)
    }

    /// Write JSON file
    pub async fn write_json<T, P: AsRef<Path>>(path: P, value: &T) -> FileResult<()>
    where
        T: serde::ser::Serialize,
    {
        let json = serde_json::to_string_pretty(value)
            .map_err(|e| FileError::Serialization(e.to_string()))?;
        Self::write_file(path, json).await?;
        
        Ok(())
    }

    /// Read TOML file
    pub async fn read_toml<T, P: AsRef<Path>>(path: P) -> FileResult<T>
    where
        T: serde::de::DeserializeOwned,
    {
        let contents = Self::read_file(path).await?;
        let value: T = toml::from_str(&contents)
            .map_err(|e| FileError::Serialization(e.to_string()))?;
        
        Ok(value)
    }

    /// Write TOML file
    pub async fn write_toml<T, P: AsRef<Path>>(path: P, value: &T) -> FileResult<()>
    where
        T: serde::ser::Serialize,
    {
        let toml = toml::to_string(value)
            .map_err(|e| FileError::Serialization(e.to_string()))?;
        Self::write_file(path, toml).await?;
        
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use std::path::Path;

    #[tokio::test]
    async fn test_read_write_file() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        
        let content = "Hello, World!";
        FileOps::write_file(&file_path, content).await.unwrap();
        
        let read_content = FileOps::read_file(&file_path).await.unwrap();
        assert_eq!(read_content, content);
    }

    #[tokio::test]
    async fn test_file_exists() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        
        assert!(!FileOps::file_exists(&file_path).await);
        
        FileOps::write_file(&file_path, "test").await.unwrap();
        assert!(FileOps::file_exists(&file_path).await);
    }

    #[tokio::test]
    async fn test_dir_operations() {
        let temp_dir = TempDir::new().unwrap();
        let dir_path = temp_dir.path().join("new_dir");
        
        assert!(!FileOps::dir_exists(&dir_path).await);
        
        FileOps::create_dir_all(&dir_path).await.unwrap();
        assert!(FileOps::dir_exists(&dir_path).await);
    }

    #[tokio::test]
    async fn test_copy_move_delete() {
        let temp_dir = TempDir::new().unwrap();
        let source_path = temp_dir.path().join("source.txt");
        let dest_path = temp_dir.path().join("dest.txt");
        
        FileOps::write_file(&source_path, "test content").await.unwrap();
        
        // Test copy
        FileOps::copy_file(&source_path, &dest_path).await.unwrap();
        assert!(FileOps::file_exists(&dest_path).await);
        
        // Test move
        let moved_path = temp_dir.path().join("moved.txt");
        FileOps::move_file(&dest_path, &moved_path).await.unwrap();
        assert!(!FileOps::file_exists(&dest_path).await);
        assert!(FileOps::file_exists(&moved_path).await);
        
        // Test delete
        FileOps::delete_file(&moved_path).await.unwrap();
        assert!(!FileOps::file_exists(&moved_path).await);
    }

    #[tokio::test]
    async fn test_json_operations() {
        #[derive(serde::Serialize, serde::Deserialize, PartialEq, Debug)]
        struct TestStruct {
            name: String,
            value: i32,
        }
        
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.json");
        
        let test_data = TestStruct {
            name: "test".to_string(),
            value: 42,
        };
        
        FileOps::write_json(&file_path, &test_data).await.unwrap();
        let read_data: TestStruct = FileOps::read_json(&file_path).await.unwrap();
        
        assert_eq!(test_data, read_data);
    }

    #[tokio::test]
    async fn test_file_size() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("size_test.txt");
        
        let content = "Hello, World!";
        FileOps::write_file(&file_path, content).await.unwrap();
        
        let size = FileOps::file_size(&file_path).await.unwrap();
        assert_eq!(size, content.len() as u64);
    }
}