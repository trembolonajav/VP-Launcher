import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export class ProtonWorkerManager {
  constructor({ safeStorage, secretDir, imageDir, image = "vp-proton-worker:local", runner = spawnSync }) {
    this.safeStorage = safeStorage;
    this.secretDir = secretDir;
    this.imageDir = imageDir;
    this.image = image;
    this.runner = runner;
    this.workers = new Map();
    this.imageReady = false;
  }

  run(args, { allowFailure = false, input } = {}) {
    const result = this.runner("docker", args, {
      encoding: "utf8",
      windowsHide: true,
      timeout: 120000,
      input,
    });
    if (result.error && !allowFailure) throw result.error;
    if (result.status && !allowFailure) {
      throw new Error((result.stderr || result.stdout || `docker ${args[0]} failed`).trim());
    }
    return result;
  }

  ensureImage() {
    if (this.imageReady) return;
    const inspected = this.run(["image", "inspect", this.image], { allowFailure: true });
    if (inspected.status) {
      if (!this.imageDir || !fs.existsSync(path.join(this.imageDir, "Dockerfile"))) {
        throw new Error("Imagem do worker Proton ausente e Dockerfile não encontrado.");
      }
      this.run(["build", "-t", this.image, this.imageDir]);
    }
    this.imageReady = true;
  }

  async start(accountId, index) {
    const source = path.join(this.secretDir, `proton-${accountId}.wg.enc`);
    if (!fs.existsSync(source)) throw new Error("Configuração Proton ausente.");
    this.ensureImage();

    const decrypted = await this.safeStorage.decryptStringAsync(fs.readFileSync(source));
    const ipv4Config = decrypted.result
      .replace(/^(Address\s*=\s*)([^,\r\n]+),[^\r\n]+/mi, "$1$2")
      .replace(/^(AllowedIPs\s*=\s*)0\.0\.0\.0\/0\s*,\s*::\/0/mi, "$10.0.0.0/0")
      .replace(/^(\[Interface\]\s*)/mi, "$1\nTable = off\n");
    const name = `vp-proton-${accountId}`;
    const port = 19001 + index;

    this.run(["rm", "-f", name], { allowFailure: true });
    try {
      this.run(["run", "-d", "--name", name, "--cap-add", "NET_ADMIN", "--device", "/dev/net/tun", "--tmpfs", "/run/vp:rw,noexec,nosuid,size=65536", "-p", `127.0.0.1:${port}:8888`, this.image]);
      this.run(["exec", "-i", name, "sh", "-c", "umask 077; cat > /run/vp/wg0.conf"], { input: ipv4Config });
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const status = this.run(["inspect", "-f", "{{.State.Status}}", name]).stdout.trim();
      if (status !== "running") {
        const logs = this.run(["logs", "--tail", "30", name], { allowFailure: true });
        throw new Error(logs.stdout || logs.stderr || `Worker ${status}`);
      }
    } catch (error) {
      this.run(["rm", "-f", name], { allowFailure: true });
      throw error;
    }

    const worker = { accountId, name, host: "127.0.0.1", port, protocol: "http", status: "RUNNING" };
    this.workers.set(accountId, worker);
    return worker;
  }

  stop(accountId) {
    const name = this.workers.get(accountId)?.name || `vp-proton-${accountId}`;
    this.run(["rm", "-f", name], { allowFailure: true });
    this.workers.delete(accountId);
    return { ok: true };
  }

  stopAll() {
    for (const accountId of [...this.workers.keys()]) this.stop(accountId);
  }
}
