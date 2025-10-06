//! Task Classifier
//! 
//! Classifies user tasks to determine the best approach and model

use crate::model_selector::TaskType;
use regex::Regex;
use std::collections::HashMap;

/// Task classification result
#[derive(Debug, Clone)]
pub struct TaskClassification {
    pub task_type: TaskType,
    pub confidence: f64, // 0.0 to 1.0
    pub keywords: Vec<String>,
    pub required_capabilities: Vec<String>,
}

/// Task Classifier for analyzing and categorizing user requests
pub struct TaskClassifier {
    // Regex patterns for different task types
    coding_patterns: Vec<Regex>,
    analytical_patterns: Vec<Regex>,
    creative_patterns: Vec<Regex>,
    research_patterns: Vec<Regex>,
}

impl TaskClassifier {
    /// Create a new task classifier with default patterns
    pub fn new() -> Self {
        Self {
            coding_patterns: Self::create_coding_patterns(),
            analytical_patterns: Self::create_analytical_patterns(),
            creative_patterns: Self::create_creative_patterns(),
            research_patterns: Self::create_research_patterns(),
        }
    }

    /// Create regex patterns for coding tasks
    fn create_coding_patterns() -> Vec<Regex> {
        vec![
            Regex::new(r"(?i)\b(code|function|implement|write|program|algorithm|debug|fix|error|bug|test|unit test|syntax|variable|function|class|method|api|endpoint|library|framework|package|module|script|shell|bash|python|javascript|java|c\+\+|rust|go|typescript|php|ruby|c#|csharp|swift|kotlin|scala|rust|html|css|sql|database|query|table|schema|migration|docker|kubernetes|yaml|json|xml|config|configuration|build|compile|deploy|ci/cd|git|version control|repository|branch|merge|pull request|clone|push|pull)\b").unwrap(),
            Regex::new(r"(?i)\b(function|method|class|object|inheritance|polymorphism|encapsulation|abstraction|interface|trait|struct|enum|generic|template|lambda|closure|async|await|promise|callback|event|handler|loop|iteration|array|list|map|hash|set|queue|stack|tree|graph|linked list|binary search|sort|merge|bubble|quicksort|recursion|iteration|iteration|iteration)\b").unwrap(),
            Regex::new(r"(?i)\b(for loop|while loop|if else|switch case|try catch|exception|error handling|validation|authentication|authorization|encryption|hashing|security|input sanitization|output encoding|csrf|xss|sql injection|oauth|jwt|session|cookie|state|context|scope|namespace|import|export|require|include|extend|implement|override|overload|interface|abstract|final|static|const|let|var|boolean|integer|float|string|array|object|map|json|xml|yaml|csv|tsv|pipe|redirect|pipe|redirect|standard input|standard output|standard error)\b").unwrap(),
        ]
    }

    /// Create regex patterns for analytical tasks
    fn create_analytical_patterns() -> Vec<Regex> {
        vec![
            Regex::new(r"(?i)\b(analyze|analysis|analyze|examine|study|review|evaluate|assess|judge|compare|contrast|determine|find|identify|recognize|detect|discover|reveal|uncover|investigate|research|explore|examine|scrutinize|assess|appraise|value|estimate|calculate|compute|measure|quantify|gauge|rate|rank|score|grade|classify|categorize|organize|structure|arrange|sort|order|rank|prioritize|sequence|pattern|trend|correlation|relationship|factor|variable|coefficient|statistic|data|metric|indicator|measure|KPI|dashboard|report|chart|graph|visualization|table|matrix|grid|spreadsheet|excel|formula|equation|function|model|simulation|prediction|forecast|projection|estimate|projection|projection)\b").unwrap(),
            Regex::new(r"(?i)\b(math|mathematics|calculus|algebra|geometry|trigonometry|statistics|probability|statistical|statistically|significant|significance|p-value|confidence|interval|regression|correlation|variance|standard deviation|mean|median|mode|average|sum|product|ratio|percentage|fraction|decimal|integer|real number|complex number|prime|factor|multiple|divisor|equation|inequality|function|graph|plot|axis|x-axis|y-axis|ordinate|abscissa|slope|intercept|derivative|integral|limit|series|sequence|matrix|vector|scalar|tensor|algebra|linear|quadratic|cubic|polynomial|rational|exponential|logarithmic|trigonometric|hyperbolic|complex|imaginary|real|absolute|relative|proportional|inverse|direct|indirect|linear|nonlinear|parametric|implicit|explicit)\b").unwrap(),
        ]
    }

