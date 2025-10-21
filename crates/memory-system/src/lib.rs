//! Project memory with LlamaIndex integration for AIrchitect CLI

pub mod context;
pub mod storage;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryConfig {
    pub enabled: bool,
    pub max_size: String,
    pub ttl: u64,
    pub vector_store: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryEntry {
    pub key: String,
    pub value: String,
    pub timestamp: u64,
    pub tags: Vec<String>,
}

pub struct MemorySystem {
    pub config: MemoryConfig,
    entries: HashMap<String, MemoryEntry>,
}

impl MemorySystem {
    pub fn new(config: MemoryConfig) -> Self {
        MemorySystem {
            config,
            entries: HashMap::new(),
        }
    }

    pub fn store(
        &mut self,
        key: String,
        value: String,
        tags: Vec<String>,
    ) -> Result<(), ai_cli_utils::error::AIError> {
        let entry = MemoryEntry {
            key: key.clone(),
            value,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            tags,
        };

        self.entries.insert(key, entry);
        Ok(())
    }

    pub fn retrieve(&self, key: &str) -> Option<&MemoryEntry> {
        self.entries.get(key)
    }

    pub fn search_by_tags(&self, tags: &[String]) -> Vec<&MemoryEntry> {
        self.entries
            .values()
            .filter(|entry| tags.iter().any(|tag| entry.tags.contains(tag)))
            .collect()
    }

    pub fn cleanup_expired(&mut self) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        self.entries
            .retain(|_, entry| now - entry.timestamp < self.config.ttl);
    }

    pub fn count(&self) -> usize {
        self.entries.len()
    }

