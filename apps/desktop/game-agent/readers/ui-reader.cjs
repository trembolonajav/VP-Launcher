function visible(element) { const style=getComputedStyle(element),rect=element.getBoundingClientRect();return style.display!=="none"&&style.visibility!=="hidden"&&rect.width>0&&rect.height>0; }
function readUi(root=document) {
  const controls=[...root.querySelectorAll?.("button,[role=button],a")||[]].filter(visible).map(element=>String(element.innerText||element.textContent||element.getAttribute("aria-label")||"").replace(/\s+/g," ").trim()).filter(Boolean);
  const text=String(root.body?.innerText||root.documentElement?.innerText||"").slice(0,20000),inputs=[...root.querySelectorAll?.("input")||[]].filter(visible);
  return { controls:controls.slice(0,120),maps:controls.filter(value=>/\bNv\s*\d+/i.test(value)).slice(0,80),mapModalOpen:controls.some(value=>/^Mapa$/i.test(value))&&controls.some(value=>/\bNv\s*\d+/i.test(value)),marketOpen:controls.some(value=>/Loja do Mark|Comprar Agora|Vender selecionados/i.test(value)),inventoryOpen:controls.some(value=>/Mochila|Inventário|Capacidade/i.test(value)),auth:{ loginRequired:inputs.some(input=>input.type==="password")&&inputs.some(input=>/email|user|login|usu[aá]rio/i.test([input.type,input.name,input.id,input.placeholder,input.autocomplete].join(" "))),challenge:/captcha|cloudflare|verifique que você|código de verificação|autenticação em dois fatores|2fa/i.test(text) } };
}
module.exports={ readUi };
