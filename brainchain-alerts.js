const pushToggle=document.getElementById('pushToggle');
const pushTest=document.getElementById('pushTest');
const pushNotice=document.getElementById('pushNotice');
let pushRegistration;
let applicationKey;
async function applyBrainBadge(count){
 if(!navigator.setAppBadge)return;
 if(count)await navigator.setAppBadge(count);
 else await navigator.clearAppBadge();
}
let badgeRequest=0;
async function refreshBrainBadge(){
 if(document.hidden||!localStorage.getItem('bc_alert_owner'))return;
 const request=++badgeRequest;
 try{
  const {count}=await rpc('bc_push_status');
  if(request===badgeRequest)await applyBrainBadge(count);
 }catch{}
}
async function dismissBrainAlert(kind,target){
 try{
  const registration=await navigator.serviceWorker?.getRegistration();
  const notifications=await registration?.getNotifications({tag:'brainchain-'+kind+':'+target});
  notifications?.forEach(notification=>notification.close());
 }catch{}
 await refreshBrainBadge();
}
async function prepareBrainAlerts(){
 if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){
  pushNotice.textContent='On iPhone, add BrainChain to your Home Screen with Open as Web App turned on, then open that icon.';
  return;
 }
 try{
  await navigator.serviceWorker.register('./brainchain-sw.js');
  pushRegistration=await navigator.serviceWorker.ready;
  const state=await rpc('bc_push_status');
  applicationKey=state.key;
  const sub=await pushRegistration.pushManager.getSubscription();
  const enabled=Boolean(sub && localStorage.getItem('bc_alert_owner')===session.user.id);
  pushToggle.textContent=enabled?'Disable Notifications':'Enable Notifications';
  pushToggle.disabled=!applicationKey;
  pushNotice.textContent=applicationKey?'':'Notifications are still being set up. Reopen Profile shortly.';
  pushTest.classList.toggle('hide',!enabled);
  if(enabled)await applyBrainBadge(state.count);
 }catch{pushNotice.textContent='Notifications could not be loaded. Reopen Profile to retry.'}
}
async function disableBrainAlerts({switchingProfile=false}={}){
 const sub=await pushRegistration?.pushManager.getSubscription();
 if(sub){
  try{await rpc('bc_push_register',{sub:sub.toJSON(),enabled:false})}
  catch(error){if(!switchingProfile)throw error}
  await sub.unsubscribe();
 }
 localStorage.removeItem('bc_alert_owner');
 await applyBrainBadge(0);
}
async function changeBrainAlerts({testOnEnable=true}={}){
 if(pushToggle.disabled)return;
 pushToggle.disabled=true;
 try{
  if(pushToggle.textContent==='Disable Notifications'){
   await disableBrainAlerts();
   pushTest.classList.add('hide');
   pushToggle.textContent='Enable Notifications';
   pushNotice.textContent='Notifications are off on this device.';
   return;
  }
  const permission=await Notification.requestPermission();
  if(permission!=='granted')throw Error('Allow notifications for BrainChain in iPhone Settings → Notifications.');
  const bytes=Uint8Array.from(atob(applicationKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
  const previous=await pushRegistration.pushManager.getSubscription();
  if(previous&&localStorage.getItem('bc_alert_owner')!==session.user.id)await previous.unsubscribe();
  const sub=await pushRegistration.pushManager.getSubscription()||await pushRegistration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
  // Carry forward read and mute preferences recorded before notifications were available.
  const prefix='bc_chat_seen_'+session.user.id+'_';
  const mutePrefix='bc_chat_mute_'+session.user.id+'_';
  const codes=new Set(Object.keys(localStorage).flatMap(k=>k.startsWith(prefix)?[k.slice(prefix.length)]:k.startsWith(mutePrefix)?[k.slice(mutePrefix.length)]:[]));
  for(const code of codes){
   await rpc('bc_push_chat',{p_code:code,p_seen:Number(localStorage.getItem(prefix+code)||0),p_mute:localStorage.getItem(mutePrefix+code)==='1'}).catch(()=>{});
  }
  await rpc('bc_push_register',{sub:sub.toJSON(),enabled:true});
  localStorage.setItem('bc_alert_owner',session.user.id);
  pushToggle.textContent='Disable Notifications';
  pushNotice.textContent='Notifications are on for this device.';
  pushTest.classList.remove('hide');
  if(testOnEnable)await sendTestAlert();
  await refreshBrainBadge();
 }catch(error){pushNotice.textContent=error.message}
 finally{pushToggle.disabled=false}
}
pushToggle.onclick=()=>changeBrainAlerts();
setInterval(refreshBrainBadge,15000);
document.addEventListener('visibilitychange',refreshBrainBadge);

async function sendTestAlert(){
 pushTest.disabled=true;
 try{
  await rpc('bc_push_test');
  pushNotice.textContent='Test message queued. Return to your iPhone Home Screen now. Look for a BrainChain alert within about two minutes.';
 }catch(error){pushNotice.textContent=error.message}
 finally{pushTest.disabled=false}
}
pushTest.onclick=sendTestAlert;
