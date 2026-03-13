use webact::*;

#[tokio::main]
async fn main() {
    if let Err(err) = run().await {
        eprintln!("Error: {err:#}");
        std::process::exit(1);
    }
}

async fn run() -> Result<()> {
    let mut args: Vec<String> = env::args().skip(1).collect();

    if args.is_empty() {
        print_help();
        return Ok(());
    }

    let command = args.remove(0);
    if matches!(command.as_str(), "-v" | "-V" | "--version") {
        println!("{}", env!("CARGO_PKG_VERSION"));
        return Ok(());
    }
    if matches!(command.as_str(), "-h" | "--help" | "help") {
        print_help();
        return Ok(());
    }
    if command == "mcp" {
        return webact::mcp::run_mcp_server().await;
    }
    if command == "setup" {
        webact::mcp_clients::configure_clients();
        return Ok(());
    }
    if command == "uninstall" {
        webact::mcp_clients::remove_clients();
        return Ok(());
    }

    let mut ctx = AppContext::new()?;
    if let Some(port) = env::var("CDP_PORT")
        .ok()
        .and_then(|v| v.parse::<u16>().ok())
    {
        ctx.cdp_port = port;
    }

    if command == "run" {
        let session_id = args
            .first()
            .cloned()
            .context("Usage: webact run <sessionId> [command args...]")?;
        ctx.set_current_session(session_id);
        ctx.hydrate_connection_from_state()?;

        if args.len() > 1 {
            let inline_command = args[1].clone();
            let inline_args = args[2..].to_vec();
            commands::dispatch(&mut ctx, &inline_command, &inline_args).await?;
        } else {
            run_command_file(&mut ctx).await?;
        }
        let buffered = ctx.drain_output();
        if !buffered.is_empty() {
            print!("{buffered}");
        }
        return Ok(());
    }

    if command != "launch" && command != "connect" {
        ctx.auto_discover_last_session()
            .context("No active session. Run: webact launch")?;
    }

    commands::dispatch(&mut ctx, &command, &args).await?;
    let buffered = ctx.drain_output();
    if !buffered.is_empty() {
        print!("{buffered}");
    }
    Ok(())
}

async fn run_command_file(ctx: &mut AppContext) -> Result<()> {
    let session_id = ctx.require_session_id()?.to_string();
    let cmd_file = ctx.command_file(&session_id);
    let content = fs::read_to_string(&cmd_file)
        .with_context(|| format!("Cannot read {}", cmd_file.display()))?;
    let parsed: serde_json::Value = serde_json::from_str(&content)
        .with_context(|| format!("Invalid JSON in {}", cmd_file.display()))?;

    let entries = if parsed.is_array() {
        serde_json::from_value::<Vec<CommandFileEntry>>(parsed)?
    } else {
        vec![serde_json::from_value::<CommandFileEntry>(parsed)?]
    };

    for entry in entries {
        if entry.command.trim().is_empty() {
            bail!("Missing \"command\" field in command file");
        }
        let args = entry.args.iter().map(json_value_to_arg).collect::<Vec<_>>();
        commands::dispatch(ctx, &entry.command, &args).await?;
    }

    Ok(())
}
