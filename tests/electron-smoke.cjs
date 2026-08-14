const { app, safeStorage } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "vp-electron-"));
app.setPath("userData", directory);

app.whenReady().then(async () => {
  try {
    const { openDatabase } = await import("../apps/desktop/main/storage/Database.js");
    const { Vault, VaultState } = await import("../apps/desktop/main/security/Vault.js");
    const database = openDatabase(path.join(directory, "smoke.db"));
    const vault = new Vault(database, safeStorage, path.join(directory, "missing.enc"));
    await vault.initialize();
    const saved = await vault.save({ id: "smoke", provider: "test", username: "user", password: "secret" });
    const secret = await vault.secret("smoke");
    if (!saved.ok || secret.state !== VaultState.READY || secret.password !== "secret") throw new Error("Electron Vault smoke test failed");
    database.close();
    process.stdout.write("Electron SQLite/Vault smoke test passed\n");
    app.exit(0);
  } catch (error) {
    process.stderr.write(`${error.stack || error}\n`);
    app.exit(1);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