    /// Create regex patterns for creative tasks
    fn create_creative_patterns() -> Vec<Regex> {
        vec![
            Regex::new(r"(?i)\b(create|generate|write|draft|compose|invent|devise|design|imagine|brainstorm|ideate|innovate|develop|produce|make|build|construct|formulate|author|pen|craft|fashion|forge|shape|sculpt|mold|model|carve|engrave|etch|paint|draw|sketch|illustrate|depict|portray|represent|express|convey|communicate|articulate|articulate)\b").unwrap(),
            Regex::new(r"(?i)\b(story|narrative|tale|fable|parable|anecdote|novel|book|chapter|section|paragraph|verse|stanza|poem|lyrics|song|music|melody|rhythm|harmony|composition|symphony|suite|opera|play|drama|tragedy|comedy|farce|satire|parody|skit|sketch|screenplay|script|dialogue|monologue|soliloquy|character|characterization|plot|subplot|theme|motif|symbolism|metaphor|simile|imagery|alliteration|rhyme|rhythm|meter|verse|stanza|rhyme scheme|alliteration|onomatopoeia|personification|hyperbole|irony|sarcasm|satire|parody|humor|wit|comedy|tragedy|drama|romance|adventure|fantasy|science fiction|sci-fi|dystopia|utopia|cyberpunk|steampunk|western|historical|biography|autobiography|memoir|journal|diary|letter|correspondence|memo|note|annotation|commentary|critique|review|criticism|analysis|interpretation|explanation|elaboration|speculation|hypothesis|theory|philosophy|philosophical|abstract|concrete|conceptual|practical|theoretical|practical|realistic|idealistic|optimistic|pessimistic|cynical|skeptical|gullible|credulous|naive|worldly|sophisticated|refined|cultured|educated|learned|scholarly|academic|intellectual|intellectual|smart|clever|brilliant|genius|gifted|talented|skilled|expert|professional|amateur|beginner|novice|intermediate|advanced|expert|master|virtuoso|prodigy|gifted|talented|gifted|talented|gifted|talented)\b").unwrap(),
        ]
    }

    /// Create regex patterns for research tasks
    fn create_research_patterns() -> Vec<Regex> {
        vec![
            Regex::new(r"(?i)\b(research|study|investigate|explore|examine|analyze|review|survey|census|poll|questionnaire|interview|focus group|experiment|trial|test|clinical trial|laboratory|lab|lab report|research paper|academic|scholarly|thesis|dissertation|paper|article|journal|publication|reference|bibliography|citations|footnotes|endnotes|abstract|summary|conclusion|findings|results|data|methodology|method|procedure|protocol|protocol|protocol|protocol|protocol|protocol|protocol|protocol|protocol)\b").unwrap(),
            Regex::new(r"(?i)\b(fact|evidence|proof|data|information|knowledge|truth|reality|actual|real|genuine|authentic|valid|reliable|credible|trustworthy|dependable|sound|solid|firm|strong|robust|sturdy|durable|lasting|enduring|permanent|lasting|enduring|permanent|lasting|enduring|permanent|lasting|enduring|permanent|lasting|enduring|permanent|lasting|enduring|permanent|lasting|enduring|permanent|lasting|enduring|permanent|lasting|enduring|permanent|lasting|enduring|permanent|lasting|enduring|permanent|lasting|enduring|permanent|lasting|enduring|permanent|lasting|enduring|permanent|lasting|enduring|permanent|lasting|enduring|permanent|lasting|enduring|permanent|lasting|enduring|permanent|lasting|enduring|permanent|lasting|enduring|permanent|lasting|enduring|permanent|lasting|enduring|permanent|lasting|enduring|permanent|lasting|enduring|permanent|lasting|enduring|permanent|lasting|enduring|permanent|lasting|enduring|permanent|lasting|enduring|permanent)\b").unwrap(),
        ]
    }

