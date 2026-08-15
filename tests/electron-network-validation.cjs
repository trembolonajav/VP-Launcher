const { app, session } = require("electron");
const os = require("node:os");
const path = require("node:path");
app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-gpu-compositing");
app.setPath("userData", path.join(os.tmpdir(), `vp-network-test-${process.pid}`));

app.whenReady().then(async () => {
  const { NetworkManager } = await import("../apps/desktop/main/network/NetworkManager.js");
  const profiles = [
    { id:"direct",name:"Direct",type:"DIRECT",config:{} },
    { id:"system",name:"System",type:"SYSTEM",config:{} },
    { id:"invalid",name:"Invalid",type:"PROXY",config:{protocol:"http",host:"127.0.0.1",port:9} }
  ];
  const events=[];
  const manager=new NetworkManager({repository:{list:()=>profiles},events:{add:event=>events.push(event)}});
  const directSession=session.fromPartition(`p4-direct-${Date.now()}`),systemSession=session.fromPartition(`p4-system-${Date.now()}`),invalidSession=session.fromPartition(`p4-invalid-${Date.now()}`);
  const [direct,system,invalid]=await Promise.all([
    manager.prepare({accountId:"direct",profileId:"direct",ses:directSession}),
    manager.prepare({accountId:"system",profileId:"system",ses:systemSession}),
    manager.prepare({accountId:"invalid",profileId:"invalid",ses:invalidSession})
  ]);
  const report={direct:direct.result,system:system.result,invalid:invalid.result,invalidReady:events.some(event=>event.accountId==="invalid"&&event.type==="NETWORK_READY")};
  console.log(`P4_NETWORK_VALIDATION=${JSON.stringify(report)}`);
  process.exit(direct.result.status==="OK"&&system.result.status==="OK"&&invalid.result.status!=="OK"&&!report.invalidReady?0:1);
}).catch(error=>{console.error(error);process.exit(1);});
