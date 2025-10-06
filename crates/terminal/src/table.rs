/// Terminal Table Rendering
///
/// Provides functions for rendering tables in the terminal using comfy-table.

use comfy_table::{
    modifiers::UTF8_ROUND_CORNERS, presets::UTF8_FULL, Attribute, Cell, CellAlignment, Color,
    ContentArrangement, Table as ComfyTable,
};

/// Table builder for creating formatted tables
pub struct Table {
    table: ComfyTable,
}

impl Table {
    /// Create a new table
    pub fn new() -> Self {
        let mut table = ComfyTable::new();
        table
            .load_preset(UTF8_FULL)
            .apply_modifier(UTF8_ROUND_CORNERS)
            .set_content_arrangement(ContentArrangement::Dynamic);

        Self { table }
    }

    /// Set table header
    pub fn set_header<I, S>(mut self, headers: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        let header_cells: Vec<Cell> = headers
            .into_iter()
            .map(|h| {
                Cell::new(h.into())
                    .add_attribute(Attribute::Bold)
                    .fg(Color::Blue)
            })
            .collect();

        self.table.set_header(header_cells);
        self
    }

    /// Add a row to the table
    pub fn add_row<I, S>(mut self, row: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<String> + std::fmt::Display,
    {
        self.table.add_row(row);
        self
    }

    /// Set column widths
    pub fn set_widths(mut self, widths: &[u16]) -> Self {
        for (idx, &width) in widths.iter().enumerate() {
            if let Some(column) = self.table.column_mut(idx) {
                column.set_constraint(comfy_table::ColumnConstraint::Absolute(
                    comfy_table::Width::Fixed(width),
                ));
            }
        }
        self
    }

    /// Set column alignment
    pub fn set_alignment(mut self, index: usize, alignment: Alignment) -> Self {
        if let Some(column) = self.table.column_mut(index) {
            column.set_cell_alignment(alignment.into());
        }
        self
    }

    /// Disable colors
    pub fn no_colors(mut self) -> Self {
        // Remove color preset
        self.table = ComfyTable::new();
        self.table
            .load_preset(UTF8_FULL)
            .apply_modifier(UTF8_ROUND_CORNERS)
            .set_content_arrangement(ContentArrangement::Dynamic);
        self
    }

    /// Render the table to string
    pub fn render(self) -> String {
        self.table.to_string()
    }

    /// Print the table to stdout
    pub fn print(self) {
        println!("{}", self.table);
    }
}

impl Default for Table {
    fn default() -> Self {
        Self::new()
    }
}

/// Column alignment options
#[derive(Debug, Clone, Copy)]
pub enum Alignment {
    Left,
    Center,
    Right,
}

impl From<Alignment> for CellAlignment {
    fn from(alignment: Alignment) -> Self {
        match alignment {
            Alignment::Left => CellAlignment::Left,
            Alignment::Center => CellAlignment::Center,
            Alignment::Right => CellAlignment::Right,
        }
    }
}

/// Create a simple table from rows
pub fn simple_table<I, R, S>(headers: I, rows: Vec<R>) -> String
where
    I: IntoIterator<Item = S>,
    R: IntoIterator<Item = S>,
    S: Into<String> + std::fmt::Display,
{
    let mut table = Table::new();
    table = table.set_header(headers);

    for row in rows {
        table = table.add_row(row);
    }

    table.render()
}

/// Create a key-value table
pub fn key_value_table<K, V>(pairs: Vec<(K, V)>) -> String
where
    K: Into<String>,
    V: Into<String>,
{
    let mut table = Table::new();
    table = table.set_header(vec!["Key", "Value"]);

    for (key, value) in pairs {
        table = table.add_row(vec![key.into(), value.into()]);
    }

    table.render()
}

/// Create a status table with colored status indicators
pub fn status_table<N, S>(items: Vec<(N, StatusIndicator, S)>) -> String
where
    N: Into<String>,
    S: Into<String>,
{
    let mut table = ComfyTable::new();
    table
        .load_preset(UTF8_FULL)
        .apply_modifier(UTF8_ROUND_CORNERS)
        .set_content_arrangement(ContentArrangement::Dynamic);

    // Set header
    table.set_header(vec![
        Cell::new("Name").add_attribute(Attribute::Bold),
        Cell::new("Status").add_attribute(Attribute::Bold),
        Cell::new("Details").add_attribute(Attribute::Bold),
    ]);

    // Add rows with colored status
    for (name, status, details) in items {
        let status_cell = match status {
            StatusIndicator::Success => Cell::new("✓ Success").fg(Color::Green),
            StatusIndicator::Warning => Cell::new("⚠ Warning").fg(Color::Yellow),
            StatusIndicator::Error => Cell::new("✗ Error").fg(Color::Red),
            StatusIndicator::Info => Cell::new("ℹ Info").fg(Color::Blue),
            StatusIndicator::Pending => Cell::new("⋯ Pending").fg(Color::Grey),
        };

        table.add_row(vec![Cell::new(name.into()), status_cell, Cell::new(details.into())]);
    }

    table.to_string()
}

/// Status indicator for status tables
#[derive(Debug, Clone, Copy)]
pub enum StatusIndicator {
    Success,
    Warning,
    Error,
    Info,
    Pending,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_table_builder() {
        let table = Table::new()
            .set_header(vec!["Name", "Age", "City"])
            .add_row(vec!["Alice", "30", "NYC"])
            .add_row(vec!["Bob", "25", "LA"])
            .render();

        assert!(table.contains("Name"));
        assert!(table.contains("Alice"));
        assert!(table.contains("Bob"));
    }

    #[test]
    fn test_simple_table() {
        let headers = vec!["Col1", "Col2"];
        let rows = vec![vec!["A", "B"], vec!["C", "D"]];

        let table = simple_table(headers, rows);

        assert!(table.contains("Col1"));
        assert!(table.contains("Col2"));
        assert!(table.contains("A"));
        assert!(table.contains("D"));
    }

    #[test]
    fn test_key_value_table() {
        let pairs = vec![("Name", "Alice"), ("Age", "30"), ("City", "NYC")];

        let table = key_value_table(pairs);

        assert!(table.contains("Key"));
        assert!(table.contains("Value"));
        assert!(table.contains("Name"));
        assert!(table.contains("Alice"));
    }

    #[test]
    fn test_status_table() {
        let items = vec![
            ("Service A", StatusIndicator::Success, "Running"),
            ("Service B", StatusIndicator::Warning, "High load"),
            ("Service C", StatusIndicator::Error, "Failed"),
        ];

        let table = status_table(items);

        assert!(table.contains("Service A"));
        assert!(table.contains("Success"));
        assert!(table.contains("Warning"));
    }

    #[test]
    fn test_table_alignment() {
        let table = Table::new()
            .set_header(vec!["Left", "Center", "Right"])
            .set_alignment(0, Alignment::Left)
            .set_alignment(1, Alignment::Center)
            .set_alignment(2, Alignment::Right)
            .add_row(vec!["A", "B", "C"])
            .render();

        assert!(table.contains("Left"));
        assert!(table.contains("Center"));
        assert!(table.contains("Right"));
    }
}