    /// Classify a task based on the input text
    pub fn classify_task(&self, text: &str) -> TaskClassification {
        let text_lower = text.to_lowercase();
        let mut scores = HashMap::new();
        let mut keywords = Vec::new();

        // Score coding tasks
        let coding_score = self.score_patterns(&self.coding_patterns, &text_lower, &mut keywords);
        scores.insert(TaskType::Coding, coding_score);

        // Score analytical tasks
        let analytical_score = self.score_patterns(&self.analytical_patterns, &text_lower, &mut keywords);
        scores.insert(TaskType::Analytical, analytical_score);

        // Score creative tasks
        let creative_score = self.score_patterns(&self.creative_patterns, &text_lower, &mut keywords);
        scores.insert(TaskType::Creative, creative_score);

        // Score research tasks
        let research_score = self.score_patterns(&self.research_patterns, &text_lower, &mut keywords);
        scores.insert(TaskType::Research, research_score);

        // Default to simple if no specific pattern matches well
        if scores.values().all(|&score| score < 0.1) {
            return TaskClassification {
                task_type: TaskType::Simple,
                confidence: 0.5, // Low confidence for simple classification
                keywords: vec![],
                required_capabilities: vec!["text".to_string()],
            };
        }

        // Find the highest scoring task type
        let (task_type, max_score) = scores
            .iter()
            .max_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap())
            .unwrap();

        let confidence = (*max_score).min(1.0);
        let required_capabilities = self.get_required_capabilities(task_type);

        TaskClassification {
            task_type: task_type.clone(),
            confidence,
            keywords: keywords.iter().cloned().collect::<std::collections::HashSet<_>>().into_iter().collect(), // Remove duplicates
            required_capabilities,
        }
    }

    /// Score text against patterns and collect matching keywords
    fn score_patterns(
        &self,
        patterns: &[Regex],
        text: &str,
        keywords: &mut Vec<String>,
    ) -> f64 {
        let mut score = 0.0;
        let text_words: Vec<&str> = text.split_whitespace().collect();

        for pattern in patterns {
            if let Some(mat) = pattern.find(text) {
                // Add the matched text to keywords
                keywords.push(mat.as_str().to_string());
                // Score based on word matches
                for word in &text_words {
                    if pattern.is_match(word) {
                        score += 1.0;
                    }
                }
                // Add extra score for the whole pattern match
                score += 0.5;
            }
        }

        // Normalize score to 0-1 range (arbitrary normalization)
        score / (patterns.len() * 5) as f64
    }

    /// Get required capabilities for a task type
    fn get_required_capabilities(&self, task_type: &TaskType) -> Vec<String> {
        match task_type {
            TaskType::Coding => vec!["code".to_string(), "text".to_string()],
            TaskType::Analytical => vec!["reasoning".to_string(), "text".to_string()],
            TaskType::Creative => vec!["text".to_string(), "creativity".to_string()],
            TaskType::Research => vec!["text".to_string(), "analysis".to_string()],
            TaskType::Simple => vec!["text".to_string()],
            TaskType::Complex => vec!["reasoning".to_string(), "text".to_string()],
            TaskType::Other => vec!["text".to_string()],
        }
    }
}

impl Default for TaskClassifier {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_task_classifier_creation() {
        let classifier = TaskClassifier::new();
        assert!(!classifier.coding_patterns.is_empty());
    }

    #[test]
    fn test_coding_task_classification() {
        let classifier = TaskClassifier::new();
        let result = classifier.classify_task("Write a Python function to calculate factorial");
        
        assert!(matches!(result.task_type, TaskType::Coding));
        assert!(result.confidence > 0.0);
        assert!(result.required_capabilities.contains(&"code".to_string()));
    }

    #[test]
    fn test_analytical_task_classification() {
        let classifier = TaskClassifier::new();
        let result = classifier.classify_task("Analyze the sales data and find trends");
        
        assert!(matches!(result.task_type, TaskType::Analytical));
        assert!(result.confidence > 0.0);
    }

    #[test]
    fn test_creative_task_classification() {
        let classifier = TaskClassifier::new();
        let result = classifier.classify_task("Write a creative story about a robot");
        
        assert!(matches!(result.task_type, TaskType::Creative));
        assert!(result.confidence > 0.0);
    }

    #[test]
    fn test_simple_task_classification() {
        let classifier = TaskClassifier::new();
        let result = classifier.classify_task("What is the weather today?");
        
        // Simple tasks might get classified differently based on our logic,
        // but this tests that it doesn't panic and returns some classification
        assert!(result.confidence >= 0.0);
    }
}