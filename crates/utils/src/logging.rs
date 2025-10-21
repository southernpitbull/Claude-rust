use log::info;
use std::io::Write;

pub fn setup_logging(verbosity: u8) {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .format(|buf, record| {
            writeln!(
                buf,
                "{} [{}] - {}",
                chrono::Local::now().format("%Y-%m-%d %H:%M:%S"),
                record.level(),
                record.args()
            )
        })
        .init();

    match verbosity {
        0 => info!("Logging initialized with default level"),
        1 => info!("Logging initialized with verbose level"),
        2 => info!("Logging initialized with very verbose level"),
        _ => info!("Logging initialized with maximum verbosity"),
    }
}
