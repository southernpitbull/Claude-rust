//! Vector database abstraction for semantic search and memory retrieval
//!
//! Provides a unified interface for vector storage and similarity search,
//! supporting multiple backend implementations (in-memory, file-based, cloud).

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::RwLock;

/// Vector store error types
#[derive(Error, Debug)]
pub enum VectorStoreError {
    #[error("Storage error: {0}")]
    StorageError(String),

    #[error("Invalid vector dimension: expected {expected}, got {actual}")]
    InvalidDimension { expected: usize, actual: usize },

    #[error("Entry not found: {0}")]
    NotFound(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("Query error: {0}")]
    QueryError(String),
}

pub type VectorResult<T> = Result<T, VectorStoreError>;

/// Vector embedding
pub type Vector = Vec<f32>;

/// Document with vector embedding
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorDocument {
    pub id: String,
    pub content: String,
    pub embedding: Vector,
    pub metadata: HashMap<String, String>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

impl VectorDocument {
    pub fn new(id: impl Into<String>, content: impl Into<String>, embedding: Vector) -> Self {
        Self {
            id: id.into(),
            content: content.into(),
            embedding,
            metadata: HashMap::new(),
            timestamp: chrono::Utc::now(),
        }
    }

    pub fn with_metadata(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.metadata.insert(key.into(), value.into());
        self
    }
}

/// Search result with similarity score
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub document: VectorDocument,
    pub score: f32,
    pub rank: usize,
}

/// Search query parameters
#[derive(Debug, Clone)]
pub struct SearchQuery {
    pub embedding: Vector,
    pub top_k: usize,
    pub threshold: f32,
    pub filters: HashMap<String, String>,
}

impl SearchQuery {
    pub fn new(embedding: Vector, top_k: usize) -> Self {
        Self {
            embedding,
            top_k,
            threshold: 0.0,
            filters: HashMap::new(),
        }
    }

    pub fn with_threshold(mut self, threshold: f32) -> Self {
        self.threshold = threshold;
        self
    }

    pub fn with_filter(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.filters.insert(key.into(), value.into());
        self
    }
}

/// Vector store trait
#[async_trait]
pub trait VectorStore: Send + Sync {
    /// Insert a document
    async fn insert(&self, document: VectorDocument) -> VectorResult<()>;

    /// Insert multiple documents
    async fn insert_batch(&self, documents: Vec<VectorDocument>) -> VectorResult<()>;

    /// Get a document by ID
    async fn get(&self, id: &str) -> VectorResult<Option<VectorDocument>>;

    /// Delete a document
    async fn delete(&self, id: &str) -> VectorResult<bool>;

    /// Search for similar documents
    async fn search(&self, query: SearchQuery) -> VectorResult<Vec<SearchResult>>;

    /// Get total document count
    async fn count(&self) -> VectorResult<usize>;

    /// Clear all documents
    async fn clear(&self) -> VectorResult<()>;

    /// Get vector dimension
    fn dimension(&self) -> usize;
}

/// In-memory vector store implementation
pub struct InMemoryVectorStore {
    documents: Arc<RwLock<HashMap<String, VectorDocument>>>,
    dimension: usize,
}

impl InMemoryVectorStore {
    pub fn new(dimension: usize) -> Self {
        Self {
            documents: Arc::new(RwLock::new(HashMap::new())),
            dimension,
        }
    }

    /// Compute cosine similarity between two vectors
    fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
        if a.len() != b.len() {
            return 0.0;
        }

        let dot_product: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
        let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
        let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

        if norm_a == 0.0 || norm_b == 0.0 {
            return 0.0;
        }

        dot_product / (norm_a * norm_b)
    }

    /// Check if document matches filters
    fn matches_filters(doc: &VectorDocument, filters: &HashMap<String, String>) -> bool {
        filters.iter().all(|(k, v)| {
            doc.metadata.get(k).map(|val| val == v).unwrap_or(false)
        })
    }
}

