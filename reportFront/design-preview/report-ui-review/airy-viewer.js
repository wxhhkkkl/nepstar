(() => {
  const designs = {
    light:{name:"轻盈健康",page:"report-light.html?layout=airy-v4"},
    gallery:{name:"器官画廊",page:"report-gallery.html?layout=airy-v4"},
    data:{name:"静谧数据",page:"report-data.html?layout=airy-v4"}
  };
  const frame=document.querySelector("#preview");
  const tabs=[...document.querySelectorAll('[role="tab"]')];
  let current="light",scrollProgress=0,wide=false;
  function remember(){
    const doc=frame.contentDocument,win=frame.contentWindow;
    if(doc?.documentElement&&win)scrollProgress=Math.max(0,Math.min(1,win.scrollY/Math.max(1,doc.documentElement.scrollHeight-win.innerHeight)));
  }
  function select(key,focus=false){
    if(current===key){if(focus)document.querySelector("#tab-"+key).focus();return;}
    remember();current=key;
    tabs.forEach(tab=>{
      const selected=tab.dataset.version===key;
      tab.setAttribute("aria-selected",String(selected));tab.tabIndex=selected?0:-1;
    });
    frame.src=designs[key].page;frame.title=designs[key].name+" · 宽松单列报告预览";
    document.querySelector("#open-page").href=designs[key].page;
    document.querySelector("#design-panel").setAttribute("aria-labelledby","tab-"+key);
    document.querySelector("#status").textContent="已切换至"+designs[key].name;
    history.replaceState(null,"","#"+key);
    if(focus)document.querySelector("#tab-"+key).focus();
  }
  tabs.forEach((tab,index)=>{
    tab.addEventListener("click",()=>select(tab.dataset.version));
    tab.addEventListener("keydown",event=>{
      const next={ArrowRight:(index+1)%3,ArrowLeft:(index+2)%3,Home:0,End:2}[event.key];
      if(next!==undefined){event.preventDefault();select(tabs[next].dataset.version,true);}
    });
  });
  frame.addEventListener("load",()=>{
    const doc=frame.contentDocument,win=frame.contentWindow;
    if(doc?.documentElement&&win)win.scrollTo(0,scrollProgress*Math.max(0,doc.documentElement.scrollHeight-win.innerHeight));
  });
  document.querySelector("#width-toggle").addEventListener("click",event=>{
    wide=!wide;document.querySelector("#phone-stage").style.maxWidth=(wide?430:390)+"px";
    event.currentTarget.textContent=wide?"390px 手机":"430px 宽屏";
    event.currentTarget.setAttribute("aria-pressed",String(wide));
  });
  document.querySelector("#replay-motion").addEventListener("click",()=>{
    frame.contentWindow?.postMessage({type:"report:replay"},location.origin);
    document.querySelector("#status").textContent="已重播当前可见图表的动画";
  });
  const initial=location.hash.slice(1);if(designs[initial]&&initial!==current)select(initial);
})();
