//! Terminal UI rendering engine for AIrchitect CLI

pub mod components;
pub mod events;
pub mod renderer;

use std::io;

#[derive(Debug, Clone)]
pub struct UIConfig {
    pub theme: Theme,
    pub animations: bool,
    pub syntax_highlighting: bool,
}

#[derive(Debug, Clone)]
pub enum Theme {
    Default,
    Dark,
    Light,
    HighContrast,
}

pub struct TerminalUI {
    pub config: UIConfig,
    pub width: u16,
    pub height: u16,
}

impl TerminalUI {
    pub fn new(config: UIConfig) -> Result<Self, ai_cli_utils::error::AIError> {
        let (width, height) = crossterm::terminal::size()
            .map_err(|e| ai_cli_utils::error::AIError::GenericError(e.to_string()))?;

        Ok(TerminalUI {
            config,
            width,
            height,
        })
    }

    pub fn init(&mut self) -> Result<(), ai_cli_utils::error::AIError> {
        crossterm::terminal::enable_raw_mode()
            .map_err(|e| ai_cli_utils::error::AIError::GenericError(e.to_string()))?;
        crossterm::execute!(
            io::stdout(),
            crossterm::terminal::EnterAlternateScreen,
            crossterm::cursor::Hide
        )
        .map_err(|e| ai_cli_utils::error::AIError::GenericError(e.to_string()))?;

        Ok(())
    }

    pub fn cleanup(&mut self) -> Result<(), ai_cli_utils::error::AIError> {
        crossterm::execute!(
            io::stdout(),
            crossterm::terminal::LeaveAlternateScreen,
            crossterm::cursor::Show
        )
        .map_err(|e| ai_cli_utils::error::AIError::GenericError(e.to_string()))?;
        crossterm::terminal::disable_raw_mode()
            .map_err(|e| ai_cli_utils::error::AIError::GenericError(e.to_string()))?;

        Ok(())
    }

    pub fn render(&mut self, content: &str) -> Result<(), ai_cli_utils::error::AIError> {
        use crossterm::{cursor, execute, terminal};
        use std::io::Write;

        execute!(
            io::stdout(),
            terminal::Clear(terminal::ClearType::All),
            cursor::MoveTo(0, 0)
        )
        .map_err(|e| ai_cli_utils::error::AIError::GenericError(e.to_string()))?;

        print!("{}", content);
        io::stdout()
            .flush()
            .map_err(|e| ai_cli_utils::error::AIError::GenericError(e.to_string()))?;

        Ok(())
    }
}