#[async_trait]
impl VectorStore for InMemoryVectorStore {
    async fn insert(&self, document: VectorDocument) -> VectorResult<()> {
        if document.embedding.len() != self.dimension {
            return Err(VectorStoreError::InvalidDimension {
                expected: self.dimension,
                actual: document.embedding.len(),
            });
        }

        self.documents.write().await.insert(document.id.clone(), document);
        Ok(())
    }

    async fn insert_batch(&self, documents: Vec<VectorDocument>) -> VectorResult<()> {
        let mut store = self.documents.write().await;

        for doc in documents {
            if doc.embedding.len() != self.dimension {
                return Err(VectorStoreError::InvalidDimension {
                    expected: self.dimension,
                    actual: doc.embedding.len(),
                });
            }
            store.insert(doc.id.clone(), doc);
        }

        Ok(())
    }

    async fn get(&self, id: &str) -> VectorResult<Option<VectorDocument>> {
        Ok(self.documents.read().await.get(id).cloned())
    }

    async fn delete(&self, id: &str) -> VectorResult<bool> {
        Ok(self.documents.write().await.remove(id).is_some())
    }

    async fn search(&self, query: SearchQuery) -> VectorResult<Vec<SearchResult>> {
        if query.embedding.len() != self.dimension {
            return Err(VectorStoreError::InvalidDimension {
                expected: self.dimension,
                actual: query.embedding.len(),
            });
        }

        let documents = self.documents.read().await;
        let mut results: Vec<SearchResult> = documents
            .values()
            .filter(|doc| Self::matches_filters(doc, &query.filters))
            .map(|doc| {
                let score = Self::cosine_similarity(&query.embedding, &doc.embedding);
                SearchResult {
                    document: doc.clone(),
                    score,
                    rank: 0,
                }
            })
            .filter(|result| result.score >= query.threshold)
            .collect();

        // Sort by score descending
        results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());

        // Assign ranks and limit results
        results.truncate(query.top_k);
        for (idx, result) in results.iter_mut().enumerate() {
            result.rank = idx + 1;
        }

