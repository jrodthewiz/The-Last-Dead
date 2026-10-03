// Text-only presentation helpers keep chapter state owned by the simulation.
export function journeyPrompt(run, device='keyboard') {
 const state=run?.journey, prompt=state?.prompts?.[run.playerId||'host']||state?.prompt;
 if(!prompt)return null;
 const input=device==='gamepad'?'HOLD VIEW / SELECT':'HOLD Q';
 return {...prompt,text:prompt.available?`${input} / ${prompt.label}`:prompt.label,
  progress:Math.max(0,Math.min(1,Number(state.progress)||0))};
}
export function journeyTransmission(run) {
 const state=run?.journey;
 if(!state)return null;
 const latest=state.log?.[0];
 return {title:state.title,speaker:latest?.speaker||'DISTRESS SIGNAL',
  text:latest?.text||'Truck Six is empty. Follow the receiving line to find the missing evacuees.'};
}
