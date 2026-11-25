self.addEventListener('push',event=>{
 if(!event.data)return;
 const message=event.data.json();
 const url=new URL('./online.html',self.registration.scope);
 if(['turn','chat','mail','admin'].includes(message.kind)){
  url.searchParams.set('alert',message.kind);
  url.searchParams.set('target',message.target);
 }
 const count=Math.max(0,Number(message.count)||0);
 event.waitUntil(Promise.all([
  self.registration.showNotification(message.title,{body:count+' waiting '+(count===1?'item':'items')+' in BrainChain',tag:message.tag,icon:'./brainchain-logo.png',data:{url:url.href}}),
  self.navigator.setAppBadge?.(count)
 ]));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const url=new URL(event.notification.data?.url||'./index.html',self.registration.scope);
 if(url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
 event.waitUntil((async()=>{
  const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
  const existing=windows.find(w=>w.url.startsWith(self.registration.scope));
  if(existing){
   const opened=await existing.navigate(url.href);
   if(opened)return opened.focus();
  }
  return clients.openWindow(url.href);
 })());
});