        Ok(results)
    }

    async fn count(&self) -> VectorResult<usize> {
        Ok(self.documents.read().await.len())
    }

    async fn clear(&self) -> VectorResult<()> {
        self.documents.write().await.clear();
        Ok(())
    }

    fn dimension(&self) -> usize {
        self.dimension
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_embedding(dim: usize, value: f32) -> Vector {
        vec![value; dim]
    }

    #[test]
    fn test_vector_document_creation() {
        let doc = VectorDocument::new("doc1", "Test content", vec![0.1, 0.2, 0.3]);
        assert_eq!(doc.id, "doc1");
        assert_eq!(doc.content, "Test content");
        assert_eq!(doc.embedding.len(), 3);
    }

    #[test]
    fn test_vector_document_with_metadata() {
        let doc = VectorDocument::new("doc1", "Test", vec![1.0])
            .with_metadata("key", "value");
        assert_eq!(doc.metadata.get("key"), Some(&"value".to_string()));
    }

    #[test]
    fn test_search_query_creation() {
        let query = SearchQuery::new(vec![1.0, 2.0], 10);
        assert_eq!(query.top_k, 10);
        assert_eq!(query.threshold, 0.0);
    }

    #[test]
    fn test_search_query_with_threshold() {
        let query = SearchQuery::new(vec![1.0], 10).with_threshold(0.5);
        assert_eq!(query.threshold, 0.5);
    }

    #[test]
    fn test_cosine_similarity() {
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![1.0, 0.0, 0.0];
        let similarity = InMemoryVectorStore::cosine_similarity(&a, &b);
        assert!((similarity - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_cosine_similarity_orthogonal() {
        let a = vec![1.0, 0.0];
        let b = vec![0.0, 1.0];
        let similarity = InMemoryVectorStore::cosine_similarity(&a, &b);
        assert!(similarity.abs() < 0.001);
    }

    #[tokio::test]
    async fn test_in_memory_store_insert() {
        let store = InMemoryVectorStore::new(3);
        let doc = VectorDocument::new("doc1", "Test", vec![1.0, 2.0, 3.0]);

        store.insert(doc).await.unwrap();
        assert_eq!(store.count().await.unwrap(), 1);
    }

    #[tokio::test]
    async fn test_in_memory_store_invalid_dimension() {
        let store = InMemoryVectorStore::new(3);
        let doc = VectorDocument::new("doc1", "Test", vec![1.0, 2.0]); // Wrong dimension

        let result = store.insert(doc).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_in_memory_store_get() {
        let store = InMemoryVectorStore::new(2);
        let doc = VectorDocument::new("doc1", "Test", vec![1.0, 2.0]);

        store.insert(doc.clone()).await.unwrap();

        let retrieved = store.get("doc1").await.unwrap();
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().id, "doc1");
    }

    #[tokio::test]
    async fn test_in_memory_store_delete() {
        let store = InMemoryVectorStore::new(2);
        let doc = VectorDocument::new("doc1", "Test", vec![1.0, 2.0]);

        store.insert(doc).await.unwrap();
        assert!(store.delete("doc1").await.unwrap());
        assert!(!store.delete("doc1").await.unwrap());
    }

    #[tokio::test]
    async fn test_in_memory_store_search() {
        let store = InMemoryVectorStore::new(2);

        store.insert(VectorDocument::new("doc1", "First", vec![1.0, 0.0])).await.unwrap();
        store.insert(VectorDocument::new("doc2", "Second", vec![0.0, 1.0])).await.unwrap();
        store.insert(VectorDocument::new("doc3", "Third", vec![1.0, 1.0])).await.unwrap();

        let query = SearchQuery::new(vec![1.0, 0.0], 2);
        let results = store.search(query).await.unwrap();

        assert_eq!(results.len(), 2);
        assert_eq!(results[0].document.id, "doc1");
        assert!(results[0].score > 0.9);
    }

    #[tokio::test]
    async fn test_in_memory_store_search_with_threshold() {
        let store = InMemoryVectorStore::new(2);

        store.insert(VectorDocument::new("doc1", "First", vec![1.0, 0.0])).await.unwrap();
        store.insert(VectorDocument::new("doc2", "Second", vec![0.0, 1.0])).await.unwrap();

        let query = SearchQuery::new(vec![1.0, 0.0], 10).with_threshold(0.9);
        let results = store.search(query).await.unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].document.id, "doc1");
    }

    #[tokio::test]
    async fn test_in_memory_store_clear() {
        let store = InMemoryVectorStore::new(2);

        store.insert(VectorDocument::new("doc1", "Test", vec![1.0, 2.0])).await.unwrap();
        assert_eq!(store.count().await.unwrap(), 1);

        store.clear().await.unwrap();
        assert_eq!(store.count().await.unwrap(), 0);
    }

    #[tokio::test]
    async fn test_in_memory_store_batch_insert() {
        let store = InMemoryVectorStore::new(2);

        let docs = vec![
            VectorDocument::new("doc1", "First", vec![1.0, 0.0]),
            VectorDocument::new("doc2", "Second", vec![0.0, 1.0]),
        ];

        store.insert_batch(docs).await.unwrap();
        assert_eq!(store.count().await.unwrap(), 2);
    }

    #[tokio::test]
    async fn test_search_with_filters() {
        let store = InMemoryVectorStore::new(2);

        let doc1 = VectorDocument::new("doc1", "First", vec![1.0, 0.0])
            .with_metadata("category", "A");
        let doc2 = VectorDocument::new("doc2", "Second", vec![1.0, 0.0])
            .with_metadata("category", "B");

        store.insert(doc1).await.unwrap();
        store.insert(doc2).await.unwrap();

        let query = SearchQuery::new(vec![1.0, 0.0], 10)
            .with_filter("category", "A");
        let results = store.search(query).await.unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].document.id, "doc1");
    }
}
