import assert from "node:assert/strict";
import test from "node:test";
import { AGENT_PROTOCOL_VERSION, MAX_AGENT_MESSAGE_BYTES, validateAgentMessage } from "../apps/desktop/main/collector/BridgeProtocol.js";

const instanceId="11111111-1111-4111-8111-111111111111",valid = { version:AGENT_PROTOCOL_VERSION,instanceId,accountId:"conta-01",sequence:1,timestamp:new Date().toISOString(),type:"DELTA",payload:{ patch:{ location:{ current:"Cerulean" } },changed:["location"] } };
test("bridge accepts valid envelope",()=>assert.equal(validateAgentMessage(valid,"conta-01").ok,true));
test("bridge rejects account mismatch, unknown type and stale sequence",()=>{ assert.match(validateAgentMessage(valid,"conta-02").error,/account/); assert.match(validateAgentMessage({...valid,type:"NOPE"},"conta-01").error,/type/); assert.match(validateAgentMessage(valid,"conta-01",1).error,/sequence/); });
test("bridge permits sequence reset only for STATUS from a new document instance",()=>{const next={...valid,instanceId:"22222222-2222-4222-8222-222222222222",type:"STATUS",payload:{ state:"READY" }};assert.equal(validateAgentMessage(next,"conta-01",99,instanceId).ok,true);assert.match(validateAgentMessage({...next,type:"DELTA"},"conta-01",99,instanceId).error,/sequence/);});
test("bridge rejects oversized and forbidden payloads",()=>{ assert.match(validateAgentMessage({...valid,payload:{ text:"x".repeat(MAX_AGENT_MESSAGE_BYTES) }},"conta-01").error,/size/); assert.match(validateAgentMessage({...valid,payload:{ authorization:"Bearer secret" }},"conta-01").error,/forbidden/); });
