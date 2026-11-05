/**
 * Automatically releases a port if it is already bound by a stale or lingering process.
 * Works seamlessly on Windows, Linux, and macOS.
 */
const { execSync } = require('child_process');

const port = process.argv[2] || process.env.API_PORT || 5000;

try {
  if (process.platform === 'win32') {
    // Windows: Find process listening on the port and kill it
    const findCmd = `powershell -NoProfile -Command "$conns = Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue; if ($conns) { $conns | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { if ($_ -gt 0 -and $_ -ne ${process.pid}) { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue; Write-Host ('[free-port] Released port ' + ${port} + ' by terminating PID ' + $_) } } }"`;
    execSync(findCmd, { stdio: 'inherit' });
  } else {
    // Unix/Linux/macOS
    try {
      execSync(`lsof -ti :${port} | xargs kill -9`, { stdio: 'ignore' });
      console.log(`[free-port] Released port ${port}`);
    } catch {}
  }
} catch (err) {
  // If no process was found or error occurred, continue normally
}

// Brief pause to allow OS socket cleanup
const start = Date.now();
while (Date.now() - start < 300) {}
process.exit(0);