    pub fn clear(&mut self) {
        self.entries.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_config() -> MemoryConfig {
        MemoryConfig {
            enabled: true,
            max_size: "100MB".to_string(),
            ttl: 3600,
            vector_store: "local".to_string(),
        }
    }

    // MemoryConfig tests
    #[test]
    fn test_memory_config_creation() {
        let config = MemoryConfig {
            enabled: true,
            max_size: "50MB".to_string(),
            ttl: 7200,
            vector_store: "chromadb".to_string(),
        };

        assert!(config.enabled);
        assert_eq!(config.max_size, "50MB");
        assert_eq!(config.ttl, 7200);
        assert_eq!(config.vector_store, "chromadb");
    }

    #[test]
    fn test_memory_config_serialization() {
        let config = create_test_config();
        let json = serde_json::to_string(&config).unwrap();
        let deserialized: MemoryConfig = serde_json::from_str(&json).unwrap();

        assert_eq!(config.enabled, deserialized.enabled);
        assert_eq!(config.max_size, deserialized.max_size);
        assert_eq!(config.ttl, deserialized.ttl);
        assert_eq!(config.vector_store, deserialized.vector_store);
    }

    #[test]
    fn test_memory_config_clone() {
        let config = create_test_config();
        let cloned = config.clone();

        assert_eq!(config.enabled, cloned.enabled);
        assert_eq!(config.max_size, cloned.max_size);
        assert_eq!(config.ttl, cloned.ttl);
    }

    // MemoryEntry tests
    #[test]
    fn test_memory_entry_creation() {
        let entry = MemoryEntry {
            key: "test_key".to_string(),
            value: "test_value".to_string(),
            timestamp: 1234567890,
            tags: vec!["tag1".to_string(), "tag2".to_string()],
        };

        assert_eq!(entry.key, "test_key");
        assert_eq!(entry.value, "test_value");
        assert_eq!(entry.timestamp, 1234567890);
        assert_eq!(entry.tags.len(), 2);
    }

    #[test]
    fn test_memory_entry_serialization() {
        let entry = MemoryEntry {
            key: "key".to_string(),
            value: "value".to_string(),
            timestamp: 1000,
            tags: vec!["test".to_string()],
        };

        let json = serde_json::to_string(&entry).unwrap();
        let deserialized: MemoryEntry = serde_json::from_str(&json).unwrap();

        assert_eq!(entry.key, deserialized.key);
        assert_eq!(entry.value, deserialized.value);
        assert_eq!(entry.timestamp, deserialized.timestamp);
        assert_eq!(entry.tags, deserialized.tags);
    }

    // MemorySystem tests
    #[test]
    fn test_memory_system_new() {
        let config = create_test_config();
        let system = MemorySystem::new(config.clone());

        assert_eq!(system.config.enabled, config.enabled);
        assert_eq!(system.count(), 0);
    }

    #[test]
    fn test_store_and_retrieve() {
        let config = create_test_config();
        let mut system = MemorySystem::new(config);

        let result = system.store(
            "key1".to_string(),
            "value1".to_string(),
            vec!["tag1".to_string()],
        );

        assert!(result.is_ok());

        let entry = system.retrieve("key1");
        assert!(entry.is_some());

        let entry = entry.unwrap();
        assert_eq!(entry.key, "key1");
        assert_eq!(entry.value, "value1");
        assert_eq!(entry.tags, vec!["tag1"]);
    }

    #[test]
    fn test_retrieve_nonexistent() {
        let config = create_test_config();
        let system = MemorySystem::new(config);

        let entry = system.retrieve("nonexistent");
        assert!(entry.is_none());
    }

    #[test]
    fn test_store_multiple_entries() {
        let config = create_test_config();
        let mut system = MemorySystem::new(config);

        system
            .store("key1".to_string(), "value1".to_string(), vec![])
            .unwrap();
        system
            .store("key2".to_string(), "value2".to_string(), vec![])
            .unwrap();
        system
            .store("key3".to_string(), "value3".to_string(), vec![])
            .unwrap();

        assert_eq!(system.count(), 3);

        assert!(system.retrieve("key1").is_some());
        assert!(system.retrieve("key2").is_some());
        assert!(system.retrieve("key3").is_some());
    }

    #[test]
    fn test_overwrite_entry() {
        let config = create_test_config();
        let mut system = MemorySystem::new(config);

        system
            .store("key".to_string(), "old_value".to_string(), vec![])
            .unwrap();
        assert_eq!(system.retrieve("key").unwrap().value, "old_value");

        system
            .store("key".to_string(), "new_value".to_string(), vec![])
            .unwrap();
        assert_eq!(system.retrieve("key").unwrap().value, "new_value");

        assert_eq!(system.count(), 1);
    }

    #[test]
    fn test_search_by_single_tag() {
        let config = create_test_config();
        let mut system = MemorySystem::new(config);

        system
            .store(
                "key1".to_string(),
                "value1".to_string(),
                vec!["tag_a".to_string()],
            )
            .unwrap();
        system
            .store(
                "key2".to_string(),
                "value2".to_string(),
                vec!["tag_b".to_string()],
            )
            .unwrap();
        system
            .store(
                "key3".to_string(),
                "value3".to_string(),
                vec!["tag_a".to_string()],
            )
            .unwrap();

        let results = system.search_by_tags(&[String::from("tag_a")]);

        assert_eq!(results.len(), 2);
        assert!(results.iter().any(|e| e.key == "key1"));
        assert!(results.iter().any(|e| e.key == "key3"));
    }

    #[test]
    fn test_search_by_multiple_tags() {
        let config = create_test_config();
        let mut system = MemorySystem::new(config);

        system
            .store(
                "key1".to_string(),
                "value1".to_string(),
                vec!["tag_a".to_string(), "tag_b".to_string()],
            )
            .unwrap();

        system
            .store(
                "key2".to_string(),
                "value2".to_string(),
                vec!["tag_b".to_string(), "tag_c".to_string()],
            )
            .unwrap();

        system
            .store(
                "key3".to_string(),
                "value3".to_string(),
                vec!["tag_d".to_string()],
            )
            .unwrap();

        let results = system.search_by_tags(&[String::from("tag_b")]);
        assert_eq!(results.len(), 2);

        let results = system.search_by_tags(&[String::from("tag_d")]);
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn test_search_no_matches() {
        let config = create_test_config();
        let mut system = MemorySystem::new(config);

        system
            .store(
                "key1".to_string(),
                "value1".to_string(),
                vec!["tag_a".to_string()],
            )
            .unwrap();

        let results = system.search_by_tags(&[String::from("nonexistent_tag")]);
        assert_eq!(results.len(), 0);
    }

    #[test]
    fn test_search_empty_tags() {
        let config = create_test_config();
        let mut system = MemorySystem::new(config);

        system
            .store(
                "key1".to_string(),
                "value1".to_string(),
                vec!["tag_a".to_string()],
            )
            .unwrap();

        let results = system.search_by_tags(&[]);
        assert_eq!(results.len(), 0);
    }

    #[test]
    fn test_cleanup_expired_entries() {
        let config = MemoryConfig {
            enabled: true,
            max_size: "100MB".to_string(),
            ttl: 1,
            vector_store: "local".to_string(),
        };

        let mut system = MemorySystem::new(config);

        system
            .store("key1".to_string(), "value1".to_string(), vec![])
            .unwrap();

        std::thread::sleep(std::time::Duration::from_secs(2));

        system
            .store("key2".to_string(), "value2".to_string(), vec![])
            .unwrap();

        assert_eq!(system.count(), 2);

        system.cleanup_expired();

        assert_eq!(system.count(), 1);
        assert!(system.retrieve("key2").is_some());
        assert!(system.retrieve("key1").is_none());
    }

    #[test]
    fn test_cleanup_no_expired() {
        let config = create_test_config();
        let mut system = MemorySystem::new(config);

        system
            .store("key1".to_string(), "value1".to_string(), vec![])
            .unwrap();
        system
            .store("key2".to_string(), "value2".to_string(), vec![])
            .unwrap();

        assert_eq!(system.count(), 2);

        system.cleanup_expired();

        assert_eq!(system.count(), 2);
    }

    #[test]
    fn test_clear_memory() {
        let config = create_test_config();
        let mut system = MemorySystem::new(config);

        system
            .store("key1".to_string(), "value1".to_string(), vec![])
            .unwrap();
        system
            .store("key2".to_string(), "value2".to_string(), vec![])
            .unwrap();

        assert_eq!(system.count(), 2);

        system.clear();

        assert_eq!(system.count(), 0);
        assert!(system.retrieve("key1").is_none());
        assert!(system.retrieve("key2").is_none());
    }

    #[test]
    fn test_store_with_empty_value() {
        let config = create_test_config();
        let mut system = MemorySystem::new(config);

        system
            .store("key".to_string(), String::new(), vec![])
            .unwrap();

        let entry = system.retrieve("key");
        assert!(entry.is_some());
        assert_eq!(entry.unwrap().value, "");
    }

    #[test]
    fn test_store_with_unicode() {
        let config = create_test_config();
        let mut system = MemorySystem::new(config);

        system
            .store(
                "日本語".to_string(),
                "こんにちは世界".to_string(),
                vec!["タグ".to_string()],
            )
            .unwrap();

        let entry = system.retrieve("日本語");
        assert!(entry.is_some());
        assert_eq!(entry.unwrap().value, "こんにちは世界");
    }

    #[test]
    fn test_timestamp_accuracy() {
        let config = create_test_config();
        let mut system = MemorySystem::new(config);

        let before = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        system
            .store("key".to_string(), "value".to_string(), vec![])
            .unwrap();

        let after = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let entry = system.retrieve("key").unwrap();

        assert!(entry.timestamp >= before);
        assert!(entry.timestamp <= after);
    }
}
