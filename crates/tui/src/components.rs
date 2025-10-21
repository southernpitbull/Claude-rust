use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentConfig {
    pub width: u16,
    pub height: u16,
    pub x: u16,
    pub y: u16,
}

pub trait UIComponent {
    fn render(&self) -> String;
    fn update(&mut self, data: &str);
    fn handle_input(&mut self, input: &str) -> bool;
}
