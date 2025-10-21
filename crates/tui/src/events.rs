use crossterm::event::{KeyEvent, MouseEvent};
use std::sync::mpsc;

pub enum Event {
    Key(KeyEvent),
    Mouse(MouseEvent),
    Resize(u16, u16),
    Custom(String),
}

pub struct EventHandler {
    sender: mpsc::Sender<Event>,
    receiver: mpsc::Receiver<Event>,
}

impl Default for EventHandler {
    fn default() -> Self {
        Self::new()
    }
}

impl EventHandler {
    pub fn new() -> Self {
        let (sender, receiver) = mpsc::channel();
        EventHandler { sender, receiver }
    }

    pub fn sender(&self) -> mpsc::Sender<Event> {
        self.sender.clone()
    }

    pub fn receiver(&self) -> &mpsc::Receiver<Event> {
        &self.receiver
    }

    pub fn poll_event(&self) -> Option<Event> {
        self.receiver.try_recv().ok()
    }
}
