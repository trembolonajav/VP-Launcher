import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ProtonWorkerManager } from "../apps/desktop/main/network/ProtonWorkerManager.js";

test("Proton worker keeps secrets on stdin and allocates one local port per account", async (t) => {
  const secretDir = fs.mkdtempSync(path.join(os.tmpdir(), "vp-proton-test-"));
  t.after(() => fs.rmSync(secretDir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(secretDir, "proton-conta-02.wg.enc"), "encrypted");

  const calls = [];
  const runner = (_command, args, options) => {
    calls.push({ args, input: options.input });
    if (args[0] === "image") return { status: 0, stdout: "present", stderr: "" };
    if (args[0] === "inspect") return { status: 0, stdout: "running\n", stderr: "" };
    return { status: 0, stdout: "", stderr: "" };
  };
  const safeStorage = {
    decryptStringAsync: async () => ({ result: "[Interface]\nPrivateKey = private-secret\nAddress = 10.2.0.2/32, fd00::2/128\n[Peer]\nAllowedIPs = 0.0.0.0/0, ::/0\n" }),
  };
  const manager = new ProtonWorkerManager({ safeStorage, secretDir, runner });
  const worker = await manager.start("conta-02", 1);

  assert.equal(worker.port, 19002);
  const dockerArguments = calls.flatMap((call) => call.args).join(" ");
  assert.doesNotMatch(dockerArguments, /private-secret/);
  const feed = calls.find((call) => call.args[0] === "exec");
  assert.match(feed.input, /PrivateKey = private-secret/);
  assert.match(feed.input, /Table = off/);
  assert.doesNotMatch(feed.input, /::\/0|fd00/);
  assert.ok(calls.some((call) => call.args.includes("127.0.0.1:19002:8888")));
});

test("Proton worker failure removes its account container", async () => {
  const secretDir = fs.mkdtempSync(path.join(os.tmpdir(), "vp-proton-failure-"));
  fs.writeFileSync(path.join(secretDir, "proton-conta-01.wg.enc"), "encrypted");
  const calls = [];
  const runner = (_command, args) => {
    calls.push(args);
    if (args[0] === "image") return { status: 0, stdout: "present", stderr: "" };
    if (args[0] === "exec") return { status: 1, stdout: "", stderr: "feed failed" };
    return { status: 0, stdout: "", stderr: "" };
  };
  const manager = new ProtonWorkerManager({ safeStorage: { decryptStringAsync: async () => ({ result: "[Interface]\n" }) }, secretDir, runner });
  await assert.rejects(() => manager.start("conta-01", 0), /feed failed/);
  assert.deepEqual(calls.at(-1).slice(0, 3), ["rm", "-f", "vp-proton-conta-01"]);
  fs.rmSync(secretDir, { recursive: true, force: true });
});
