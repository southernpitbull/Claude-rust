use crate::components::UIComponent;

pub struct Renderer;

impl Default for Renderer {
    fn default() -> Self {
        Self::new()
    }
}

impl Renderer {
    pub fn new() -> Self {
        Renderer
    }

    pub fn render_component(&self, component: &dyn UIComponent) -> String {
        component.render()
    }

    pub fn render_text(&self, text: &str, x: u16, y: u16) -> String {
        format!("{}:{} {}", x, y, text)
    }
}
