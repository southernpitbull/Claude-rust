use crate::error::UtilsResult;
use std::path::Path;
use tokio::fs;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

/// Read file contents as string
pub async fn read_file(path: &Path) -> UtilsResult<String> {
    let mut file = fs::File::open(path).await?;
    let mut contents = String::new();
    file.read_to_string(&mut contents).await?;
    Ok(contents)
}

/// Write string contents to file
pub async fn write_file(path: &Path, contents: &str) -> UtilsResult<()> {
    let mut file = fs::File::create(path).await?;
    file.write_all(contents.as_bytes()).await?;
    file.sync_all().await?;
    Ok(())
}

/// Check if file exists
pub async fn exists(path: &Path) -> bool {
    fs::metadata(path).await.is_ok()
}

/// Create directory if it doesn't exist
pub async fn ensure_dir(path: &Path) -> UtilsResult<()> {
    if !exists(path).await {
        fs::create_dir_all(path).await?;
    }
    Ok(())
}
